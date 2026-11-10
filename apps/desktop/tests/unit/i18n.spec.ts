import { expect, test } from "@playwright/test";
import { createElement } from "react";
import {
  LOCALES,
  appLocaleIds,
  defaultLocale,
  languageTagParts,
  localeDefinition,
  matchSystemLocale,
  textDirectionFor,
  type AppLocale,
  type MessageKey,
  type Messages,
} from "../../src/i18n/catalog";
import {
  LOCALE_STORAGE_KEY,
  localePreferences,
  readStoredLocale,
  readStoredLocaleOrNull,
  resolveLocale,
  writeStoredLocale,
  type LocalePreference,
} from "../../src/i18n/preference";
import {
  catalogs,
  interpolate,
  isMessageKey,
  resolveMessage,
  translateError,
  translatorFor,
} from "../../src/i18n/translate";
import { interpolateNodes } from "../../src/i18n/rich-text";
import { en } from "../../src/i18n/messages/en";
import { zhCN } from "../../src/i18n/messages/zh-CN";

const englishKeys = new Set(Object.keys(en));
const pluralCategory = /_(zero|one|two|few|many|other)$/;
/** Keys English gives plural forms to; other locales may add any CLDR category for them. */
const pluralBaseKeys = new Set(
  [...englishKeys]
    .filter((key) => pluralCategory.test(key))
    .map((key) => key.replace(pluralCategory, "")),
);

function isEnglishKeyOrPluralForm(key: string): boolean {
  return englishKeys.has(key) || pluralBaseKeys.has(key.replace(pluralCategory, ""));
}
const localeIds = LOCALES.map((locale) => locale.id);

function placeholders(template: string): readonly string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

/** zh-CN with `keys` removed, as a catalog looks before a translator catches up. */
function zhCNWithout(...keys: readonly MessageKey[]): Partial<Messages> {
  const catalog: Partial<Record<MessageKey, string>> = { ...zhCN };
  for (const key of keys) delete catalog[key];
  return catalog;
}

test("the locale registry is well formed and covers its own preferences", () => {
  // The first entry is the locale everything falls back to.
  expect(LOCALES[0].id).toBe(defaultLocale);
  expect(new Set(localeIds).size, "locale ids are unique").toBe(LOCALES.length);
  // "system" is the only preference that is not a locale.
  expect([...localePreferences]).toEqual(["system", ...appLocaleIds]);

  for (const locale of LOCALES) {
    const reason = `locale ${locale.id}`;
    expect(locale.label.trim(), `${reason} label`).not.toBe("");
    expect(locale.id, `${reason} looks like a language tag`).toMatch(
      /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
    );
    expect(localeDefinition(locale.id).id, reason).toBe(locale.id);
    expect(textDirectionFor(locale.id), reason).toBe("ltr");
  }
});

test("other locales define only English keys, with non-empty copy and the same placeholders", () => {
  for (const locale of LOCALES) {
    for (const [key, copy] of Object.entries(catalogs[locale.id])) {
      const reason = `locale ${locale.id} ${key}`;
      expect(isEnglishKeyOrPluralForm(key), `${reason} is not an English key`).toBe(true);
      expect(copy?.trim(), reason).not.toBe("");
      const source = en[key as MessageKey] ?? en[key.replace(pluralCategory, "") as MessageKey];
      expect(placeholders(copy ?? ""), reason).toEqual(placeholders(source));
    }
  }
});

test("a zh-CN key that is not translated yet renders the English copy", () => {
  const zh = translatorFor("zh-CN");
  expect(zh("settings.nav.general")).toBe("通用");
  expect(zh("settings.nav.general")).not.toBe(en["settings.nav.general"]);

  const behind = translatorFor("zh-CN", zhCNWithout("settings.nav.general"));
  expect(behind("settings.nav.general")).toBe("General");
  // Keys the catalog still has keep their translation.
  expect(behind("settings.nav.appearance")).toBe(zh("settings.nav.appearance"));
  // Placeholders still fill in on the English fallback.
  expect(translatorFor("zh-CN", {})("secondarySurface.sectionsLabel", { title: "设置" })).toBe(
    "设置 sections",
  );
  // An unknown key falls back to the key itself, never to `undefined`.
  expect(resolveMessage({}, "totally.unknown" as MessageKey)).toBe("totally.unknown");
});

test("interpolate substitutes known names and leaves unknown ones alone", () => {
  expect(interpolate("Search {title}", { title: "settings" })).toBe("Search settings");
  expect(interpolate("{a} {b}", { a: 1 })).toBe("1 {b}");
  expect(interpolate("no placeholders")).toBe("no placeholders");
});

test("interpolateNodes keeps one sentence whole while filling in markup", () => {
  // Every substitute keeps a stable slot between the untouched text slices, so a
  // reordered translation still puts the caller's node where its placeholder sat.
  const rendered = interpolateNodes("Stored at {path}.", { path: "ui-state.json" });
  expect(rendered).toHaveLength(3);
  expect(rendered[0]).toBe("Stored at ");
  expect(rendered[2]).toBe(".");
  // A name the caller did not supply stays visible, exactly like `interpolate`.
  expect(interpolateNodes("Stored at {path}.", {})).toEqual(["Stored at ", "{path}", "."]);
  // Languages reorder the sentence, so the markup follows the placeholder.
  const reordered = interpolateNodes("{path} 里。", { path: createElement("code", null, "x") });
  expect(reordered).toHaveLength(2);
  expect(reordered[1]).toBe(" 里。");
});

