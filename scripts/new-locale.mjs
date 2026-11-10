#!/usr/bin/env node
/*
 * Scaffolds a new language for the desktop app, and reports how much of one is
 * still English.
 *
 *   node scripts/new-locale.mjs <tag> <label>         e.g. `fr "Français"`
 *   node scripts/new-locale.mjs --check [tag]         lists the copy left to translate
 *   node scripts/new-locale.mjs --check --strict      exits 1 on unfinished copy
 *
 * Every non-English catalog is a `Partial<Messages>`: a key it leaves out renders
 * the English copy. The generated catalog starts as English copy, as a template
 * for the translator. `--check` alone is a report, not a gate: it always exits 0,
 * so a missing translation never fails CI. `--strict` turns that report into a
 * gate: a missing plain key, or a value that is still byte-for-byte the English
 * copy, fails unless `i18n/allowlist.json` excuses the key with a reason.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i18nDirectory = path.join(repoRoot, "apps", "desktop", "src", "i18n");
const catalogPath = path.join(i18nDirectory, "catalog.ts");
const englishPath = path.join(i18nDirectory, "messages", "en.ts");

/** The shape `tests/unit/i18n.spec.ts` accepts: a primary subtag, then optional subtags. */
const TAG_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const PLURAL_VARIANT = /_(zero|one|two|few|many|other)$/;

const USAGE = "Usage: node scripts/new-locale.mjs <tag> <label> | --check [--strict] [tag]";

function fail(message) {
  console.error(`${message}\n`);
  console.error(USAGE);
  process.exitCode = 1;
}

/**
 * The `"key": "value"` pairs of a catalog module, ignoring comments and the
 * wrapper. Prettier wraps long entries onto a second line, so the value may sit
 * after a newline — read the file as a whole rather than line by line.
 */
const ENTRY_PATTERN =
  /^ {2}"((?:[^"\\]|\\.)*)":\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'),?$/gm;

function readEntries(source) {
  const entries = [];
  for (const match of source.matchAll(ENTRY_PATTERN)) {
    // Prettier single-quotes a value that contains a double quote.
    entries.push({ key: match[1], copy: match[2] ?? match[3], text: match[0] });
  }
  return entries;
}

/** Catalogs are emitted in the source's own layout, so the copy stays Prettier-clean. */
function asObjectEntries(entries) {
  return entries
    .map((entry) => (entry.text.endsWith(",") ? entry.text : `${entry.text},`))
    .join("\n");
}

/** "zh-CN" → "zhCN", "pt-BR" → "ptBR": the catalog import name follows the tag. */
function variableName(tag) {
  const [primary, ...subtags] = tag.split("-");
  return (
    primary.toLowerCase() +
    subtags.map((subtag) => subtag.charAt(0).toUpperCase() + subtag.slice(1)).join("")
  );
}

const allowlistPath = path.join(i18nDirectory, "allowlist.json");

/**
 * Keys a translator deliberately leaves in English, each with the reason it is not
 * prose to translate: product names, protocol names, literal syntax. Only `--strict`
 * reads it. A key excused here is excluded from the strict gate but still listed in
 * the plain report, so the report stays a full account of what reads English.
 */
function readAllowlist() {
  if (!existsSync(allowlistPath)) return new Map();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(allowlistPath, "utf8"));
  } catch (error) {
    fail(`Could not parse ${allowlistPath}: ${error.message}`);
    return new Map();
  }
  const untranslated = parsed?.untranslated;
  if (untranslated === undefined) return new Map();
  if (typeof untranslated !== "object" || untranslated === null || Array.isArray(untranslated)) {
    fail(`${allowlistPath} must shape the excuses as {"untranslated": {"<key>": "<reason>"}}.`);
    return new Map();
  }
  const reasons = new Map();
  const withoutReason = [];
  for (const [key, reason] of Object.entries(untranslated)) {
    if (typeof reason !== "string" || reason.trim() === "") withoutReason.push(key);
    else reasons.set(key, reason);
  }
  if (withoutReason.length > 0) {
    fail(
      `${allowlistPath} must give every excused key a reason. Missing: ${withoutReason.join(", ")}.`,
    );
  }
  return reasons;
}

/** Returns the number of unfinished keys, and prints them unless `strict` excuses them. */
function reportUntranslated(tag, { strict = false, allowed = new Map() } = {}) {
  const messagesPath = path.join(i18nDirectory, "messages", `${tag}.ts`);
  if (!existsSync(messagesPath)) {
    fail(`No catalog for "${tag}" at ${messagesPath}.`);
    return { pending: 0, failures: 0 };
  }
  const english = readEntries(readFileSync(englishPath, "utf8"));
  const translated = new Map(
    readEntries(readFileSync(messagesPath, "utf8")).map((entry) => [entry.key, entry.copy]),
  );
  // Plural variants (`key_one`, …) are optional per language, since the plain key
  // covers every count. A variant still holding English copy is reported, though:
  // at runtime it wins over the translated plain key.
  const plainKeys = english.filter((entry) => !PLURAL_VARIANT.test(entry.key));
  const missing = plainKeys.filter((entry) => !translated.has(entry.key));
  const untouched = english.filter((entry) => translated.get(entry.key) === entry.copy);
  const pending = missing.length + untouched.length;
  const failures = strict
    ? missing.length + untouched.filter((entry) => !allowed.has(entry.key)).length
    : 0;

  const reportedUntouched = strict
    ? untouched.filter((entry) => !allowed.has(entry.key))
    : untouched;
  const excused = strict ? untouched.filter((entry) => allowed.has(entry.key)) : [];

  if (strict) {
    if (failures === 0) {
      console.log(
        excused.length === 0
          ? `${tag}: every key is translated.`
          : `${tag}: every key is translated or excused.`,
      );
    } else {
      console.log(`${tag}: ${failures} keys still read English:`);
    }
  } else if (pending === 0) {
    console.log(`${tag}: every key is translated.`);
  } else {
    console.log(`${tag}: ${pending} keys still read English:`);
  }
  for (const entry of missing) {
    console.log(`  ${entry.key}  (missing)  ←  ${entry.copy}`);
  }
  for (const entry of reportedUntouched) {
    console.log(`  ${entry.key}  ←  ${entry.copy}`);
  }
  for (const entry of excused) {
    console.log(`  ${entry.key}  ←  ${entry.copy}  (excused: ${allowed.get(entry.key)})`);
  }
  return { pending, failures };
}

