import type { RuntimeExtensionRecord } from "@pi-gui/session-driver/runtime-types";
import type {
  ExtensionCommandCompatibilityRecord,
  WorkspaceRecord,
} from "../../../contracts/desktop-state";
import { useTranslation, type MessageKey, type Translate } from "../../i18n";
import { ExtensionIcon } from "../../ui/icons";
import { SettingsGroup, SettingsRow } from "../settings/settings-utils";
import {
  extensionGroupKey,
  extensionGroupLabel,
  isPiAddonExtension,
  isPiGuiBuiltinExtension,
  PI_ADDONS_LABEL_KEY,
  PI_GUI_TOOLS_LABEL_KEY,
} from "./extension-display";
import { displayPath, ResourceDetail } from "./resource-detail";
import { ResourceEmptyState, ResourceList, type ResourceListGroup } from "./resource-list";

const GROUP_ORDER: readonly MessageKey[] = [
  "extensions.group.workspace",
  "extensions.group.user",
  "extensions.group.session",
  PI_ADDONS_LABEL_KEY,
  PI_GUI_TOOLS_LABEL_KEY,
];

interface ExtensionsTabProps {
  readonly workspace: WorkspaceRecord;
  readonly extensions: readonly RuntimeExtensionRecord[];
  readonly commandCompatibility: readonly ExtensionCommandCompatibilityRecord[];
  readonly searching: boolean;
  /** The extension whose detail page is open, looked up in the unfiltered list. */
  readonly selected?: RuntimeExtensionRecord;
  readonly onSelect: (path: string | undefined) => void;
  readonly onToggleExtension: (path: string, enabled: boolean) => void;
  readonly onOpenExtensionFolder: (path: string) => void;
}

export function ExtensionsTab({
  workspace,
  extensions,
  commandCompatibility,
  searching,
  selected,
  onSelect,
  onToggleExtension,
  onOpenExtensionFolder,
}: ExtensionsTabProps) {
  const { t } = useTranslation();
  // The list stays mounted under an open detail so expanded groups, scroll and focus survive.
  const list =
    extensions.length === 0 ? (
      <ResourceEmptyState
        title={searching ? t("extensions.list.noMatch") : t("extensions.list.none")}
        body={searching ? t("extensions.list.tryOther") : t("extensions.list.discoveredHint")}
      />
    ) : (
      <ResourceList
        expanded={searching}
        groups={groupExtensions(extensions, onToggleExtension, t)}
        icon={<ExtensionIcon />}
        testId="extensions-list"
        onOpen={onSelect}
      />
    );

  return (
    <>
      {selected ? (
        <ExtensionDetail
          commandCompatibility={commandCompatibility}
          selected={selected}
          workspace={workspace}
          onOpenExtensionFolder={onOpenExtensionFolder}
          onSelect={onSelect}
          onToggleExtension={onToggleExtension}
        />
      ) : null}
      <div hidden={Boolean(selected)}>{list}</div>
    </>
  );
}

function ExtensionDetail({
  selected,
  workspace,
  commandCompatibility,
  onSelect,
  onToggleExtension,
  onOpenExtensionFolder,
}: Omit<ExtensionsTabProps, "extensions" | "searching" | "selected"> & {
  readonly selected: RuntimeExtensionRecord;
}) {
  const { t } = useTranslation();
  const hasFolder = isFolderExtension(selected);
  const compatibilityRecords = commandCompatibility
    .filter((record) => record.extensionPath === selected.path)
    .sort((left, right) => left.commandName.localeCompare(right.commandName));
  return (
    <ResourceDetail
      actions={
        hasFolder ? (
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onOpenExtensionFolder(selected.path)}
          >
            {t("extensions.list.openFolder")}
          </button>
        ) : null
      }
      backLabel={t("extensions.list.all")}
      enabled={selected.enabled}
      icon={<ExtensionIcon />}
      subtitle={selected.sourceInfo.source}
      title={selected.displayName}
      onBack={() => onSelect(undefined)}
      onToggle={
        isToggleableExtension(selected)
          ? (enabled) => onToggleExtension(selected.path, enabled)
          : undefined
      }
    >
      {selected.description ? (
        <p className="resource-detail__description">{selected.description}</p>
      ) : null}
      <SettingsGroup>
        <SettingsRow
          title={t("extensions.detail.source")}
          description={
            isPiAddonExtension(selected)
              ? t("extensions.detail.shipsWithPi")
              : selected.sourceInfo.origin === "package"
                ? t("extensions.detail.installedAsPackage")
                : t("extensions.detail.loadedFromFile")
          }
        >
          <span className="settings-row__value">{extensionGroupLabel(selected, t)}</span>
        </SettingsRow>
        {isPiGuiBuiltinExtension(selected) || isPiAddonExtension(selected) ? null : (
          <SettingsRow title={t("extensions.detail.location")}>
            <code className="resource-detail__code" title={selected.path}>
              {displayPath(selected.path, workspace.path)}
            </code>
          </SettingsRow>
        )}
      </SettingsGroup>
      <ExtensionContributionSection
        title={t("extensions.detail.tools")}
        items={selected.tools.map((tool) => tool.name)}
      />
      {selected.commands.length > 0 ? (
        <ExtensionCompatibilitySection
          commands={selected.commands}
          compatibilityRecords={compatibilityRecords}
        />
      ) : null}
      <ExtensionContributionSection title={t("extensions.detail.flags")} items={selected.flags} />
      <ExtensionContributionSection
        title={t("extensions.detail.shortcuts")}
        items={selected.shortcuts}
      />
      <ExtensionDiagnostics diagnostics={selected.diagnostics} />
    </ResourceDetail>
  );
}

