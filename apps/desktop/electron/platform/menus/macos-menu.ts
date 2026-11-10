/**
 * Installs the macOS application menu. Split from the template so the template
 * module stays importable without an Electron runtime.
 */
import { Menu } from "electron";
import type { MacMenuActions } from "./macos-menu-template";
import { buildMacMenuTemplate } from "./macos-menu-template";
import type { MainTranslator } from "../main-messages";

export function installMacApplicationMenu(t: MainTranslator, actions: MacMenuActions): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildMacMenuTemplate(t, actions)));
}
