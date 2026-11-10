import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";

/** @typedef {keyof typeof ACTION_POLICY} ActionId */

/**
 * Every remote action is pinned to the commit SHA of a released tag. A tag
 * such as `v7` is a moving pointer: whoever controls the upstream repository
 * can retarget it at any time, and a workflow that follows the tag executes
 * whatever they point it at. The trailing comment records the human-readable
 * version so a reviewer can see what a SHA means without looking it up.
 *
 * @type {Readonly<Record<string, { sha: string; version: string }>>}
 */
const ACTION_POLICY = Object.freeze({
  "actions/checkout": { sha: "3d3c42e5aac5ba805825da76410c181273ba90b1", version: "v7.0.1" },
  "actions/setup-node": { sha: "949feb2413d6458794dcd2491c4babbbce0c15c1", version: "v7.1.0" },
  "pnpm/action-setup": { sha: "73e46992e05b19abd31f2f3c20e0e7370d762115", version: "v6.1.1" },
  "actions/upload-artifact": { sha: "cf430e030ddbb5b0abf93d22962f4752f3646cd9", version: "v7.0.2" },
  "actions/download-artifact": {
    sha: "9000827ccba6bdab643e8b6fd33ac0654aef8333",
    version: "v8.0.2",
  },
  "softprops/action-gh-release": {
    sha: "8a0cd651e5b2365bd640854a3fa5dfc70e4875f3",
    version: "v3.0.4",
  },
  "anthropics/claude-code-action": {
    sha: "4fa93a88de49bbef68b10eb15aabedf28ca0e1ed",
    version: "v1.0.271",
  },
  // CodeQL ships several entry points under one repository; each `uses:` names a
  // subpath, so every subpath needs its own pin.
  "github/codeql-action/init": {
    sha: "33d7b85da1a04171e211befe2c739303b9a4c066",
    version: "v4.39.3",
  },
  "github/codeql-action/analyze": {
    sha: "33d7b85da1a04171e211befe2c739303b9a4c066",
    version: "v4.39.3",
  },
});

const COMMIT_SHA = /^[0-9a-f]{40}$/;
const USES_LINE = /^\s*-?\s*uses:\s*(\S+)(?:\s+#\s*(.+?))?\s*$/;
const RUNTIME_SHIMS = [
  "FORCE_JAVASCRIPT_ACTIONS_TO_NODE24",
  "ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION",
];

/**
 * @param {unknown} uses
 * @returns {string | undefined}
 */
function actionIdFromUses(uses) {
  if (typeof uses !== "string") {
    return undefined;
  }
  const at = uses.lastIndexOf("@");
  return at === -1 ? uses : uses.slice(0, at);
}

/**
 * @param {unknown} uses
 * @returns {string}
 */
function refFromUses(uses) {
  if (typeof uses !== "string") {
    return "";
  }
  const at = uses.lastIndexOf("@");
  return at === -1 ? "" : uses.slice(at + 1);
}

/**
 * @param {unknown} uses
 * @param {ActionId} name
 * @returns {boolean}
 */
export function isAction(uses, name) {
  return actionIdFromUses(uses) === name;
}

/**
 * @param {unknown} uses
 * @returns {boolean}
 */
function isIgnoredUses(uses) {
  return typeof uses === "string" && (uses.startsWith("./") || uses.startsWith("docker://"));
}

/**
 * The parsed `uses` value carries no comment, so the recorded version has to be
 * read from the raw line. Without it a reviewer reading a workflow sees only a
 * forty-character hash.
 *
 * @param {string} source
 * @returns {Map<string, string>}
 */
function versionCommentsByUses(source) {
  /** @type {Map<string, string>} */
  const comments = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = USES_LINE.exec(line);
    if (!match) {
      continue;
    }
    const [, uses, comment] = match;
    if (isIgnoredUses(uses) || comments.has(uses)) {
      continue;
    }
    comments.set(uses, comment?.trim() ?? "");
  }
  return comments;
}

/**
 * @param {string} repoRoot
 * @returns {Promise<void>}
 */
export async function assertWorkflowActionPolicy(repoRoot) {
  const workflowDir = path.join(repoRoot, ".github", "workflows");
  const files = (await readdir(workflowDir))
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort();
  /** @type {string[]} */
  const violations = [];
  const seen = new Set();

  for (const file of files) {
    const relativePath = `.github/workflows/${file}`;
    const source = await readFile(path.join(workflowDir, file), "utf8");
    for (const shim of RUNTIME_SHIMS) {
      if (source.includes(shim)) {
        violations.push(`${relativePath}: must not set ${shim}`);
      }
    }

    const document = parseDocument(source, { uniqueKeys: true });
    if (document.errors.length > 0) {
      violations.push(
        `${relativePath}: invalid YAML: ${document.errors.map((error) => error.message).join("; ")}`,
      );
      continue;
    }

    const comments = versionCommentsByUses(source);
    const workflow = document.toJS();
    const jobs = workflow?.jobs ?? {};
    for (const [jobId, job] of Object.entries(jobs)) {
      const steps = Array.isArray(job?.steps) ? job.steps : [];
      const hasPnpmSetup = steps.some((step) => isAction(step?.uses, "pnpm/action-setup"));
      for (const [stepIndex, step] of steps.entries()) {
        const uses = step?.uses;
        if (uses == null) {
          continue;
        }
        const location = `${relativePath} ${jobId} step ${stepIndex}`;
        if (typeof uses !== "string") {
          violations.push(`${location}: uses must be a string`);
          continue;
        }
        if (isIgnoredUses(uses)) {
          continue;
        }

        const actionId = actionIdFromUses(uses);
        const ref = refFromUses(uses);
        const required = actionId ? ACTION_POLICY[actionId] : undefined;
        if (!required) {
          violations.push(`${location}: unknown remote action ${uses}`);
          continue;
        }
        seen.add(actionId);
        if (!COMMIT_SHA.test(ref)) {
          violations.push(
            `${location}: ${actionId} must be pinned to a commit SHA, found movable ref "${ref}"`,
          );
        } else if (ref !== required.sha) {
          violations.push(
            `${location}: expected ${actionId}@${required.sha} (${required.version}), found ${uses}`,
          );
        }
        const comment = comments.get(uses);
        if (comment !== required.version) {
          violations.push(
            `${location}: ${actionId} must carry "# ${required.version}" so reviewers can read the version`,
          );
        }
        if (actionId !== "actions/setup-node") {
          continue;
        }
        if (String(step.with?.["node-version"] ?? "") !== "22") {
          violations.push(`${location}: setup-node node-version must be 22`);
        }
        const cache = step.with?.cache;
        if (hasPnpmSetup) {
          if (cache !== "pnpm") {
            violations.push(`${location}: jobs that install pnpm must set cache: pnpm`);
          }
        } else if (cache != null) {
          violations.push(`${location}: jobs without pnpm/action-setup must omit cache`);
        }
        if (step.with?.["package-manager-cache"] != null) {
          violations.push(`${location}: do not set package-manager-cache`);
        }
      }
    }
  }

  for (const [actionId, required] of Object.entries(ACTION_POLICY)) {
    if (!seen.has(actionId)) {
      violations.push(`missing required action ${actionId}@${required.sha} (${required.version})`);
    }
  }

  if (violations.length > 0) {
    throw new Error(violations.join("\n"));
  }
}
