/*
 * Key hygiene for the locale catalogs.
 *
 * `t()` only accepts literals from `messages/en.ts`, so a key is an API name: it should
 * say where the copy lives (`settings.endpoints.baseUrl`) rather than repeat the English
 * sentence in camelCase (`ui.lowercaseLettersDigitsAndDashesCannotBeChangedLater`).
 * The rules below are the ones the plan pinned down, and they are mechanical enough to
 * guard:
 *
 *   - no `ValueN` numbered keys (a key that has to be numbered was never named);
 *   - no key longer than 60 characters, and no single dotted segment over 40 — past
 *     that a key is a sentence in disguise;
 *   - no value padded with spaces, which is what a sentence fragment looks like. Fragments
 *     are untranslatable: they freeze word order. Inline markup goes through
 *     `interpolateNodes()` instead, with the whole sentence in one entry.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENGLISH = "apps/desktop/src/i18n/messages/en.ts";

const MAX_KEY_LENGTH = 60;
const MAX_SEGMENT_LENGTH = 40;

/**
 * The one composed value left in the catalogs: it fills the `{context}` slot of the
 * pin/archive aria labels, and both locales own the spacing around it, so it is a
 * deliberate composition rather than a fragment waiting to be merged.
 */
const COMPOSED_VALUES = new Map([
  ["threads.inContext", "Fills the {context} slot of the threads aria labels."],
]);

const ENTRY_PATTERN =
  /^ {2}"((?:[^"\\]|\\.)*)":\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'),?$/gm;

export function catalogEntries(source) {
  return [...source.matchAll(ENTRY_PATTERN)].map((match) => ({
    key: match[1],
    value: match[2] ?? match[3],
  }));
}

/** Problems in one catalog's key set, as `file: key: reason` lines. */
export function keyHygieneErrors(entries, filename = ENGLISH) {
  const errors = [];
  for (const { key, value } of entries) {
    if (/Value\d+$/.test(key)) {
      errors.push(
        `${filename}: ${key}: numbered "ValueN" keys are not names; say what the copy is.`,
      );
    }
    if (key.length > MAX_KEY_LENGTH) {
      errors.push(
        `${filename}: ${key}: ${key.length} characters; keep keys under ${MAX_KEY_LENGTH}.`,
      );
    }
    const overlong = key.split(".").find((segment) => segment.length > MAX_SEGMENT_LENGTH);
    if (overlong) {
      errors.push(
        `${filename}: ${key}: segment "${overlong}" is ${overlong.length} characters; keep segments under ${MAX_SEGMENT_LENGTH}.`,
      );
    }
    const padded = /^\s/.test(value) || /\s$/.test(value);
    if (padded && !COMPOSED_VALUES.has(key)) {
      errors.push(
        `${filename}: ${key}: value is space-padded, so it is a sentence fragment; keep the whole sentence in one entry and pass markup through interpolateNodes().`,
      );
    }
  }
  return errors;
}

/** Checks every English-derived expectation against the real catalog. */
export function checkI18nKeys(root = process.cwd()) {
  const english = readFileSync(resolve(root, ENGLISH), "utf8");
  return keyHygieneErrors(catalogEntries(english));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkI18nKeys(process.cwd());
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Locale key hygiene passed.");
  }
}
