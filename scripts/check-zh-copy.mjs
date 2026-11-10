/*
 * Chinese copy rules the catalogs have to keep.
 *
 * Chinese prose uses full-width punctuation (`，。：；！？（）`). Half-width marks are for
 * code, paths, URLs, shortcuts and versions, where they are part of the identifier and
 * must not be widened. The rule that separates the two cases is adjacency: a half-width
 * mark touching a Chinese character is punctuation inside a sentence, so it is a typo;
 * one wrapped in Latin text or digits is part of a literal and stays.
 *
 * A second rule covers the ellipsis: Chinese uses the single `…` character, not `...`.
 *
 * This only inspects values, never keys, and the parsed entries come from the same
 * catalog reader the key guard uses.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogEntries } from "./check-i18n-keys.mjs";

const CHINESE = "apps/desktop/src/i18n/messages/zh-CN.ts";

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;

/** Half-width marks whose full-width form is the correct one between Chinese characters. */
const HALF_TO_FULL = new Map([
  [",", "，"],
  [";", "；"],
  [":", "："],
  ["?", "？"],
  ["!", "！"],
  ["(", "（"],
  [")", "）"],
  [".", "。"],
]);

/**
 * A "." that starts a file extension is part of a literal, not a sentence break:
 * `粘贴的图片.png` keeps its half-width dot. A sentence period is followed by more
 * Chinese, or ends the value — never by a short ASCII run like an extension.
 */
const EXTENSION_TAIL = /^\.[A-Za-z0-9]{1,8}$/;

/** Problems in one Chinese catalog, as `file: key: reason` lines. */
export function zhCopyErrors(entries, filename = CHINESE) {
  const errors = [];
  for (const { key, value } of entries) {
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      const full = HALF_TO_FULL.get(char);
      if (full === undefined) continue;
      const before = value[index - 1] ?? "";
      const after = value[index + 1] ?? "";
      if (!HAN.test(before) && !HAN.test(after)) continue;
      // "..." is the ellipsis rule's business, not this one.
      if (char === "." && (before === "." || after === ".")) continue;
      // `粘贴的图片.png` — the dot belongs to a file name, not a sentence.
      if (char === "." && EXTENSION_TAIL.test(value.slice(index))) continue;
      const context = value.slice(Math.max(0, index - 10), index + 11);
      errors.push(
        `${filename}: ${key}: "${char}" next to Chinese text reads "${context}"; use "${full}".`,
      );
    }
    if (value.includes("...")) {
      errors.push(`${filename}: ${key}: use the single ellipsis character "…", not "...".`);
    }
  }
  return errors;
}

/** Checks the real Chinese catalog. */
export function checkZhCopy(root = process.cwd()) {
  const chinese = readFileSync(resolve(root, CHINESE), "utf8");
  return zhCopyErrors(catalogEntries(chinese));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkZhCopy(process.cwd());
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Chinese copy punctuation passed.");
  }
}
