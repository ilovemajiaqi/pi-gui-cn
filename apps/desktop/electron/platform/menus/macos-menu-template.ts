/**
 * The macOS application menu template, as a pure function.
 *
 * This used to live inside main.ts behind a first-line
 * `if (process.platform !== "darwin") return;`, so on Windows and Linux the whole
 * template was compiled into the bundle and never ran, and no test could reach it
 * because importing main.ts opens a window.
 *
 * Splitting the template out of the installer is what makes it testable: this
 * module imports only types, so plain Node can load it without an Electron
 * runtime. macos-menu.ts owns the one call that touches Electron.
 */
import type { MenuItemConstructorOptions } from "electron";
import type { MainTranslator } from "../main-messages";

/** Stable ids the window layer looks menu items up by. */
export const NEW_WINDOW_MENU_ITEM_ID = "file.new-window";
export const OPEN_FOLDER_MENU_ITEM_ID = "file.open-folder";
export const CHECK_FOR_UPDATES_MENU_ITEM_ID = "app.check-for-updates";

export interface MacMenuActions {
  /** Shown as the first submenu's title; main.ts passes app.name. */
  readonly appName: string;
  checkForUpdates(): void;
  openNewThread(): void;
  newWindow(): void;
  openFolder(): void;
  reload(): void;
  forceReload(): void;
}

/**
 * Build the darwin menu template. Separated from installation so a test can
 * inspect the tree — including the roles Electron resolves internally, which are
 * the part most likely to be silently dropped in an edit.
 */
export function buildMacMenuTemplate(
  t: MainTranslator,
  actions: MacMenuActions,
): MenuItemConstructorOptions[] {
  return [
    {
      label: actions.appName,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          id: CHECK_FOR_UPDATES_MENU_ITEM_ID,
          label: t("main.menu.checkForUpdates"),
          click: () => {
            actions.checkForUpdates();
          },
        },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: t("main.menu.file"),
      submenu: [
        {
          label: t("main.menu.newThread"),
          accelerator: "CommandOrControl+N",
          click: () => {
            actions.openNewThread();
          },
        },
        {
          id: NEW_WINDOW_MENU_ITEM_ID,
          label: t("main.menu.newWindow"),
          accelerator: "CommandOrControl+Shift+N",
          click: () => {
            actions.newWindow();
          },
        },
        { type: "separator" },
        {
          id: OPEN_FOLDER_MENU_ITEM_ID,
          label: t("main.menu.openFolder"),
          accelerator: "Command+O",
          click: () => {
            actions.openFolder();
          },
        },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { role: "editMenu" },
    {
      label: t("main.menu.view"),
      submenu: [
        // Cmd+R toggles Review and Shift+Cmd+R renames the thread, so neither
        // reload has a shortcut.
        {
          label: t("main.menu.reload"),
          click: () => {
            actions.reload();
          },
        },
        {
          label: t("main.menu.forceReload"),
          click: () => {
            actions.forceReload();
          },
        },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
}
