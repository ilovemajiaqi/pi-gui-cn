import { expect, test } from "@playwright/test";
import { DESKTOP_LOCALES, type DesktopLocale } from "../../contracts/ipc";
import {
  MAIN_MESSAGES,
  createMainTranslator,
  type MainMessageKey,
} from "../../electron/platform/main-messages";

/**
 * Main-process copy for native menus, dialogs and OS notifications. Both
 * tables are typed `Record<MainMessageKey, string>`, so `tsc` already rejects a
 * missing key in either locale; these checks hold that contract at runtime and
 * pin the zh-CN writing conventions. Runs in Node — no app.
 */

const locales = [...DESKTOP_LOCALES];
const english = MAIN_MESSAGES.en;
const englishKeys = Object.keys(english).sort();

function placeholders(template: string): readonly string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

/**
 * Tokens whose ASCII punctuation belongs to the name or URL rather than the
 * sentence around it. Each match is replaced by a blank so the surrounding
 * prose is still checked: a stray comma after "GitHub" is not excused just
 * because the name beside it is allowed.
 */
const technicalTokens: readonly RegExp[] = [
  // Stop at whitespace and CJK punctuation so a trailing comma stays visible.
  /https?:\/\/[^\s，。：；、）】]+/g,
  /\bpi-gui\b/gi,
  /\bGitHub\b/g,
  /\bReleases\b/g,
  /\bMCP\b/g,
];

/** `copy` with technical tokens blanked out, leaving the prose to inspect. */
function proseOf(copy: string): string {
  return technicalTokens.reduce((prose, token) => prose.replace(token, " "), copy);
}

test("every desktop locale has a main-process table over the same key set", () => {
  expect(Object.keys(MAIN_MESSAGES).sort()).toEqual([...locales].sort());
  for (const locale of locales) {
    expect(Object.keys(MAIN_MESSAGES[locale]).sort(), locale).toEqual(englishKeys);
  }
});

test("each key keeps the same placeholders in every locale", () => {
  for (const locale of locales) {
    for (const key of englishKeys) {
      const copy = MAIN_MESSAGES[locale][key as MainMessageKey];
      expect(copy.trim(), `${locale} ${key} is not empty`).not.toBe("");
      expect(placeholders(copy), `${locale} ${key} placeholders`).toEqual(
        placeholders(english[key as MainMessageKey]),
      );
    }
  }
});

test("createMainTranslator fills known placeholders and leaves unknown ones intact", () => {
  const zh = createMainTranslator("zh-CN");
  expect(zh("main.update.availableBody", { latest: "1.2.0", current: "1.1.0" })).toBe(
    "新版本 1.2.0 已发布（当前 1.1.0）。点击查看发布页。",
  );
  // A placeholder the caller does not supply stays visible instead of
  // rendering "undefined".
  expect(zh("main.update.httpStatus", {})).toBe("GitHub Releases 返回了 {status}。");
  expect(createMainTranslator("en")("main.update.youHave", { version: "1.2.0" })).toBe(
    "You have 1.2.0.",
  );
  // With no params at all the template is returned untouched.
  expect(createMainTranslator("en")("main.update.availableMessage")).toBe(
    "Version {latest} is available.",
  );
  // Numbers interpolate too.
  expect(createMainTranslator("en")("main.update.httpStatus", { status: 503 })).toBe(
    "GitHub Releases returned 503.",
  );
});

test("a locale without a table falls back to English rather than crashing", () => {
  // A typo or an unshipped locale degrades copy instead of failing main.
  // Only "en" and "zh-CN" are declared; a value outside the union models a typo.
  const unknown = createMainTranslator("fr" as unknown as DesktopLocale);
  expect(unknown("main.common.close")).toBe("Close");
  expect(unknown("main.update.youHave", { version: "1.2.0" })).toBe("You have 1.2.0.");
});

test("zh-CN uses full-width punctuation for prose", () => {
  // Half-width () , : ; inside a Chinese sentence reads as a typo. Technical
  // strings such as "pi-gui", "https://" and "GitHub" are blanked out first,
  // so only the prose punctuation remains to inspect.
  for (const key of englishKeys) {
    const copy = MAIN_MESSAGES["zh-CN"][key as MainMessageKey];
    expect(proseOf(copy), `zh-CN ${key} uses prose punctuation`).not.toMatch(/[(),:;]/);
  }
  // The specific cases that regressed: a colon after a label and a parenthetical
  // aside both take the full-width form.
  expect(MAIN_MESSAGES["zh-CN"]["main.notify.errorPrefix"]).toBe("错误：");
  expect(MAIN_MESSAGES["zh-CN"]["main.notify.warningPrefix"]).toBe("警告：");
  expect(MAIN_MESSAGES["zh-CN"]["main.mcpSignInCheckLink"]).toMatch(/：$/);
  expect(MAIN_MESSAGES["zh-CN"]["main.update.availableBody"]).toContain("（当前");
});

test("zh-CN calls the agent 智能体 instead of agent", () => {
  const finished = MAIN_MESSAGES["zh-CN"]["main.notify.agentFinished"];
  expect(finished).toContain("智能体");
  expect(finished).not.toMatch(/\bagent\b/i);
  // The English table still names it plainly.
  expect(english["main.notify.agentFinished"]).toBe("Agent finished responding");
});
