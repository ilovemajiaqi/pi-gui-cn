import { useMemo, type ReactNode } from "react";
import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type {
  ExtensionCommandCompatibilityRecord,
  WorkspaceRecord,
} from "../../../contracts/desktop-state";
import { useTranslation } from "../../i18n";
import { ExtensionsTab } from "./extensions-view";
import {
  ResourcePage,
  extensionSearchText,
  matchesQuery,
  useResourcePageState,
} from "./resource-page";

interface ExtensionsPageProps {
  readonly workspace?: WorkspaceRecord;
  readonly workspacePicker: ReactNode;
  readonly runtime?: RuntimeSnapshot;
  readonly commandCompatibility: readonly ExtensionCommandCompatibilityRecord[];
  readonly onRefresh: () => void;
  readonly onToggleExtension: (path: string, enabled: boolean) => void;
  readonly onOpenExtensionFolder: (path: string) => void;
}

/** Codex's Plugins catalog page: one searchable, grouped list of the runtime add-ons pi loads. */
export function ExtensionsPage({
  workspace,
  workspacePicker,
  runtime,
  commandCompatibility,
  onRefresh,
  onToggleExtension,
  onOpenExtensionFolder,
}: ExtensionsPageProps) {
  const { t } = useTranslation();
  const { query, setQuery, selectedId, selectItem, panelRef } = useResourcePageState(workspace?.id);
  const extensions = runtime?.extensions ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredExtensions = useMemo(
    () =>
      extensions.filter((extension) =>
        matchesQuery(extensionSearchText(extension, t), normalizedQuery),
      ),
    [extensions, normalizedQuery, t],
  );

  return (
    <ResourcePage
      countLabel={t("extensions.count", { count: extensions.length })}
      panelRef={panelRef}
      query={query}
      refreshLabel={t("extensions.common.refresh")}
      searchLabel={t("extensions.searchLabel")}
      subtitle={t("extensions.subtitle", {
        workspace: workspace?.name ?? t("extensions.thisWorkspace"),
      })}
      title={t("extensions.title")}
      workspacePicker={workspacePicker}
      onQueryChange={(value) => {
        setQuery(value);
        selectItem(undefined);
      }}
      onRefresh={onRefresh}
    >
      {!workspace ? (
        <div className="settings-group resource-empty">
          <div className="resource-empty__title">{t("extensions.openFolderFirst")}</div>
          <p className="resource-empty__body">{t("extensions.discoveredHint")}</p>
        </div>
      ) : (
        <ExtensionsTab
          commandCompatibility={commandCompatibility}
          extensions={filteredExtensions}
          searching={normalizedQuery.length > 0}
          selected={extensions.find((extension) => extension.path === selectedId)}
          workspace={workspace}
          onOpenExtensionFolder={onOpenExtensionFolder}
          onSelect={selectItem}
          onToggleExtension={onToggleExtension}
        />
      )}
    </ResourcePage>
  );
}
