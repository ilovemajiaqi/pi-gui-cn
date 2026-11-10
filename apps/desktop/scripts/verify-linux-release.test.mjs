import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const verifier = fileURLToPath(new URL("./verify-linux-release.sh", import.meta.url));

// The release verifier is a bash script, so this test needs a POSIX shell. Windows has
// none on PATH by default — Git for Windows installs bash under Git\bin, which is not
// added for non-interactive processes. Probe for the capability instead of assuming
// the host is Linux; a missing shell skips, a present one must produce the right answer.
function findBash() {
  const names = process.platform === "win32" ? ["bash.exe"] : ["bash"];
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    for (const name of names) {
      const candidate = join(directory, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  if (process.platform === "win32") {
    for (const root of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]]) {
      if (!root) continue;
      const candidate = join(root, "Git", "bin", "bash.exe");
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const bash = findBash();
const skip = bash ? false : "bash is not installed, so verify-linux-release.sh cannot run here";

function normalize(version) {
  return execFileSync(bash, [verifier, "--normalize-debian-version", version], {
    encoding: "utf8",
    // HOME is deliberately unset-looking so an accidental expansion shows up as a
    // different version rather than silently passing.
    env: { ...process.env, HOME: "/home/runner" },
  }).trimEnd();
}

test("normalizes Debian prerelease versions without expanding HOME", { skip }, () => {
  assert.equal(normalize("0.1.0-beta.33"), "0.1.0~beta.33");
});

test("leaves stable Debian versions unchanged", { skip }, () => {
  assert.equal(normalize("1.2.3"), "1.2.3");
});
