import { execFileSync } from "node:child_process";
import { constants, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { access } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import semver from "semver";

const requiredPackages = [
  // Keep packaging-sensitive runtime transitive deps explicit; electron-builder
  // can omit hoisted pnpm dependencies even when local development resolves them.
  "@anthropic-ai/sdk",
  "@earendil-works/chord",
  "@pi-gui/extension-ui",
  "@aws-crypto/sha256-browser",
  "@aws-crypto/sha256-js",
  "@aws-sdk/client-bedrock-runtime",
  "@aws-sdk/core",
  "@aws-sdk/credential-provider-node",
  "@aws-sdk/eventstream-handler-node",
  "@aws-sdk/middleware-eventstream",
  "@aws-sdk/middleware-websocket",
  "@aws-sdk/nested-clients",
  "@aws-sdk/signature-v4-multi-region",
  "@aws-sdk/token-providers",
  "@aws-sdk/types",
  "@aws-sdk/xml-builder",
  "@aws/lambda-invoke-store",
  "@google/genai",
  "@mistralai/mistralai",
  "@opentelemetry/api",
  "@silvia-odwyer/photon-node",
  "@smithy/core",
  "@smithy/credential-provider-imds",
  "@smithy/fetch-http-handler",
  "@smithy/is-array-buffer",
  "@smithy/node-http-handler",
  "@smithy/property-provider",
  "@smithy/shared-ini-file-loader",
  "@smithy/signature-v4",
  "@smithy/types",
  "@smithy/util-buffer-from",
  "@smithy/util-utf8",
  "@xterm/addon-clipboard",
  "@xterm/addon-fit",
  "@xterm/addon-web-links",
  "@xterm/xterm",
  "ansi-regex",
  "balanced-match",
  "bowser",
  "brace-expansion",
  "chalk",
  "cross-spawn",
  "data-uri-to-buffer",
  "diff",
  "glob",
  "highlight.js",
  "hosted-git-info",
  "http-proxy-agent",
  "https-proxy-agent",
  "ignore",
  "jiti",
  "lru-cache",
  "mime-types",
  "minimatch",
  "node-pty",
  "openai",
  "parse5",
  "parse5-htmlparser2-tree-adapter",
  "path-key",
  "partial-json",
  "proper-lockfile",
  "proxy-agent",
  "retry",
  "semver",
  "shebang-command",
  "strip-ansi",
  "tslib",
  "typebox",
  "undici",
  "which",
  "yaml",
  "yargs",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptDir, "..");
const packagePlatform = (process.env.PI_APP_PACKAGE_PLATFORM ?? process.platform)
  .trim()
  .toLowerCase();
const releaseDir = path.resolve(desktopDir, process.env.PI_APP_TEST_RELEASE_DIR ?? "release");
const asarPath = resolveAsarPath(releaseDir, packagePlatform);
const notificationHelperPath =
  packagePlatform === "darwin"
    ? path.join(
        releaseDir,
        "mac-arm64",
        "pi-gui.app",
        "Contents",
        "MacOS",
        "pi-gui-notification-status-helper",
      )
    : undefined;
const pnpmBinary = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const piCodingAgentPackageName = "@earendil-works/pi-coding-agent";
const requiredPiCodingAgentVersion = "1.4.0";
const modelChecks = [
  ...["openai", "openai-codex", "github-copilot"].flatMap((provider) =>
    ["sol", "luna"].map((variant) => ({
      provider,
      id: `gpt-6-${variant}`,
      reason: "Pi 0.87.1 GPT-6 support",
      requireReasoning: true,
      requireImageInput: true,
      requireMaxThinking: true,
    })),
  ),
  ...["openai", "openai-codex"].map((provider) => ({
    provider,
    id: "gpt-6.1-sol",
    reason: "Pi 0.99.1 GPT-6.1 Sol support",
    requireReasoning: true,
    requireImageInput: true,
    requireMaxThinking: true,
  })),
  ...["luna", "sol", "terra"].map((variant) => ({
    provider: "openai-codex",
    id: `gpt-5.6-${variant}`,
    reason: "GPT 5.6 Codex support",
    requireReasoning: true,
    requireImageInput: true,
    requireMaxThinking: true,
  })),
  {
    provider: "anthropic",
    id: "claude-opus-4-7",
    reason: "issue #12 Opus 4.7 visibility",
    requireReasoning: true,
    requireImageInput: true,
  },
  {
    provider: "meta",
    id: "muse-wonder-1.0",
    reason: "issue #288 Muse Wonder visibility",
    requireReasoning: true,
    requireImageInput: true,
    requireMaxThinking: true,
  },
  {
    provider: "zai",
    id: "glm-5.3",
    reason: "issue #12 GLM visibility",
    requireReasoning: true,
    requireImageInput: false,
  },
];
const packagedRuntimeImportChecks = [
  ["@pi-gui", "extension-ui", "dist", "transport.js"],
  ["@pi-gui", "extension-ui", "dist", "frame-bridge.js"],
  // Import implementations: provider descriptors can defer loading their SDKs.
  ["@earendil-works", "pi-ai", "dist", "api", "google-generative-ai.js"],
  ["@earendil-works", "pi-ai", "dist", "api", "anthropic-messages.js"],
  ["@earendil-works", "pi-ai", "dist", "api", "openai-responses.js"],
  ["@earendil-works", "pi-ai", "dist", "bedrock-provider.js"],
  // pi loads its MCP client and code mode executor only when a session needs them.
  ["@earendil-works", "pi-coding-agent", "dist", "extensions", "mcp", "runtime.js"],
  ["@earendil-works", "pi-coding-agent", "dist", "extensions", "codemode", "execute.js"],
  ["proxy-agent", "dist", "index.js"],
];

if (!existsSync(asarPath)) {
  throw new Error(`Packaged app.asar not found at ${asarPath}. Run the packaging step first.`);
}

if (notificationHelperPath && !existsSync(notificationHelperPath)) {
  throw new Error(`Packaged app is missing notification helper: ${notificationHelperPath}`);
}

const extractedDir = mkdtempSync(path.join(tmpdir(), "pi-gui-packaged-runtime-"));
let cleanupError;
try {
  execFileSync(pnpmBinary, ["exec", "asar", "extract", asarPath, extractedDir], {
    cwd: desktopDir,
    stdio: "pipe",
    shell: process.platform === "win32",
  });

  verifyRequiredPackages(extractedDir);
  verifyPiDependencyVersions(extractedDir);
  verifyPackagedDependencyGraph(extractedDir);
  await verifyPackagedPiRuntime(extractedDir);
  await verifyPackagedRuntimeImports(extractedDir);
  await verifyNativeNodePty(asarPath);
} finally {
  try {
    rmSync(extractedDir, {
      recursive: true,
      force: true,
      maxRetries: process.platform === "win32" ? 5 : 0,
      retryDelay: process.platform === "win32" ? 200 : 0,
    });
  } catch (error) {
    if (process.platform === "win32") {
      console.warn(`Warning: could not remove temp dir ${extractedDir}: ${error.message}`);
    } else {
      cleanupError = error;
    }
  }
}

// Preserve a verification failure if cleanup also failed.
if (cleanupError) throw cleanupError;

console.log(`Verified packaged runtime dependencies in ${asarPath}`);

function resolveAsarPath(releaseDir, packagePlatform) {
  if (packagePlatform === "darwin") {
    return path.join(releaseDir, "mac-arm64", "pi-gui.app", "Contents", "Resources", "app.asar");
  }

  if (packagePlatform === "linux") {
    const unpackedAsarPath = readdirSync(releaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^linux(?:-[\w]+)?-unpacked$/.test(entry.name))
      .map((entry) => path.join(releaseDir, entry.name, "resources", "app.asar"))
      .find((candidatePath) => existsSync(candidatePath));

    if (unpackedAsarPath) {
      return unpackedAsarPath;
    }

    return path.join(releaseDir, "linux-unpacked", "resources", "app.asar");
  }

  if (packagePlatform === "win32") {
    const unpackedAsarPath = readdirSync(releaseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^win(?:-[\w]+)?-unpacked$/.test(entry.name))
      .map((entry) => path.join(releaseDir, entry.name, "resources", "app.asar"))
      .find((candidatePath) => existsSync(candidatePath));

    if (unpackedAsarPath) {
      return unpackedAsarPath;
    }

    return path.join(releaseDir, "win-unpacked", "resources", "app.asar");
  }

  throw new Error(`Unsupported packaged runtime dependency target: ${packagePlatform}`);
}

function verifyRequiredPackages(extractedDir) {
  const missingPackages = requiredPackages.filter(
    (packageName) => !existsSync(path.join(extractedDir, "node_modules", packageName)),
  );

  if (missingPackages.length > 0) {
    throw new Error(`Packaged app is missing runtime dependencies: ${missingPackages.join(", ")}`);
  }
}

function verifyPiDependencyVersions(extractedDir) {
  const mismatches = [];
  // Security overrides in the root manifest intentionally supersede upstream
  // ranges (e.g. undici ^8.12.4 over pi's pinned 8.10.2); validate against the
  // override instead of failing on the original range forever.
  const rootManifest = JSON.parse(
    readFileSync(path.resolve(desktopDir, "..", "..", "package.json"), "utf8"),
  );
  const dependencyOverrides = rootManifest.pnpm?.overrides ?? {};
  // Validate the full required graph using the versions Node would resolve.
  // Hoisted packaging can include a dependency but lose its required nested version.
  const pending = [
    piCodingAgentPackageName,
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
    "@earendil-works/pi-tui",
    "@earendil-works/chord",
  ].map((packageName) => path.join(extractedDir, "node_modules", packageName, "package.json"));
  const visited = new Set();
  while (pending.length > 0) {
    const packageFile = pending.pop();
    if (visited.has(packageFile)) continue;
    visited.add(packageFile);
    const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
    const resolveFromPackage = createRequire(packageFile);
    for (const [dependency, requiredVersion] of Object.entries(manifest.dependencies ?? {})) {
      const dependencyFile = (resolveFromPackage.resolve.paths(dependency) ?? [])
        // Never let dependencies installed outside the extracted app hide an omission.
        .filter((directory) => directory.startsWith(`${extractedDir}${path.sep}`))
        .map((directory) => path.join(directory, dependency, "package.json"))
        .find((candidate) => existsSync(candidate));
      const actualVersion = dependencyFile
        ? JSON.parse(readFileSync(dependencyFile, "utf8")).version
        : undefined;
      const overrideRange = dependencyOverrides[dependency];
      const expectedRange = overrideRange ?? requiredVersion;
      if (!actualVersion || !semver.satisfies(actualVersion, expectedRange)) {
        mismatches.push(
          `${path.relative(extractedDir, packageFile)} (${manifest.version}) requires ${dependency}@${requiredVersion}${overrideRange ? ` (pnpm override ${overrideRange})` : ""}; packaged resolution is ${actualVersion ?? "missing"}`,
        );
      }
      if (dependencyFile) pending.push(dependencyFile);
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`Packaged Pi dependency versions do not match:\n${mismatches.join("\n")}`);
  }
}

// Compare every production dependency edge inside the packaged tree against
// the workspace install the asar was collected from: the packaged resolution
// must be faithful to the workspace — the same packages resolvable at the same
// versions. This catches both pnpm-collector loss classes (packages dropped
// entirely, like the startup-crashing "Cannot find module 'isexe'", and nested
// conflicting versions falling back to an incompatible hoisted major) while
// tolerating upstream manifest drift that the workspace install resolves the
// same way.
function verifyPackagedDependencyGraph(extractedDir) {
  const workspaceModules = path.resolve(desktopDir, "..", "..", "node_modules");
  if (!existsSync(path.join(workspaceModules, "node-pty"))) {
    console.warn(
      `Warning: workspace install not found at ${workspaceModules}; skipping packaged dependency graph check`,
    );
    return;
  }
  const problems = [];

  function collectPackageDirs(dir, packages) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".bin" || entry.name.startsWith(".")) continue;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory() && (entry.name === "node_modules" || entry.name.startsWith("@"))) {
        // node_modules container or scoped group: the packages are inside.
        collectPackageDirs(entryPath, packages);
        continue;
      }
      if (!entry.isDirectory() || !existsSync(path.join(entryPath, "package.json"))) continue;
      packages.push(entryPath);
      // The package may carry its own nested node_modules (hoisted conflicts).
      collectPackageDirs(entryPath, packages);
    }
  }

  function resolveWithin(startDir, dependency, limitDir) {
    let cursor = startDir;
    while (true) {
      const candidate = path.join(cursor, "node_modules", ...dependency.split("/"));
      if (existsSync(candidate)) return candidate;
      if (cursor === limitDir) return undefined;
      const parent = path.dirname(cursor);
      if (parent === cursor) return undefined;
      cursor = parent;
    }
  }

  function readVersion(packageDir) {
    return JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8")).version;
  }

  const packages = [];
  collectPackageDirs(path.join(extractedDir, "node_modules"), packages);

  for (const packageDir of packages) {
    const relative = path.relative(extractedDir, packageDir);
    const workspacePackageDir = path.join(workspaceModules, relative);
    if (!existsSync(path.join(workspacePackageDir, "package.json"))) continue;
    const manifest = JSON.parse(readFileSync(path.join(packageDir, "package.json"), "utf8"));
    if (readVersion(workspacePackageDir) !== manifest.version) {
      // Not the same install; the workspace tree drifted from the package.
      continue;
    }
    const optional = new Set(Object.keys(manifest.optionalDependencies ?? {}));
    for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
      if (optional.has(dependency)) continue;
      // Type-only packages are never required at runtime.
      if (dependency.startsWith("@types/")) continue;
      const workspaceResolved = resolveWithin(workspacePackageDir, dependency, workspaceModules);
      if (!workspaceResolved) continue; // nothing to be faithful to
      const packagedResolved = resolveWithin(packageDir, dependency, extractedDir);
      if (!packagedResolved) {
        problems.push(
          `${relative} (${manifest.version}) resolves ${dependency}@${range} to ${path.relative(workspaceModules, workspaceResolved)} in the workspace install, but the packaged app cannot resolve it`,
        );
        continue;
      }
      const workspaceVersion = readVersion(workspaceResolved);
      const packagedVersion = readVersion(packagedResolved);
      if (workspaceVersion !== packagedVersion) {
        problems.push(
          `${relative} (${manifest.version}) resolves ${dependency}@${range} to ${workspaceVersion} in the workspace install but ${packagedVersion} in the packaged app`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Packaged dependency graph diverges from the workspace install:\n${problems.join("\n")}`,
    );
  }
}

async function verifyPackagedPiRuntime(extractedDir) {
  const packageJsonPath = path.join(
    extractedDir,
    "node_modules",
    ...piCodingAgentPackageName.split("/"),
    "package.json",
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  if (packageJson.version !== requiredPiCodingAgentVersion) {
    throw new Error(
      `Packaged app has ${piCodingAgentPackageName} ${packageJson.version}; expected ${requiredPiCodingAgentVersion}.`,
    );
  }

  const runtimeEntry = path.join(
    extractedDir,
    "node_modules",
    ...piCodingAgentPackageName.split("/"),
    "dist",
    "index.js",
  );
  const { ModelRuntime } = await import(pathToFileURL(runtimeEntry).href);
  const authDir = mkdtempSync(path.join(tmpdir(), "pi-gui-packaged-runtime-models-"));
  const runtime = await ModelRuntime.create({
    authPath: path.join(authDir, "auth.json"),
    modelsPath: null,
    refreshOnCreate: false,
  });
  const models = runtime.getModels();
  for (const check of modelChecks) {
    const model = models.find(
      (entry) => entry.provider === check.provider && entry.id === check.id,
    );
    const modelKey = `${check.provider}/${check.id}`;
    if (!model) {
      throw new Error(`Packaged Pi runtime does not expose ${modelKey} for ${check.reason}.`);
    }
    if (check.requireReasoning && !model.reasoning) {
      throw new Error(`Packaged ${modelKey} is missing reasoning support for ${check.reason}.`);
    }
    if (check.requireImageInput && !model.input.includes("image")) {
      throw new Error(`Packaged ${modelKey} is missing image input support for ${check.reason}.`);
    }
    if (check.requireMaxThinking && model.thinkingLevelMap?.max !== "max") {
      throw new Error(`Packaged ${modelKey} is missing max thinking support for ${check.reason}.`);
    }
  }
}

async function verifyPackagedRuntimeImports(extractedDir) {
  for (const modulePath of packagedRuntimeImportChecks) {
    const runtimeEntry = path.join(extractedDir, "node_modules", ...modulePath);
    await import(pathToFileURL(runtimeEntry).href);
  }
}

async function verifyNativeNodePty(asarPath) {
  const unpackedResourcesDir = `${asarPath}.unpacked`;
  const nodePtyDir = path.join(unpackedResourcesDir, "node_modules", "node-pty");
  if (!existsSync(nodePtyDir) || !hasFileWithExtension(nodePtyDir, ".node")) {
    throw new Error(`Packaged app is missing unpacked node-pty native module under ${nodePtyDir}`);
  }
  if (packagePlatform !== "darwin") {
    return;
  }
  const helperPath = findFileNamed(nodePtyDir, "spawn-helper");
  if (!helperPath) {
    throw new Error(`Packaged app is missing unpacked node-pty spawn-helper under ${nodePtyDir}`);
  }
  await access(helperPath, constants.X_OK);
}

function hasFileWithExtension(directoryPath, extension) {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isFile() && entry.name.endsWith(extension)) {
      return true;
    }
    if (entry.isDirectory() && hasFileWithExtension(entryPath, extension)) {
      return true;
    }
  }
  return false;
}

function findFileNamed(directoryPath, fileName) {
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isFile() && entry.name === fileName) {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const nestedMatch = findFileNamed(entryPath, fileName);
      if (nestedMatch) {
        return nestedMatch;
      }
    }
  }
  return undefined;
}
