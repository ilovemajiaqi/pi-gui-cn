import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertWorkflowActionPolicy, isAction } from "./workflow-action-policy.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

const CHECKOUT = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";
const PNPM = "pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115 # v6.1.1";
const SETUP_NODE = "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0";
const UPLOAD = "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2";
const DOWNLOAD = "actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2";
const RELEASE = "softprops/action-gh-release@8a0cd651e5b2365bd640854a3fa5dfc70e4875f3 # v3.0.4";
const CLAUDE = "anthropics/claude-code-action@4fa93a88de49bbef68b10eb15aabedf28ca0e1ed # v1.0.271";
const CODEQL_INIT = "github/codeql-action/init@33d7b85da1a04171e211befe2c739303b9a4c066 # v4.39.3";
const CODEQL_ANALYZE =
  "github/codeql-action/analyze@33d7b85da1a04171e211befe2c739303b9a4c066 # v4.39.3";

test("isAction matches the action name and ignores the ref", () => {
  assert.equal(isAction(CHECKOUT, "actions/checkout"), true);
  assert.equal(isAction("actions/upload-artifact@v4", "actions/upload-artifact"), true);
  assert.equal(isAction(RELEASE, "actions/upload-artifact"), false);
  assert.equal(isAction(undefined, "actions/upload-artifact"), false);
});

test("the repository workflows pin every action to a released commit", async () => {
  await assertWorkflowActionPolicy(repoRoot);
});

test("valid seven-action corpus passes", async () => {
  await assertWorkflowActionPolicy(await writeFixture(validWorkflow()));
});

test("a moving major tag is rejected", async () => {
  const root = await writeFixture(validWorkflow().replace(CHECKOUT, "actions/checkout@v7"));
  await assert.rejects(
    () => assertWorkflowActionPolicy(root),
    /actions\/checkout must be pinned to a commit SHA/,
  );
});

test("a full version tag is rejected too", async () => {
  const root = await writeFixture(validWorkflow().replace(CHECKOUT, "actions/checkout@v7.0.1"));
  await assert.rejects(
    () => assertWorkflowActionPolicy(root),
    /actions\/checkout must be pinned to a commit SHA/,
  );
});

test("a SHA for an older release fails", async () => {
  const root = await writeFixture(
    validWorkflow().replace(
      CHECKOUT,
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0",
    ),
  );
  await assert.rejects(() => assertWorkflowActionPolicy(root), /expected actions\/checkout@/);
});

test("download-artifact must pair with upload-artifact as v8", async () => {
  const root = await writeFixture(
    validWorkflow().replace(
      DOWNLOAD,
      "actions/download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131 # v7.0.0",
    ),
  );
  await assert.rejects(
    () => assertWorkflowActionPolicy(root),
    /expected actions\/download-artifact@/,
  );
});

test("a pinned SHA without its version comment fails", async () => {
  const root = await writeFixture(
    validWorkflow().replace(CHECKOUT, "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1"),
  );
  await assert.rejects(() => assertWorkflowActionPolicy(root), /must carry "# v7\.0\.1"/);
});

test("a version comment that does not match the SHA fails", async () => {
  const root = await writeFixture(validWorkflow().replace(/# v7\.0\.1/g, "# v7.0.0"));
  await assert.rejects(() => assertWorkflowActionPolicy(root), /must carry "# v7\.0\.1"/);
});

test("unknown remote actions fail closed", async () => {
  const root = await writeFixture(`${validWorkflow()}      - uses: actions/cache@v4
`);
  await assert.rejects(() => assertWorkflowActionPolicy(root), /unknown remote action/);
});

test("setup-node must keep application Node 22", async () => {
  const root = await writeFixture(validWorkflow().replace("node-version: 22", "node-version: 24"));
  await assert.rejects(() => assertWorkflowActionPolicy(root), /node-version must be 22/);
});

test("jobs that install pnpm must cache pnpm and jobs that do not must omit cache", async () => {
  const missingCache = await writeFixture(validWorkflow().replace("\n          cache: pnpm", ""));
  await assert.rejects(() => assertWorkflowActionPolicy(missingCache), /must set cache: pnpm/);

  const extraCache = await writeFixture(
    validWorkflow().replace(
      `  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: ${CHECKOUT}
      - uses: ${SETUP_NODE}
        with:
          node-version: 22
`,
      `  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: ${CHECKOUT}
      - uses: ${SETUP_NODE}
        with:
          node-version: 22
          cache: pnpm
`,
    ),
  );
  await assert.rejects(() => assertWorkflowActionPolicy(extraCache), /must omit cache/);
});

test("runtime shims are rejected", async () => {
  const root = await writeFixture(`name: shim
on: push
env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: ${CHECKOUT}
      - uses: ${PNPM}
      - uses: ${SETUP_NODE}
        with:
          node-version: 22
          cache: pnpm
      - uses: ${UPLOAD}
        with:
          path: out
      - uses: ${DOWNLOAD}
        with:
          name: out
      - uses: \n      - uses: \n      - uses: \n      - uses: \n`);
  await assert.rejects(
    () => assertWorkflowActionPolicy(root),
    /FORCE_JAVASCRIPT_ACTIONS_TO_NODE24/,
  );
});

function validWorkflow() {
  return `name: valid
on: push
jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: ${CHECKOUT}
      - uses: ${PNPM}
      - uses: ${SETUP_NODE}
        with:
          node-version: 22
          cache: pnpm
      - uses: ${UPLOAD}
        with:
          path: out
      - uses: ${DOWNLOAD}
        with:
          name: out
      - uses: ${RELEASE}
      - uses: ${CLAUDE}
      - uses: ${CODEQL_INIT}
        with:
          languages: javascript-typescript
      - uses: ${CODEQL_ANALYZE}
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: ${CHECKOUT}
      - uses: ${SETUP_NODE}
        with:
          node-version: 22
`;
}

/**
 * @param {string} workflow
 */
async function writeFixture(workflow) {
  const root = await mkdtemp(path.join(tmpdir(), "pi-gui-action-policy-"));
  await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
  await writeFile(path.join(root, ".github", "workflows", "ci.yml"), workflow);
  return root;
}
