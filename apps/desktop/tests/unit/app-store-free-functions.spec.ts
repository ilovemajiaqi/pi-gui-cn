import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createJiti } from "jiti";
import type { ModelSettingsSnapshot } from "@pi-gui/session-driver/runtime-types";

// These functions used to be private to app-store.ts, where the only way to
// reach them was to construct a 5000-line store. They are now plain module
// exports, so each case below calls the real implementation directly.
const jiti = createJiti(__filename);
let free: typeof import("../../electron/application/app-store-free-functions");
test.beforeAll(async () => {
  free = await jiti.import<typeof import("../../electron/application/app-store-free-functions")>(
    "../../electron/application/app-store-free-functions.ts",
  );
});

function settings(overrides: Partial<ModelSettingsSnapshot> = {}): ModelSettingsSnapshot {
  return { enabledModelPatterns: [], ...overrides };
}

test("updateRecordValue returns the same record when nothing changed", () => {
  const record = { a: "1", b: "2" };

  // Identity is the contract: mutation sites compare by reference to decide
  // whether to schedule a persist, so an equal-but-new object would cause writes.
  expect(free.updateRecordValue(record, "a", "1")).toBe(record);
  expect(free.updateRecordValue(record, "missing", undefined)).toBe(record);

  expect(free.updateRecordValue(record, "a", "2")).toEqual({ a: "2", b: "2" });
  expect(free.updateRecordValue(record, "a", "2")).not.toBe(record);

  // undefined removes the key rather than storing an undefined value, which
  // would survive a JSON round-trip as an omitted key anyway.
  expect(free.updateRecordValue(record, "a", undefined)).toEqual({ b: "2" });
  expect("a" in free.updateRecordValue(record, "a", undefined)).toBe(false);
});

test("recordUserMessageRecency-style recency compares ISO strings, not Dates", () => {
  // Same-length ISO-8601 UTC strings sort lexicographically in chronological
  // order, which is what the store relies on. Pin that here so a future switch
  // to a different timestamp format fails loudly.
  expect("2026-01-01T00:00:00.000Z" >= "2025-12-31T23:59:59.999Z").toBe(true);
  expect("2026-06-01T00:00:00.000Z" >= "2026-01-01T00:00:00.000Z").toBe(true);
});

test("hasStoredModelSettings rejects a snapshot with nothing in it", () => {
  expect(free.hasStoredModelSettings(undefined)).toBe(false);
  expect(free.hasStoredModelSettings(settings())).toBe(false);
  expect(free.hasStoredModelSettings(settings({ enabledModelPatterns: ["gpt-5*"] }))).toBe(true);
  expect(free.hasStoredModelSettings(settings({ defaultProvider: "openai" }))).toBe(true);
  expect(free.hasStoredModelSettings(settings({ defaultThinkingLevel: "high" }))).toBe(true);
});

test("modelSettingsEqual compares patterns positionally", () => {
  const base = settings({ enabledModelPatterns: ["a", "b"], defaultProvider: "p" });

  expect(free.modelSettingsEqual(base, { ...base })).toBe(true);
  // Order matters: the list is persisted as-is and replayed into the runtime.
  expect(
    free.modelSettingsEqual(
      base,
      settings({ enabledModelPatterns: ["b", "a"], defaultProvider: "p" }),
    ),
  ).toBe(false);
  expect(free.modelSettingsEqual(base, { ...base, enabledModelPatterns: ["a"] })).toBe(false);
  expect(free.modelSettingsEqual(base, { ...base, defaultProvider: "q" })).toBe(false);
});

