import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

// This fork ships Windows builds from its own Releases page and does not
// maintain a Homebrew tap, so verify the Chinese install copy rather than the
// upstream English/Homebrew copy.
async function main() {
  const readme = await readFile(path.join(repoRoot, "README.md"), "utf8");

  assert.match(
    readme,
    /\[Releases\]\(https:\/\/github\.com\/ilovemajiaqi\/pi-gui-cn\/releases\)/,
    "README must link to this repository's Releases page",
  );
  assert.match(readme, /pi-gui-\*-x64-setup\.exe/, "README must document the NSIS installer");
  assert.match(readme, /pi-gui-\*-x64-portable\.exe/, "README must document the portable build");
  assert.match(readme, /pnpm package:win/, "README must document the Windows source build");
  assert.match(readme, /SmartScreen/, "README must explain the unsigned-build warning");
  assert.doesNotMatch(
    readme,
    /brew install --cask/,
    "This fork does not publish a Homebrew tap; do not claim one",
  );

  process.stdout.write("Install copy is aligned with the README.\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
