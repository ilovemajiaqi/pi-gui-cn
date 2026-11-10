import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogEntries, checkI18nKeys, keyHygieneErrors } from "./check-i18n-keys.mjs";

test("numbered ValueN keys are rejected", () => {
  const errors = keyHygieneErrors([
    { key: "settings.endpoints.enableValue3", value: "Enable {id}" },
  ]);
  assert.match(errors[0], /ValueN/);
});

test("keys and key segments stay short enough to be names", () => {
  const longKey = `settings.${"a".repeat(60)}`;
  const keys = keyHygieneErrors([{ key: longKey, value: "Hello" }]);
  assert.match(keys[0], /characters; keep keys under/);
  const segments = keyHygieneErrors([{ key: `settings.${"b".repeat(41)}.title`, value: "Hello" }]);
  assert.match(segments[0], /segment "b+" is 41 characters/);
  assert.deepEqual(
    keyHygieneErrors([{ key: "settings.endpoints.baseUrl", value: "Base URL" }]),
    [],
  );
});

test("space-padded values are sentence fragments unless composed", () => {
  const padded = keyHygieneErrors([
    { key: "settings.endpoints.baseUrlHint", value: "Include the " },
  ]);
  assert.match(padded[0], /sentence fragment/);
  assert.deepEqual(
    keyHygieneErrors([{ key: "threads.inContext", value: " in {context}" }]),
    [],
    "the one composed value fills an aria-label slot and carries its own spacing",
  );
});

test("the parser reads the real catalog shape", () => {
  const entries = catalogEntries(
    ['  "a.b": "First",', "  \"c.d\": 'Second',", '  "e.f": "Third"'].join("\n"),
  );
  assert.deepEqual(entries, [
    { key: "a.b", value: "First" },
    { key: "c.d", value: "Second" },
    { key: "e.f", value: "Third" },
  ]);
});

test("the real English catalog passes", () => assert.deepEqual(checkI18nKeys(process.cwd()), []));
