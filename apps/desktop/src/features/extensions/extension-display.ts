import type {
  RuntimeExtensionRecord,
  RuntimeSourceScope,
} from "@pi-gui/session-driver/runtime-types";
import { translate, type MessageKey, type Translate } from "../../i18n";

/** Catalog keys for the labels pi-gui and pi's own add-ons go by; callers translate them. */
export const PI_GUI_TOOLS_LABEL_KEY: MessageKey = "extensions.piGuiTools";
export const PI_ADDONS_LABEL_KEY: MessageKey = "extensions.builtIntoPi";

export function extensionSourceSummary(
  extension: RuntimeExtensionRecord,
  t: Translate = translate,
): string {
  return `${extensionScopeLabel(extension, t)} · ${extension.sourceInfo.origin}`;
}

/** Extensions pi-gui itself adds to every session; switched on and off app-wide. */
export function isPiGuiBuiltinExtension(extension: RuntimeExtensionRecord): boolean {
  return (
    extension.sourceInfo.source === "builtin" &&
    extension.sourceInfo.origin === "top-level" &&
    extension.sourceInfo.scope === "temporary"
  );
}

/**
 * pi's own add-ons (MCP, code mode, tool search), named `builtin:<name>`. Their switch writes
 * pi's `extensions` setting, so terminal pi follows it too.
 */
export function isPiAddonExtension(extension: RuntimeExtensionRecord): boolean {
  return extension.sourceInfo.source === "builtin" && extension.path.startsWith("builtin:");
}

export function extensionScopeLabel(
  extension: RuntimeExtensionRecord,
  t: Translate = translate,
): string {
  if (isPiGuiBuiltinExtension(extension)) return t(PI_GUI_TOOLS_LABEL_KEY);
  if (isPiAddonExtension(extension)) return t(PI_ADDONS_LABEL_KEY);
  return extension.sourceInfo.scope;
}

/** Grouping key for where a skill or extension was discovered. */
export function sourceScopeGroupKey(scope: RuntimeSourceScope): MessageKey {
  switch (scope) {
    case "project":
      return "extensions.group.workspace";
    case "user":
      return "extensions.group.user";
    case "temporary":
      return "extensions.group.session";
  }
}

/** Group heading for where a skill or extension was discovered. */
export function sourceScopeGroupLabel(scope: RuntimeSourceScope, t: Translate = translate): string {
  return t(sourceScopeGroupKey(scope));
}

/** Grouping key for an extension: pi-gui's own tools, pi's add-ons, else where it was found. */
export function extensionGroupKey(extension: RuntimeExtensionRecord): MessageKey {
  if (isPiGuiBuiltinExtension(extension)) return PI_GUI_TOOLS_LABEL_KEY;
  if (isPiAddonExtension(extension)) return PI_ADDONS_LABEL_KEY;
  return sourceScopeGroupKey(extension.sourceInfo.scope);
}

export function extensionGroupLabel(
  extension: RuntimeExtensionRecord,
  t: Translate = translate,
): string {
  return t(extensionGroupKey(extension));
}