function groupExtensions(
  extensions: readonly RuntimeExtensionRecord[],
  onToggleExtension: (path: string, enabled: boolean) => void,
  t: Translate,
): readonly ResourceListGroup[] {
  return GROUP_ORDER.map((key) => ({
    label: t(key),
    items: extensions
      .filter((extension) => extensionGroupKey(extension) === key)
      .map((extension) => ({
        id: extension.path,
        title: extension.displayName,
        description: describeExtension(extension, t),
        enabled: extension.enabled,
        onToggle: isToggleableExtension(extension)
          ? (enabled: boolean) => onToggleExtension(extension.path, enabled)
          : undefined,
      })),
  })).filter((group) => group.items.length > 0);
}

/** One line for the list: the extension's own description, else what it contributes. */
function describeExtension(extension: RuntimeExtensionRecord, t: Translate): string {
  if (extension.description) return extension.description;
  const parts = [
    extension.tools.length > 0
      ? t("extensions.toolsCount", { count: extension.tools.length })
      : undefined,
    extension.commands.length > 0
      ? t("extensions.commandsCount", { count: extension.commands.length })
      : undefined,
    extension.diagnostics.length > 0
      ? t("extensions.issuesCount", { count: extension.diagnostics.length })
      : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : extension.sourceInfo.source;
}

function isFolderExtension(extension: RuntimeExtensionRecord): boolean {
  return (
    !isPiAddonExtension(extension) &&
    (extension.sourceInfo.scope === "project" || extension.sourceInfo.scope === "user")
  );
}

function isToggleableExtension(extension: RuntimeExtensionRecord): boolean {
  return (
    isFolderExtension(extension) ||
    isPiAddonExtension(extension) ||
    isPiGuiBuiltinExtension(extension)
  );
}

function ExtensionContributionSection({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  if (items.length === 0) return null;
  return (
    <SettingsGroup title={title}>
      <div className="resource-detail__tokens">
        {items.map((item) => (
          <code className="resource-detail__token" key={item}>
            {item}
          </code>
        ))}
      </div>
    </SettingsGroup>
  );
}

function ExtensionDiagnostics({
  diagnostics,
}: {
  readonly diagnostics: RuntimeExtensionRecord["diagnostics"];
}) {
  const { t } = useTranslation();
  if (diagnostics.length === 0) return null;
  return (
    <SettingsGroup title={t("extensions.detail.diagnostics")}>
      {diagnostics.map((diagnostic, index) => (
        <div
          className={`activity-item activity-item--${diagnostic.type === "error" ? "error" : "info"}`}
          key={`${diagnostic.message}:${index}`}
        >
          <div className="activity-item__text">{diagnostic.message}</div>
          {diagnostic.path ? <div className="activity-item__meta">{diagnostic.path}</div> : null}
        </div>
      ))}
    </SettingsGroup>
  );
}

function ExtensionCompatibilitySection({
  commands,
  compatibilityRecords,
}: {
  readonly commands: readonly string[];
  readonly compatibilityRecords: readonly ExtensionCommandCompatibilityRecord[];
}) {
  const { t } = useTranslation();
  const supported = compatibilityRecords.filter((record) => record.status === "supported");
  const terminalOnly = compatibilityRecords.filter((record) => record.status === "terminal-only");
  const unknown = commands.filter((commandName) =>
    compatibilityRecords.every(
      (record) =>
        record.commandName !== commandName && !record.commandName.startsWith(`${commandName}:`),
    ),
  );

  return (
    <SettingsGroup
      title={t("extensions.detail.commands")}
      description={t("extensions.detail.commandsHint")}
    >
      <div className="resource-detail__tokens">
        {supported.map((record) => (
          <code className="resource-detail__token" key={`supported:${record.commandName}`}>
            {t("extensions.detail.guiCompatible", { command: record.commandName })}
          </code>
        ))}
        {terminalOnly.map((record) => (
          <code
            className="resource-detail__token resource-detail__token--warning"
            key={`terminal:${record.commandName}`}
          >
            {t("extensions.detail.terminalOnly", { command: record.commandName })}
          </code>
        ))}
        {unknown.map((commandName) => (
          <code className="resource-detail__token" key={`unknown:${commandName}`}>
            {t("extensions.detail.unknownCompat", { command: commandName })}
          </code>
        ))}
      </div>
    </SettingsGroup>
  );
}
