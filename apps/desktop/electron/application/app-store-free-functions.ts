/**
 * Free functions that used to live at the bottom of app-store.ts.
 *
 * None of these touch store state: they read their arguments and return a value.
 * They were the easiest 250 lines to move out, and moving them first proved the
 * extraction pattern (a plain module imported by the store) before anything with
 * real state moved, and made them directly testable.
 */
import type { SessionCatalogEntry } from "@pi-gui/catalogs";
import type {
  ModelSettingsSnapshot,
  RuntimeSettingsSnapshot,
  RuntimeSnapshot,
} from "@pi-gui/session-driver/runtime-types";
import { SessionLeasedError } from "@pi-gui/pi-sdk-driver";
import { readFile, stat } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { join, sep } from "node:path";

/** Return `record` with `key` set, or with the key removed when `value` is undefined. */
export function updateRecordValue<T>(
  record: Readonly<Record<string, T>>,
  key: string,
  value: T | undefined,
): Readonly<Record<string, T>> {
  if (value === undefined) {
    if (!(key in record)) {
      return record;
    }

    const { [key]: _removed, ...rest } = record;
    return rest;
  }

  if (record[key] === value) {
    return record;
  }

  return {
    ...record,
    [key]: value,
  };
}

/** Project a model-settings snapshot onto a runtime snapshot, keeping unknown fields. */
export function applyModelSettingsSnapshot(
  runtime: RuntimeSnapshot,
  settings: ModelSettingsSnapshot,
): RuntimeSnapshot {
  return {
    ...runtime,
    settings: {
      ...runtime.settings,
      ...(settings.defaultProvider
        ? { defaultProvider: settings.defaultProvider }
        : { defaultProvider: undefined }),
      ...(settings.defaultModelId
        ? { defaultModelId: settings.defaultModelId }
        : { defaultModelId: undefined }),
      ...(settings.defaultThinkingLevel
        ? { defaultThinkingLevel: settings.defaultThinkingLevel }
        : { defaultThinkingLevel: undefined }),
      enabledModelPatterns: [...settings.enabledModelPatterns],
    },
  };
}

/**
 * Convert an error into the message shown in `lastError`. A SessionLeasedError
 * means another live pi surface holds the session file, so binding a runtime is
 * refused to avoid forking the conversation — turn its raw internal string into
 * a user-readable explanation of who holds it and what to do.
 */
export function describeStoreError(error: unknown): string {
  if (isSessionLeasedError(error)) {
    const { holder } = error;
    const where = holder.surface === "pi-cli" ? "the pi CLI" : "another pi instance";
    // A holder on this machine keeps its lease while it runs; one elsewhere
    // may have crashed, and its lease then expires after a few minutes.
    const next =
      holder.hostname === hostname() ? "Close it there" : "Close it there or wait a few minutes";
    return `This session is currently open in ${where} (pid ${holder.pid} on host ${holder.hostname}). ${next} to continue here.`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function isSessionLeasedError(error: unknown): error is SessionLeasedError {
  return (
    error instanceof SessionLeasedError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "SESSION_LEASED")
  );
}

/** `mtimeMs` of a file, or undefined if it does not exist / cannot be stat'd. */
export async function statMtimeMs(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return undefined;
  }
}

/** Shows a path under the home directory as `~/…`, the way pi's docs and terminal name it. */
export function withHomeAsTilde(path: string): string {
  const home = homedir();
  return path.startsWith(`${home}${sep}`) ? `~${path.slice(home.length)}` : path;
}

/**
 * Path to pi's global settings file, mirroring the runtime's own resolution
 * (`getAgentDir()/settings.json`). We resolve it locally rather than importing
 * the runtime's helper because `@earendil-works/pi-coding-agent` is ESM-only and
 * cannot be `require`d from the CJS Electron main bundle; the app store passes no
 * custom `agentDir`, so the default resolution here matches the driver's.
 */
export function resolveGlobalSettingsPath(): string {
  const override = process.env.PI_CODING_AGENT_DIR;
  const agentDir = override
    ? override.startsWith("~")
      ? join(homedir(), override.slice(1))
      : override
    : join(homedir(), ".pi", "agent");
  return join(agentDir, "settings.json");
}

