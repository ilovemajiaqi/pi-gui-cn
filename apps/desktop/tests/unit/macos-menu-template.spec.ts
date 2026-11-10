import { expect, test } from "@playwright/test";
import {
  buildMacMenuTemplate,
  CHECK_FOR_UPDATES_MENU_ITEM_ID,
  NEW_WINDOW_MENU_ITEM_ID,
  OPEN_FOLDER_MENU_ITEM_ID,
  type MacMenuActions,
} from "../../electron/platform/menus/macos-menu-template";

function makeActions(): { actions: MacMenuActions; calls: string[] } {
  const calls: string[] = [];
  const actions: MacMenuActions = {
    appName: "pi",
    checkForUpdates: () => calls.push("checkForUpdates"),
    openNewThread: () => calls.push("openNewThread"),
    newWindow: () => calls.push("newWindow"),
    openFolder: () => calls.push("openFolder"),
    reload: () => calls.push("reload"),
    forceReload: () => calls.push("forceReload"),
  };
  return { actions, calls };
}

const t = (key: string): string => `t:${key}`;

test("keeps every role Electron resolves for us", () => {
  const { actions } = makeActions();
  const template = buildMacMenuTemplate(t, actions);

  expect(template.map((item) => item.role ?? item.label)).toEqual([
    "pi",
    "t:main.menu.file",
    "editMenu",
    "t:main.menu.view",
    "windowMenu",
  ]);

  const appMenu = template[0]?.submenu as { role?: string }[];
  expect(appMenu.filter((item) => item.role).map((item) => item.role)).toEqual([
    "about",
    "services",
    "hide",
    "hideOthers",
    "unhide",
    "quit",
  ]);

  const fileMenu = template[1]?.submenu as { role?: string }[];
  expect(fileMenu.filter((item) => item.role).map((item) => item.role)).toEqual(["close"]);

  const viewMenu = template[3]?.submenu as { role?: string }[];
  expect(viewMenu.filter((item) => item.role).map((item) => item.role)).toEqual([
    "toggleDevTools",
    "resetZoom",
    "zoomIn",
    "zoomOut",
    "togglefullscreen",
  ]);
});

test("translates every label through the translator", () => {
  const { actions } = makeActions();
  const labels = JSON.stringify(buildMacMenuTemplate(t, actions)).match(/"t:[^"]+"/g);

  expect(labels).toEqual([
    '"t:main.menu.checkForUpdates"',
    '"t:main.menu.file"',
    '"t:main.menu.newThread"',
    '"t:main.menu.newWindow"',
    '"t:main.menu.openFolder"',
    '"t:main.menu.view"',
    '"t:main.menu.reload"',
    '"t:main.menu.forceReload"',
  ]);
});

test("uses the application name as the first submenu title", () => {
  const { actions } = makeActions();
  const template = buildMacMenuTemplate(t, { ...actions, appName: "pi-gui-zh" });

  expect(template[0]?.label).toBe("pi-gui-zh");
});

test("leaves the reload items without accelerators so Cmd+R stays free for Review", () => {
  const { actions } = makeActions();
  const viewMenu = buildMacMenuTemplate(t, actions)[3]?.submenu as {
    label?: string;
    accelerator?: string;
  }[];

  for (const label of ["t:main.menu.reload", "t:main.menu.forceReload"]) {
    const item = viewMenu.find((candidate) => candidate.label === label);
    expect(item, label).toBeDefined();
    expect(item?.accelerator, label).toBeUndefined();
  }
});

test("forwards clicks to the injected actions and keeps the menu item ids stable", () => {
  const { actions, calls } = makeActions();
  const template = buildMacMenuTemplate(t, actions);

  const byId = new Map<string, { click?: () => void }>();
  for (const topLevel of template) {
    for (const item of (topLevel.submenu ?? []) as { id?: string; click?: () => void }[]) {
      if (item.id) {
        byId.set(item.id, item);
      }
    }
  }

  expect([...byId.keys()].sort()).toEqual(
    [CHECK_FOR_UPDATES_MENU_ITEM_ID, NEW_WINDOW_MENU_ITEM_ID, OPEN_FOLDER_MENU_ITEM_ID].sort(),
  );
  expect(CHECK_FOR_UPDATES_MENU_ITEM_ID).toBe("app.check-for-updates");
  expect(NEW_WINDOW_MENU_ITEM_ID).toBe("file.new-window");
  expect(OPEN_FOLDER_MENU_ITEM_ID).toBe("file.open-folder");

  byId.get(CHECK_FOR_UPDATES_MENU_ITEM_ID)?.click?.();
  byId.get(NEW_WINDOW_MENU_ITEM_ID)?.click?.();
  byId.get(OPEN_FOLDER_MENU_ITEM_ID)?.click?.();

  const fileMenu = template[1]?.submenu as { label?: string; click?: () => void }[];
  const viewMenu = template[3]?.submenu as { label?: string; click?: () => void }[];
  fileMenu.find((item) => item.label === "t:main.menu.newThread")?.click?.();
  viewMenu.find((item) => item.label === "t:main.menu.reload")?.click?.();
  viewMenu.find((item) => item.label === "t:main.menu.forceReload")?.click?.();

  expect(calls).toEqual([
    "checkForUpdates",
    "newWindow",
    "openFolder",
    "openNewThread",
    "reload",
    "forceReload",
  ]);
});

test("separates groups instead of relying on position alone", () => {
  const { actions } = makeActions();
  const template = buildMacMenuTemplate(t, actions);

  const separators = template.flatMap((topLevel) =>
    ((topLevel.submenu ?? []) as { type?: string }[]).filter((item) => item.type === "separator"),
  );

  // Four in the app menu (about|updates|services, hide-group|quit), two in File
  // (threads|open folder|close) and two in View (reloads|zoom|fullscreen).
  expect(separators).toHaveLength(8);
});
