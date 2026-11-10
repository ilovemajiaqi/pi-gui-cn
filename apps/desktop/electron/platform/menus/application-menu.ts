/**
 * Installs the application menu.
 *
 * macOS gets the template built by ./macos-menu-template; every other platform
 * gets no menu at all. Windows and Linux already hide the bar and drive every
 * command from the renderer (see the shortcut handling in main.ts), so Electron's
 * built-in English File/Edit/View menu was only ever a stray, untranslatable bar
 * on an otherwise localised window.
 *
 * This is the one module in the folder that touches Electron, which keeps the
 * template loadable in a plain Node test.
 */
import { Menu } from "electron";
import type { MainTranslator } from "../main-messages";
import type { MacMenuActions } from "./macos-menu-template";
import { buildMacMenuTemplate } from "./macos-menu-template";

export function installApplicationMenu(t: MainTranslator, actions: MacMenuActions): void {
  if (process.platform !== "darwin") {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMacMenuTemplate(t, actions)));
}
