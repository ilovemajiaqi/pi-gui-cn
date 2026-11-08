import type { BrowserWindow } from "electron";
import { desktopIpc, type DesktopLocale } from "../../contracts/ipc";

/**
 * Holds the language main renders native menus, dialogs and OS notifications
 * in. Mirrors ThemeManager: tracked windows get every change pushed, and
 * in-main consumers (the application menu, dialogs, notifications) subscribe
 * through onChange. Persistence goes through the store via the `persist`
 * callback main wires up, so the choice survives relaunches.
 */
export class LocaleManager {
  private locale: DesktopLocale;
  private readonly windows = new Set<BrowserWindow>();
  private readonly listeners = new Set<(locale: DesktopLocale) => void>();
  private readonly persist?: (locale: DesktopLocale) => Promise<void>;

  constructor(
    initialLocale: DesktopLocale,
    options: { readonly persist?: (locale: DesktopLocale) => Promise<void> } = {},
  ) {
    this.locale = initialLocale;
    this.persist = options.persist;
  }

  trackWindow(win: BrowserWindow) {
    if (win.isDestroyed() || this.windows.has(win)) {
      return;
    }
    this.windows.add(win);
    win.once("closed", () => {
      this.windows.delete(win);
    });
  }

  getLocale(): DesktopLocale {
    return this.locale;
  }

  async setLocale(
    locale: DesktopLocale,
    options: { readonly persist?: boolean } = {},
  ): Promise<void> {
    if (this.locale === locale) {
      return;
    }
    this.locale = locale;
    if (options.persist !== false) {
      await this.persist?.(locale);
    }
    this.broadcast();
    for (const listener of this.listeners) {
      listener(locale);
    }
  }

  onChange(listener: (locale: DesktopLocale) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast() {
    for (const window of this.windows) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) {
        window.webContents.send(desktopIpc.localeChanged, this.locale);
      }
    }
  }
}