export async function readProjectModelSettingsFile(
  workspacePath: string,
): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(join(workspacePath, ".pi", "settings.json"), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Project-level `.pi/settings.json` wins over the global file, field by field. */
export function mergeModelSettingsSnapshot(
  globalSettings: ModelSettingsSnapshot,
  projectSettings: Record<string, unknown>,
): ModelSettingsSnapshot {
  const defaultProvider =
    typeof projectSettings.defaultProvider === "string"
      ? projectSettings.defaultProvider
      : globalSettings.defaultProvider;
  const defaultModelId =
    typeof projectSettings.defaultModel === "string"
      ? projectSettings.defaultModel
      : globalSettings.defaultModelId;
  const defaultThinkingLevel =
    typeof projectSettings.defaultThinkingLevel === "string"
      ? (projectSettings.defaultThinkingLevel as RuntimeSettingsSnapshot["defaultThinkingLevel"])
      : globalSettings.defaultThinkingLevel;

  return {
    enabledModelPatterns: Array.isArray(projectSettings.enabledModels)
      ? projectSettings.enabledModels.filter((value): value is string => typeof value === "string")
      : [...globalSettings.enabledModelPatterns],
    ...(defaultProvider ? { defaultProvider } : {}),
    ...(defaultModelId ? { defaultModelId } : {}),
    ...(defaultThinkingLevel ? { defaultThinkingLevel } : {}),
  };
}

export function hasStoredModelSettings(
  settings: ModelSettingsSnapshot | undefined,
): settings is ModelSettingsSnapshot {
  return Boolean(
    settings &&
    (settings.enabledModelPatterns.length > 0 ||
      settings.defaultProvider ||
      settings.defaultModelId ||
      settings.defaultThinkingLevel),
  );
}

export function modelSettingsEqual(
  left: ModelSettingsSnapshot,
  right: ModelSettingsSnapshot,
): boolean {
  return (
    left.defaultProvider === right.defaultProvider &&
    left.defaultModelId === right.defaultModelId &&
    left.defaultThinkingLevel === right.defaultThinkingLevel &&
    samePatterns(left.enabledModelPatterns, right.enabledModelPatterns)
  );
}

export function samePatterns(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((pattern, index) => pattern === right[index]);
}

/** Append patterns that are not already present, keeping the existing order. */
export function mergeEnabledModelPatterns(
  existingPatterns: readonly string[],
  providerPatterns: readonly string[],
): readonly string[] {
  const merged = [...existingPatterns];
  const seen = new Set(existingPatterns);
  for (const pattern of providerPatterns) {
    if (seen.has(pattern)) {
      continue;
    }
    seen.add(pattern);
    merged.push(pattern);
  }
  return merged;
}

/**
 * Keep the persisted pin order, drop keys that are no longer pinned, and append
 * newly pinned keys newest-first.
 */
export function reconcilePinnedSessionOrder(
  pinnedAtBySession: ReadonlyMap<string, string>,
  preferredOrder: readonly string[],
): readonly string[] {
  const pinnedKeys = new Set(pinnedAtBySession.keys());
  const ordered = [...new Set(preferredOrder)].filter((key) => pinnedKeys.has(key));
  const seen = new Set(ordered);
  const missing = [...pinnedAtBySession.keys()]
    .filter((key) => !seen.has(key))
    .sort((left, right) => {
      const leftPinnedAt = pinnedAtBySession.get(left) ?? "";
      const rightPinnedAt = pinnedAtBySession.get(right) ?? "";
      return rightPinnedAt.localeCompare(leftPinnedAt);
    });
  return [...ordered, ...missing];
}

export function formatCapabilityLabel(capability: string): string {
  switch (capability) {
    case "custom":
      return "custom UI";
    case "onTerminalInput":
      return "terminal input";
    case "setEditorComponent":
      return "custom editor UI";
    case "setFooter":
      return "footer UI";
    case "setHeader":
      return "header UI";
    default:
      return capability.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  }
}

export function resolveSelectedWorkspaceIdFromCatalog(
  preferredWorkspaceId: string,
  workspaces: readonly { workspaceId: string }[],
): string {
  if (preferredWorkspaceId && workspaces.some((w) => w.workspaceId === preferredWorkspaceId)) {
    return preferredWorkspaceId;
  }
  return workspaces[0]?.workspaceId ?? "";
}

export function resolveSelectedSessionIdFromCatalog(
  workspaceId: string,
  preferredSessionId: string,
  sessions: readonly SessionCatalogEntry[],
): string {
  const workspaceSessions = sessions.filter((session) => session.workspaceId === workspaceId);
  if (!workspaceSessions.length) {
    return "";
  }
  if (
    preferredSessionId &&
    workspaceSessions.some((session) => session.sessionRef.sessionId === preferredSessionId)
  ) {
    return preferredSessionId;
  }
  return workspaceSessions[0]?.sessionRef.sessionId ?? "";
}
