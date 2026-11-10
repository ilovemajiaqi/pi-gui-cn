import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  readJsonWithBackup,
  writeFileAtomicQueued,
} from "../../electron/persistence/atomic-file-write";

/**
 * The guarantee this module provides is not "a raw `readFile` never errors" — a
 * reader that touches the path while a replace is in flight gets a Windows
 * sharing violation, which is a transient lock rather than a broken file. The
 * guarantee is that the app's own reader, `readJsonWithBackup`, always resolves
 * to a complete previous or next version and never has to fall back to the
 * recovery backup because the primary vanished.
 */
test("keeps ui-state readable while a new version replaces it", async () => {
  const filePath = join(await mkdtemp(join(tmpdir(), "ui-state-replace-")), "ui-state.json");
  const validate = (value: unknown) => value;
  await writeFileAtomicQueued(filePath, '{"n":0}\n', validate);

  let reads = 0;
  let recovered = 0;
  let corrupted = 0;
  let undefinedValue = 0;
  let stop = false;
  const reader = (async () => {
    while (!stop) {
      const result = await readJsonWithBackup(filePath);
      reads += 1;
      if (result.recovered) recovered += 1;
      if (result.corrupted) corrupted += 1;
      if (result.value === undefined) undefinedValue += 1;
      const value = result.value as { n?: number } | undefined;
      expect(typeof value?.n).toBe("number");
    }
  })();

  for (let n = 1; n <= 30; n += 1) {
    await writeFileAtomicQueued(filePath, `{"n":${n}}\n`, validate);
  }
  stop = true;
  await reader;

  expect(reads).toBeGreaterThan(0);
  // Falling back to `.bak` is the observable symptom of the unlink-then-rename
  // window this module replaced with a retried atomic rename.
  expect(recovered).toBe(0);
  expect(corrupted).toBe(0);
  expect(undefinedValue).toBe(0);
});
