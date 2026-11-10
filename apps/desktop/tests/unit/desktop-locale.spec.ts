import { expect, test } from "@playwright/test";
import { DESKTOP_LOCALES, isDesktopLocale } from "../../contracts/ipc";
import { LOCALES, appLocaleIds } from "../../src/i18n/catalog";

/**
 * The renderer and the main process each declare the languages they speak:
 * `LOCALES` drives the Settings picker and renderer copy, while
 * `DESKTOP_LOCALES` types the locale channel main uses for native menus,
 * dialogs and notifications. A language in one list but not the other renders
 * a UI the other half cannot follow, so the two lists must stay identical — in
 * content and in order. Runs in Node; neither module touches Electron at
 * import time.
 */

// Both are plain data plus pure helpers, so they import under Node directly
// (as tests/unit/i18n.spec.ts and window-chrome.spec.ts already do).
const catalogIds = LOCALES.map((locale) => locale.id);

test("the main and renderer locale lists declare the same languages in the same order", () => {
  expect([...DESKTOP_LOCALES]).toEqual(catalogIds);
});

test("the renderer locale ids are the ones main types as DesktopLocale", () => {
  expect(appLocaleIds).toEqual(catalogIds);
  // "en" is the fallback for both main tables and the renderer catalog.
  expect(DESKTOP_LOCALES[0]).toBe("en");
  expect(LOCALES[0]?.id).toBe("en");
  expect(new Set(catalogIds).size, "locale ids are unique").toBe(catalogIds.length);
});

test("main accepts exactly the declared locale ids and rejects anything else", () => {
  for (const locale of DESKTOP_LOCALES) {
    expect(isDesktopLocale(locale), locale).toBe(true);
  }
  for (const value of ["", "EN", "zh", "zh-cn", "zh-CN ", "zh-Hant-TW", "system", null, 42, {}]) {
    expect(isDesktopLocale(value), `${String(value)} is not a desktop locale`).toBe(false);
  }
});
