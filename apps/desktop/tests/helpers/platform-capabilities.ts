/**
 * Runtime capability probes for behavior the host OS or the host's Git
 * configuration genuinely cannot provide.
 *
 * These are not flake escapes. A test that asserts symlink review, an executable
 * bit, or a tab in a filename is asserting something Windows refuses at the
 * filesystem level, so the honest outcome is a stated skip on the platform that
 * cannot represent it — never a retry, a raised timeout, or a green assertion
 * that proves nothing. Probe instead of branching on `process.platform`: what
 * matters is the capability, and a Windows host with a permissive Git config or
 * a Linux host without symlink permission should get the real assertion.
 *
 * Call the probes from `test.beforeAll` and use the recorded result with
 * `test.skip(flag, reason)` inside the test body.
 */

import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

async function withScratch<T>(probe: (directory: string) => Promise<T>): Promise<T | undefined> {
  const directory = await mkdtemp(join(tmpdir(), "pi-gui-capability-"));
  try {
    return await probe(directory);
  } catch {
    return undefined;
  } finally {
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

/**
 * Whether this host can create symbolic links without elevation. Windows needs
 * Developer Mode or an elevated shell, so symlink review fixtures cannot be
 * built on a default Windows account.
 */
export function canCreateSymlinks(): Promise<boolean> {
  return withScratch(async (directory) => {
    const target = join(directory, "target.txt");
    await writeFile(target, "target\n");
    await symlink(target, join(directory, "link"));
    return true;
  }).then((result) => result === true);
}

/**
 * Whether this host's filesystem accepts a filename containing a tab. NTFS
 * rejects Windows' reserved characters, so pathological-path fixtures cannot be
 * materialized there even though Git itself can track such names.
 */
export function canUseTabInFileName(): Promise<boolean> {
  return withScratch(async (directory) => {
    await writeFile(join(directory, `tab\tname.txt`), "content\n");
    return true;
  }).then((result) => result === true);
}

/**
 * Whether a fresh repository on this host records the executable bit. Windows
 * defaults `core.filemode` to false, so `chmod` never changes the tracked mode
 * and a mode-change assertion has nothing to observe.
 */
export async function recordsExecutableBit(): Promise<boolean> {
  const recorded = await withScratch(async (directory) => {
    await execute("git", ["init", "-q", "-b", "main"], { cwd: directory });
    const { stdout } = await execute("git", ["config", "--get", "core.filemode"], {
      cwd: directory,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
    });
    return stdout.trim();
  });
  return recorded === "true";
}

export const symlinkUnsupportedReason =
  "This host cannot create symbolic links without elevation, so the symlink fixture is unavailable.";
export const tabFileNameUnsupportedReason =
  "This filesystem rejects a tab in a filename, so the pathological-path fixture cannot be created.";
export const executableBitUnsupportedReason =
  "This host's Git records no executable bit (core.filemode=false), so a mode change is not observable.";
