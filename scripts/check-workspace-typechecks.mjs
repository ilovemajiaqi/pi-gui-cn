import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { relativePosix } from "./posix-path.mjs";

// `npm_execpath` is only exported by npm and by pnpm's own script runner. Other launchers that
// still set `npm_lifecycle_event` (the WinGet `pnpm.ps1` shim, `corepack pnpm run`, some CI
// wrappers) run the script with an empty value, so resolve the package manager from the
// workspace instead of failing the guard. CI passes the executable explicitly.
function resolvePnpmPath(root, explicit) {
  if (explicit) return explicit;
  const guardRoot = path.dirname(fileURLToPath(import.meta.url));
  for (const base of [root, path.dirname(guardRoot)]) {
    const localPnpm = path.join(base, "node_modules", "pnpm", "bin", "pnpm.cjs");
    if (existsSync(localPnpm)) return localPnpm;
  }
  return undefined;
}

export function checkWorkspaceTypechecks(root, pnpmPath) {
  root = realpathSync(root);
  const resolved = resolvePnpmPath(root, pnpmPath);
  if (!resolved) {
    throw new Error(
      "Cannot locate pnpm: set npm_execpath or install pnpm in node_modules so this guard can list workspaces.",
    );
  }
  const projects = JSON.parse(
    execFileSync(process.execPath, [resolved, "-r", "list", "--depth", "-1", "--json"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  const workspaces = projects.filter((project) => realpathSync(project.path) !== root);
  if (!workspaces.length) throw new Error("No workspaces discovered; refusing to skip typechecks.");
  const failures = [];
  for (const workspace of workspaces) {
    const manifest = JSON.parse(readFileSync(path.join(workspace.path, "package.json"), "utf8"));
    if (typeof manifest.scripts?.typecheck !== "string" || !manifest.scripts.typecheck.trim()) {
      failures.push(
        `${relativePosix(root, workspace.path)}/package.json: missing scripts.typecheck. Add a typecheck command so this workspace participates in CI.`,
      );
    }
  }
  return { failures, count: workspaces.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkWorkspaceTypechecks(
    fileURLToPath(new URL("../", import.meta.url)),
    process.env.npm_execpath,
  );
  if (result.failures.length) {
    console.error(result.failures.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`All ${result.count} workspaces declare typecheck commands.`);
  }
}
