import { expect, test } from "@playwright/test";
import { formatRelativeTime, titleCase } from "../../src/lib/string-utils";

/**
 * These strings are built at render time, so they never passed through the message
 * catalogue and their suffixes used to be hardcoded English. Pin both locales: the
 * point of the change is that a Chinese window shows Chinese times.
 */

/** An ISO timestamp `agoMs` in the past, relative to the real clock the function reads. */
function ago(agoMs: number): string {
  return new Date(Date.now() - agoMs).toISOString();
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test("titleCase splits on the separators the catalog keys use", () => {
  expect(titleCase("gpt-5-codex")).toBe("Gpt 5 Codex");
  expect(titleCase("zh_CN")).toBe("Zh CN");
  expect(titleCase("plain")).toBe("Plain");
});

test("relative times are formatted in the caller's locale", () => {
  expect(formatRelativeTime(ago(5 * MINUTE), "zh-CN")).toBe("5分钟前");
  expect(formatRelativeTime(ago(3 * HOUR), "zh-CN")).toBe("3小时前");
  expect(formatRelativeTime(ago(2 * DAY), "zh-CN")).toBe("前天");
  // English keeps the compact shape the sidebar was designed around.
  expect(formatRelativeTime(ago(5 * MINUTE), "en")).toMatch(/ago$/);
});

test("a Chinese timestamp contains no Latin unit letters", () => {
  for (const offset of [0, 5 * MINUTE, 3 * HOUR, 2 * DAY, 10 * DAY, 90 * DAY, 400 * DAY]) {
    const label = formatRelativeTime(ago(offset), "zh-CN");
    expect(label, `${offset}ms`).not.toMatch(/[A-Za-z]/);
  }
});

test("missing and unparseable timestamps fall through instead of throwing", () => {
  expect(formatRelativeTime("", "zh-CN")).toBe("");
  expect(formatRelativeTime("not a date", "zh-CN")).toBe("not a date");
});

test("a future timestamp never renders as a negative age", () => {
  const future = new Date(Date.now() + HOUR).toISOString();
  expect(formatRelativeTime(future, "zh-CN")).toBe("现在");
});
