import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createJiti } from "jiti";
import type { DesktopAppState, SessionRecord } from "../../contracts/desktop-state";

// The desktop Playwright harness runs as CommonJS, and app-store.ts is TypeScript.
// jiti compiles it in place so these cases exercise the real DesktopAppStore
// instead of a hand-built stand-in. app-store.ts imports only `type BrowserWindow`,
// which is erased at run time, so no Electron binary is involved.
const jiti = createJiti(__filename);
let DesktopAppStore: typeof import("../../electron/application/app-store").DesktopAppStore;
test.beforeAll(async () => {
  ({ DesktopAppStore } = await jiti.import<typeof import("../../electron/application/app-store")>(
    "../../electron/application/app-store.ts",
  ));
});

/**
 * A store that has been constructed but never initialized. Everything asserted
 * here is reachable in that state on purpose: initialize() starts the driver and
 * reads the catalog, and none of the behavior below depends on either.
 */
async function fixture() {
  const userDataDir = await mkdtemp(path.join(os.tmpdir(), "pi-store-memory-"));
  const store = new DesktopAppStore({ userDataDir, initialWorkspacePaths: [] });
  return {
    store,
    userDataDir,
    async dispose() {
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}

const sessionA = { workspaceId: "ws-a", sessionId: "session-a" };
const sessionB = { workspaceId: "ws-b", sessionId: "session-b" };

test("snapshot returns a detached copy the renderer cannot mutate", async () => {
  const { store, userDataDir, dispose } = await fixture();
  try {
    const first = store.snapshot();
    const second = store.snapshot();

    // A shared reference would let any renderer-side edit reach main-process
    // state, and would make two publishes indistinguishable to consumers that
    // compare by identity.
    expect(first).not.toBe(second);
    expect(first.workspaces).not.toBe(second.workspaces);

    // The state type is deeply readonly, which keeps main-process writers
    // honest. The renderer receives a plain structured clone over IPC and is
    // free to mutate it, so the test drops the readonly view to do exactly what
    // the renderer does: edit the object it was handed.
    const handed = first as unknown as {
      activeView: string;
      workspaces: { id: string; name: string; path: string; sessions: unknown[] }[];
    };
    handed.activeView = "settings";
    handed.workspaces.push({
      id: "injected",
      name: "Injected",
      path: "/injected",
      sessions: [],
    });

    const reread = store.snapshot();
    expect(reread.activeView).toBe("threads");
    expect(reread.workspaces).toHaveLength(0);

    // Constructing and reading must not touch the profile directory. The store
    // only writes once initialize() has finished loading.
    await expect(readdir(userDataDir)).resolves.toEqual([]);
  } finally {
    await dispose();
  }
});

test("applyView falls back to a known id and keeps the revision untouched", async () => {
  const { store, dispose } = await fixture();
  try {
    const before = store.snapshot().revision;

    // activeView is caller-supplied and does not disturb the stored revision;
    // bumping it here would make the renderer drop snapshots from other paths.
    const switched = store.applyView({ activeView: "settings" });
    expect(switched.activeView).toBe("settings");
    expect(switched.revision).toBe(before);

    const collapsed = store.applyView({ sidebarCollapsed: true });
    expect(collapsed.sidebarCollapsed).toBe(true);
    expect(collapsed.activeView).toBe("settings");

    // An id that is not in the catalog must degrade to the empty selection, not
    // survive as a dangling reference the next renderer pass would try to use.
    const ghosted = store.applyView({
      selectedWorkspaceId: "ghost-workspace",
      selectedSessionId: "ghost-session",
    });
    expect(ghosted.selectedWorkspaceId).toBe("");
    expect(ghosted.selectedSessionId).toBe("");
    expect(ghosted.activeView).toBe("settings");
  } finally {
    await dispose();
  }
});

test("recordUserMessageRecency only moves forward", async () => {
  const { store, dispose } = await fixture();
  try {
    // This drives sidebar ordering and the unread dot. A late-arriving older
    // event must not push a thread back down the list.
    expect(store.recordUserMessageRecency(sessionA, "2026-01-01T00:00:00.000Z")).toBe(true);
    expect(store.recordUserMessageRecency(sessionA, "2026-01-01T00:00:00.000Z")).toBe(false);
    expect(store.recordUserMessageRecency(sessionA, "2025-01-01T00:00:00.000Z")).toBe(false);
    expect(store.recordUserMessageRecency(sessionA, "2026-06-01T00:00:00.000Z")).toBe(true);

    expect(store.snapshot().lastInteractedAtBySession).toEqual({
      "ws-a:session-a": "2026-06-01T00:00:00.000Z",
    });
  } finally {
    await dispose();
  }
});

test("emit fans out once per call and stops after unsubscribe", async () => {
  const { store, dispose } = await fixture();
  try {
    const seen: number[] = [];
    const unsubscribe = store.subscribe((state) => {
      seen.push(state.revision);
    });

    const first = store.emit();
    store.emit();
    expect(seen).toHaveLength(2);

    // The revision a listener receives must climb. The renderer discards any
    // snapshot whose revision is not above its high-water mark, so a repeated or
    // lower revision freezes the UI until main happens to climb past it again.
    expect(seen[0]).toBe(first.revision);
    expect(seen[1]!).toBeGreaterThan(seen[0]!);

    unsubscribe();
    store.emit();
    expect(seen).toHaveLength(2);
  } finally {
    await dispose();
  }
});

/**
 * Seed two threads by hand. Session records normally arrive from the driver, so
 * there is no public way to place two sessions in the store without starting
 * one. This is the single cast in this file, and it writes only the field the
 * projection reads.
 */
function seedTwoThreads(store: InstanceType<typeof DesktopAppStore>): void {
  const session = (id: string, title: string): SessionRecord => ({
    id,
    title,
    updatedAt: "2026-01-01T00:00:00.000Z",
    preview: "",
    status: "idle",
    hasUnseenUpdate: false,
  });
  (store as unknown as { state: DesktopAppState }).state = {
    ...store.snapshot(),
    workspaces: [
      { id: "ws-a", name: "A", path: "/tmp/a", sessions: [session("session-a", "A")] },
      { id: "ws-b", name: "B", path: "/tmp/b", sessions: [session("session-b", "B")] },
    ],
  };
}

test("composer drafts stay per-session and the sync nonce only moves forward", async () => {
  const { store, dispose } = await fixture();
  try {
    seedTwoThreads(store);
    const startNonce = store.snapshot().composerDraftSyncNonce;

    store.setComposerDraftForSession(sessionA, "draft for A", "command");
    const afterA = store.snapshot();
    expect(afterA.composerDraftSyncSource).toBe("command");
    expect(afterA.composerDraftSyncNonce).toBeGreaterThan(startNonce);

    // Writing B's draft must not touch A's, and projecting B must not surface
    // A's text. Cross-session leakage here types one thread's draft into another
    // thread's composer, which is silent and destructive.
    store.setComposerDraftForSession(sessionB, "draft for B", "command");
    const viewB = store.applyView({
      selectedWorkspaceId: "ws-b",
      selectedSessionId: "session-b",
    });
    expect(viewB.composerDraft).toBe("draft for B");
    const viewA = store.applyView({
      selectedWorkspaceId: "ws-a",
      selectedSessionId: "session-a",
    });
    expect(viewA.composerDraft).toBe("draft for A");

    // Clearing a draft drops it, so switching back finds nothing to restore.
    store.setComposerDraftForSession(sessionA, "", "command");
    expect(
      store.applyView({ selectedWorkspaceId: "ws-a", selectedSessionId: "session-a" })
        .composerDraft,
    ).toBe("");

    expect(store.allocateComposerDraftSyncNonce(5)).toBe(6);
    expect(store.allocateComposerDraftSyncNonce(5)).toBe(7);
    expect(store.allocateComposerDraftSyncNonce(1)).toBe(8);
  } finally {
    await dispose();
  }
});
