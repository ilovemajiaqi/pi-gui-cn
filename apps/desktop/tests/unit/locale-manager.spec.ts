import { expect, test } from "@playwright/test";
import { desktopIpc, type DesktopLocale } from "../../contracts/ipc";
import { LocaleManager } from "../../electron/platform/locale-manager";

/**
 * LocaleManager owns the language main renders native menus, dialogs and OS
 * notifications in. It touches only a tracked window's `isDestroyed`,
 * `webContents.send` and `closed` event, so these tests drive it with plain
 * objects and never launch Electron. Runs in Node.
 */

/** The slice of BrowserWindow the manager uses. */
interface WindowStub {
  readonly sent: readonly { readonly channel: string; readonly payload: unknown }[];
  isDestroyed(): boolean;
  readonly webContents: {
    isDestroyed(): boolean;
    send(channel: string, payload: unknown): void;
  };
  once(event: "closed", listener: () => void): void;
}

type TrackedWindow = Parameters<LocaleManager["trackWindow"]>[0];

function windowStub(options: { destroyed?: boolean; contentsDestroyed?: boolean } = {}) {
  const sent: { channel: string; payload: unknown }[] = [];
  const closedListeners: (() => void)[] = [];
  const window: WindowStub = {
    sent,
    isDestroyed: () => options.destroyed ?? false,
    webContents: {
      isDestroyed: () => options.contentsDestroyed ?? false,
      send: (channel, payload) => sent.push({ channel, payload }),
    },
    once: (_event, listener) => {
      closedListeners.push(listener);
    },
  };
  return {
    window,
    sent,
    /** Fires the window's `closed` event, as Electron does when it is gone. */
    close() {
      for (const listener of closedListeners.splice(0)) {
        listener();
      }
    },
  };
}

function track(manager: LocaleManager, stub: WindowStub): void {
  manager.trackWindow(stub as unknown as TrackedWindow);
}

/** A persist callback that records the write and lets the test settle it. */
function pendingPersist() {
  const saved: DesktopLocale[] = [];
  let settle!: () => void;
  const stored = new Promise<void>((resolve) => {
    settle = resolve;
  });
  return {
    saved,
    persist: (locale: DesktopLocale): Promise<void> => {
      saved.push(locale);
      return stored;
    },
    settle: () => settle(),
  };
}

test("a manager starts on the locale it was constructed with", () => {
  expect(new LocaleManager("en").getLocale()).toBe("en");
  expect(new LocaleManager("zh-CN").getLocale()).toBe("zh-CN");
});

test("setLocale persists and waits for the store before telling anyone", async () => {
  const store = pendingPersist();
  const manager = new LocaleManager("en", { persist: store.persist });
  const changes: DesktopLocale[] = [];
  manager.onChange((locale) => changes.push(locale));
  const tracked = windowStub();
  track(manager, tracked.window);

  const pending = manager.setLocale("zh-CN");

  // The in-memory value flips immediately; nothing reaches the UI until the
  // write lands, so a relaunch and the visible window agree.
  expect(manager.getLocale()).toBe("zh-CN");
  expect(store.saved).toEqual(["zh-CN"]);
  expect(changes).toEqual([]);
  expect(tracked.sent).toEqual([]);

  store.settle();
  await pending;

  expect(changes).toEqual(["zh-CN"]);
  expect(tracked.sent).toEqual([{ channel: desktopIpc.localeChanged, payload: "zh-CN" }]);
});

test("setting the locale it already has neither persists nor broadcasts", async () => {
  const store = pendingPersist();
  const manager = new LocaleManager("zh-CN", { persist: store.persist });
  const changes: DesktopLocale[] = [];
  manager.onChange((locale) => changes.push(locale));
  const tracked = windowStub();
  track(manager, tracked.window);

  await manager.setLocale("zh-CN");
  await manager.setLocale("zh-CN", { persist: true });

  expect(store.saved).toEqual([]);
  expect(changes).toEqual([]);
  expect(tracked.sent).toEqual([]);
});

test("persist: false changes the session's language but leaves the saved choice alone", async () => {
  const store = pendingPersist();
  const manager = new LocaleManager("en", { persist: store.persist });
  const changes: DesktopLocale[] = [];
  manager.onChange((locale) => changes.push(locale));
  const tracked = windowStub();
  track(manager, tracked.window);

  await manager.setLocale("zh-CN", { persist: false });

  expect(manager.getLocale()).toBe("zh-CN");
  expect(store.saved).toEqual([]);
  expect(changes).toEqual(["zh-CN"]);
  expect(tracked.sent).toEqual([{ channel: desktopIpc.localeChanged, payload: "zh-CN" }]);
});

test("a tracked window hears each change once, and nothing after it closes", async () => {
  const manager = new LocaleManager("en");
  const tracked = windowStub();
  track(manager, tracked.window);
  // The same window is tracked once, however often main hands it over.
  track(manager, tracked.window);

  await manager.setLocale("zh-CN");
  expect(tracked.sent).toEqual([{ channel: desktopIpc.localeChanged, payload: "zh-CN" }]);

  tracked.close();
  await manager.setLocale("en");

  expect(manager.getLocale()).toBe("en");
  expect(tracked.sent).toHaveLength(1);
});

test("destroyed windows receive no push", async () => {
  const manager = new LocaleManager("en");
  const destroyed = windowStub({ destroyed: true });
  const deadContents = windowStub({ contentsDestroyed: true });
  track(manager, destroyed.window);
  track(manager, deadContents.window);

  await manager.setLocale("zh-CN");

  // The destroyed window was never tracked; the one whose contents are gone was
  // tracked but is skipped while broadcasting, so neither sees the change.
  expect(destroyed.sent).toEqual([]);
  expect(deadContents.sent).toEqual([]);
});

test("an onChange listener can unsubscribe", async () => {
  const manager = new LocaleManager("en");
  const changes: DesktopLocale[] = [];
  const unsubscribe = manager.onChange((locale) => changes.push(locale));

  await manager.setLocale("zh-CN");
  unsubscribe();
  await manager.setLocale("en");

  expect(changes).toEqual(["zh-CN"]);
});