test("mergeEnabledModelPatterns keeps existing order and appends the new tail", () => {
  expect(free.mergeEnabledModelPatterns(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  expect(free.mergeEnabledModelPatterns([], ["x"])).toEqual(["x"]);
  // A duplicate inside the incoming list is added once.
  expect(free.mergeEnabledModelPatterns(["a"], ["b", "b"])).toEqual(["a", "b"]);

  const existing = ["keep"];
  const merged = free.mergeEnabledModelPatterns(existing, ["new"]);
  expect(merged).not.toBe(existing);
  expect(existing).toEqual(["keep"]);
});

test("reconcilePinnedSessionOrder drops unpublished keys and appends by pin time", async () => {
  // Unpinned keys persisted earlier must not survive; newly pinned keys come
  // last, newest pin first.
  const pinned = new Map([
    ["a", "2026-01-01T00:00:00.000Z"],
    ["b", "2026-03-01T00:00:00.000Z"],
    ["c", "2026-02-01T00:00:00.000Z"],
  ]);

  expect(free.reconcilePinnedSessionOrder(pinned, ["a", "gone"])).toEqual(["a", "b", "c"]);
  // A stale duplicate in the persisted order collapses to one entry.
  expect(free.reconcilePinnedSessionOrder(pinned, ["c", "c", "a"])).toEqual(["c", "a", "b"]);
  expect(free.reconcilePinnedSessionOrder(new Map(), ["a"])).toEqual([]);
});

test("formatCapabilityLabel names the known capabilities and de-camel-cases the rest", () => {
  expect(free.formatCapabilityLabel("custom")).toBe("custom UI");
  expect(free.formatCapabilityLabel("onTerminalInput")).toBe("terminal input");
  expect(free.formatCapabilityLabel("setFooter")).toBe("footer UI");
  expect(free.formatCapabilityLabel("doesSomethingNew")).toBe("does something new");
});

test("resolveSelected*FromCatalog degrade to the first entry or empty string", () => {
  const workspaces = [{ workspaceId: "w1" }, { workspaceId: "w2" }];
  expect(free.resolveSelectedWorkspaceIdFromCatalog("w2", workspaces)).toBe("w2");
  expect(free.resolveSelectedWorkspaceIdFromCatalog("gone", workspaces)).toBe("w1");
  expect(free.resolveSelectedWorkspaceIdFromCatalog("w1", [])).toBe("");

  const sessions = [
    {
      workspaceId: "w1",
      sessionRef: { workspaceId: "w1", sessionId: "s1" },
    },
    {
      workspaceId: "w1",
      sessionRef: { workspaceId: "w1", sessionId: "s2" },
    },
    {
      workspaceId: "w2",
      sessionRef: { workspaceId: "w2", sessionId: "s3" },
    },
  ] as unknown as Parameters<typeof free.resolveSelectedSessionIdFromCatalog>[2];
  expect(free.resolveSelectedSessionIdFromCatalog("w1", "s2", sessions)).toBe("s2");
  expect(free.resolveSelectedSessionIdFromCatalog("w1", "s3", sessions)).toBe("s1");
  expect(free.resolveSelectedSessionIdFromCatalog("w9", "s1", sessions)).toBe("");
});

test("readProjectModelSettingsFile returns an empty object instead of throwing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pi-model-settings-"));
  try {
    // Missing file, malformed JSON, and a non-object payload all degrade to {}.
    // Callers treat {} as "no project override", so throwing would break the
    // launch path on a hand-edited settings file.
    await expect(free.readProjectModelSettingsFile(dir)).resolves.toEqual({});

    await mkdir(path.join(dir, ".pi"));
    await writeFile(path.join(dir, ".pi", "settings.json"), "{ not json");
    await expect(free.readProjectModelSettingsFile(dir)).resolves.toEqual({});

    await writeFile(path.join(dir, ".pi", "settings.json"), '"a string"');
    await expect(free.readProjectModelSettingsFile(dir)).resolves.toEqual({});

    await writeFile(path.join(dir, ".pi", "settings.json"), '{"defaultModel":"m1"}');
    await expect(free.readProjectModelSettingsFile(dir)).resolves.toEqual({ defaultModel: "m1" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mergeModelSettingsSnapshot lets project fields win one at a time", () => {
  const global = settings({
    defaultProvider: "global-provider",
    defaultModelId: "global-model",
    defaultThinkingLevel: "low",
    enabledModelPatterns: ["g*"],
  });

  // Only the fields the project sets are overridden; the rest stay global.
  const merged = free.mergeModelSettingsSnapshot(global, { defaultModel: "project-model" });
  expect(merged.defaultModelId).toBe("project-model");
  expect(merged.defaultProvider).toBe("global-provider");
  expect(merged.defaultThinkingLevel).toBe("low");
  expect(merged.enabledModelPatterns).toEqual(["g*"]);

  // enabledModels replaces rather than merges, and non-string entries are dropped.
  const withPatterns = free.mergeModelSettingsSnapshot(global, {
    enabledModels: ["p*", 42, null],
  });
  expect(withPatterns.enabledModelPatterns).toEqual(["p*"]);

  // A non-array enabledModels is ignored in favour of the global patterns.
  expect(free.mergeModelSettingsSnapshot(global, { enabledModels: "nope" }).enabledModelPatterns) //
    .toEqual(["g*"]);
});

test("applyModelSettingsSnapshot clears fields the incoming snapshot omits", () => {
  const runtime = {
    settings: {
      defaultProvider: "old",
      defaultModelId: "old-model",
      defaultThinkingLevel: "high",
      enabledModelPatterns: ["old*"],
    },
  } as unknown as Parameters<typeof free.applyModelSettingsSnapshot>[0];

  // An omitted field becomes explicitly undefined rather than being left at its
  // previous value: the snapshot from the runtime is authoritative, so a cleared
  // default must actually clear.
  const next = free.applyModelSettingsSnapshot(runtime, settings({ enabledModelPatterns: ["n*"] }));
  expect(next.settings.defaultProvider).toBeUndefined();
  expect(next.settings.defaultModelId).toBeUndefined();
  expect(next.settings.defaultThinkingLevel).toBeUndefined();
  expect(next.settings.enabledModelPatterns).toEqual(["n*"]);

  // The incoming array is copied, not aliased.
  const patterns = ["a"];
  const copied = free.applyModelSettingsSnapshot(
    runtime,
    settings({ enabledModelPatterns: patterns }),
  );
  expect(copied.settings.enabledModelPatterns).not.toBe(patterns);
});