test("translateError translates the app's own keys and passes external text through", () => {
  const zh = translatorFor("zh-CN");
  // A key the app ships is translated, count included.
  expect(translateError("workbench.tooManyFileTabs", zh, { count: 8 })).toBe(
    zh("workbench.tooManyFileTabs", { count: 8 }),
  );
  // An Error carrying a key works just as well as the bare string.
  expect(translateError(new Error("workbench.saveTabsError"), zh)).toBe(
    zh("workbench.saveTabsError"),
  );
  // External failures keep their own words: an extension host, a provider, an OS error.
  expect(translateError("EACCES: permission denied, open '/tmp/x'", zh)).toBe(
    "EACCES: permission denied, open '/tmp/x'",
  );
  expect(translateError("Request failed with status 401", zh)).toBe(
    "Request failed with status 401",
  );
  // A key-looking string that is not in the catalog is not a key.
  expect(isMessageKey("workbench.saveTabsError")).toBe(true);
  expect(isMessageKey("workbench.noSuchKey")).toBe(false);
  expect(translateError("workbench.noSuchKey", zh)).toBe("workbench.noSuchKey");
  // Non-string throwables still render something readable.
  expect(translateError(42, zh)).toBe("42");
});

test("a counted message picks the CLDR plural form of the active locale", () => {
  const english = translatorFor("en");
  expect(english("models.count", { count: 1 })).toBe("1 model");
  expect(english("models.count", { count: 0 })).toBe("0 models");
  expect(english("models.count", { count: 4 })).toBe("4 models");
  // Chinese has one plural category, so the plain key reads right at every count.
  const chinese = translatorFor("zh-CN");
  for (const count of [0, 1, 4]) {
    expect(chinese("models.count", { count })).toBe(`${count} 个模型`);
  }
  // With no Chinese copy, the English plural forms apply.
  const behind = translatorFor("zh-CN", zhCNWithout("models.count"));
  expect(behind("models.count", { count: 1 })).toBe("1 model");
  expect(behind("models.count", { count: 2 })).toBe("2 models");
  // A language with more plural forms than English can add them, e.g. Polish "2 modele"
  // but "5 modeli": `Partial<Messages>` accepts the forms and the copy check allows them.
  const polish: Partial<Messages> = {
    "models.count_one": "{count} model",
    "models.count_few": "{count} modele",
    "models.count_many": "{count} modeli",
  };
  expect(new Intl.PluralRules("pl").select(2)).toBe("few");
  expect(isEnglishKeyOrPluralForm("models.count_few")).toBe(true);
  expect(isEnglishKeyOrPluralForm("settings.nav.models_few")).toBe(false);
  expect(Object.keys(polish).every(isEnglishKeyOrPluralForm)).toBe(true);
  // A count on a string without plural forms still resolves the plain message.
  expect(english("settings.nav.models", { count: 3 })).toBe("Models");
});

test("the language follows the OS until the user picks one", () => {
  const cases: readonly (readonly [LocalePreference, readonly string[], AppLocale])[] = [
    // "system" (the default) follows the OS language list, most preferred first.
    ["system", ["zh-CN", "en-US"], "zh-CN"],
    ["system", ["zh-Hans-CN"], "zh-CN"],
    ["system", ["en-US", "zh-CN"], "en"],
    ["system", ["de-DE", "zh-TW"], "zh-CN"],
    ["system", [], "en"],
    // A language we do not ship reads English. "xx" is reserved for no linguistic
    // content, so registering a real language never invalidates this case.
    ["system", ["xx-XX"], "en"],
    // An explicit choice wins over the OS.
    ["en", ["zh-CN"], "en"],
    ["zh-CN", ["en-US"], "zh-CN"],
  ];
  for (const [preference, systemLanguages, expected] of cases) {
    const reason = `${preference} ${systemLanguages}`;
    expect(resolveLocale(preference, systemLanguages), reason).toBe(expected);
  }
});

test("an untouched profile is told apart from an explicit system language", () => {
  // The renderer hydrates from main only when this reads null. A stored "system" is a
  // choice and must keep following the OS, so the two states cannot collapse.
  const store = new Map<string, string>();
  const previous = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  try {
    expect(readStoredLocaleOrNull()).toBeNull();
    expect(readStoredLocale()).toBe("system");

    writeStoredLocale("system");
    expect(readStoredLocaleOrNull()).toBe("system");

    writeStoredLocale("zh-CN");
    expect(readStoredLocaleOrNull()).toBe("zh-CN");
    expect(readStoredLocale()).toBe("zh-CN");

    store.set(LOCALE_STORAGE_KEY, "fr");
    expect(readStoredLocaleOrNull()).toBeNull();
    expect(readStoredLocale()).toBe("system");
  } finally {
    (globalThis as { localStorage?: unknown }).localStorage = previous;
  }
});

test("language tags split into primary, script and region subtags", () => {
  expect(languageTagParts("zh-Hant-TW")).toEqual({ primary: "zh", script: "hant", region: "tw" });
  expect(languageTagParts("zh-CN")).toEqual({ primary: "zh", script: undefined, region: "cn" });
  expect(languageTagParts("EN-us")).toEqual({ primary: "en", script: undefined, region: "us" });
  expect(matchSystemLocale("ZH-hant")).toBe("zh-CN");
  expect(matchSystemLocale("  en-GB  ")).toBe("en");
  expect(matchSystemLocale("de-DE")).toBeUndefined();
  expect(matchSystemLocale("")).toBeUndefined();
});