/** Every catalog other than English, by tag. */
function registeredTags() {
  return readdirSync(path.join(i18nDirectory, "messages"))
    .filter((name) => name.endsWith(".ts") && name !== "en.ts")
    .map((name) => name.slice(0, -".ts".length))
    .sort();
}

function createLocale(tag, label) {
  if (!TAG_PATTERN.test(tag)) {
    fail(`"${tag}" is not a language tag this registry accepts, e.g. "fr" or "zh-Hant".`);
    return;
  }
  if (!label.trim()) {
    fail('A label is required, written in the language itself, e.g. "Français".');
    return;
  }

  const messagesPath = path.join(i18nDirectory, "messages", `${tag}.ts`);
  if (existsSync(messagesPath)) {
    fail(`${messagesPath} already exists; translate it instead of scaffolding again.`);
    return;
  }

  const catalog = readFileSync(catalogPath, "utf8");
  if (catalog.includes(`id: "${tag}"`)) {
    fail(`"${tag}" is already registered in catalog.ts.`);
    return;
  }

  const english = readEntries(readFileSync(englishPath, "utf8"));
  if (english.length === 0) {
    fail(`Could not read any messages from ${englishPath}.`);
    return;
  }

  const name = variableName(tag);
  // Plural variants are left out: the plain key covers every count until the
  // translator adds the forms the language uses, and a copied English variant would
  // win over a translated plain key.
  const entries = asObjectEntries(english.filter((entry) => !PLURAL_VARIANT.test(entry.key)));
  const importLine = `import { ${name} } from "./messages/${tag}";`;
  const lastImport = /^import .* from "\.\/messages\/[^"]+";$/m;
  const importMatches = [...catalog.matchAll(new RegExp(lastImport, "gm"))];
  if (importMatches.length === 0) {
    fail(`Could not find a ./messages/ import in ${catalogPath}.`);
    return;
  }
  const last = importMatches[importMatches.length - 1];
  const afterImports =
    catalog.slice(0, last.index + last[0].length) +
    `\n${importLine}` +
    catalog.slice(last.index + last[0].length);

  const registryEnd = "\n] as const satisfies readonly LocaleDefinition[];";
  if (!afterImports.includes(registryEnd)) {
    fail(`Could not find the LOCALES array in ${catalogPath}.`);
    return;
  }
  const entry = [
    "  {",
    `    id: "${tag}",`,
    `    label: ${JSON.stringify(label)},`,
    `    messages: ${name},`,
    `    matchesSystemTag: (languageTag) => languageTagParts(languageTag).primary === "${tag.split("-")[0]}",`,
    "  },",
  ].join("\n");
  // Both edits are checked before either file is written, so a failure leaves nothing behind.
  writeFileSync(
    messagesPath,
    `import type { Messages } from "./en";

/*
 * ${label} copy, scaffolded from English as a template. Replace each value, and
 * delete entries you do not translate: a missing key renders the English copy.
 * \`pnpm i18n:check ${tag}\` lists what still reads English.
 */
export const ${name}: Partial<Messages> = {
${entries}
};
`,
  );

  writeFileSync(catalogPath, afterImports.replace(registryEnd, `\n${entry}${registryEnd}`));

  console.log(`Created ${messagesPath}`);
  console.log(`Registered "${tag}" in catalog.ts.`);
  console.log("");
  console.log(`Next: translate the values, then \`pnpm i18n:check ${tag}\`.`);
}

const args = process.argv.slice(2);
if (args[0] === "--check") {
  const strict = args.includes("--strict");
  const tags = args.slice(1).filter((argument) => argument !== "--strict");
  if (tags.length > 1) {
    fail("--check takes at most one tag.");
  } else {
    const allowed = strict ? readAllowlist() : new Map();
    let failures = 0;
    for (const tag of tags.length === 1 ? tags : registeredTags()) {
      failures += reportUntranslated(tag, { strict, allowed }).failures;
    }
    // The report stays advisory; only --strict turns it into a gate.
    if (strict && failures > 0) {
      console.error(`\n${failures} keys still read English. Translate them, or excuse each one`);
      console.error(`in ${path.relative(repoRoot, allowlistPath)} with a reason.`);
      process.exitCode = 1;
    }
  }
} else if (args.length >= 2) {
  createLocale(args[0], args.slice(1).join(" "));
} else {
  fail("A tag and a label are required.");
}
