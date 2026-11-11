import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Translate } from "../../i18n";
import type {
  RuntimeExtensionRecord,
  RuntimeSkillRecord,
} from "@pi-gui/session-driver/runtime-types";
import { RefreshIcon, SearchIcon } from "../../ui/icons";
import { extensionScopeLabel } from "./extension-display";

/**
 * Search and selection for one resource page. Each page keeps its own query and open detail, so
 * switching pages — or the workspace picker changing what is listed — never carries a filter or
 * a detail from the other list.
 */
export function useResourcePageState(workspaceId: string | undefined) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [shownWorkspaceId, setShownWorkspaceId] = useState(workspaceId);
  if (shownWorkspaceId !== workspaceId) {
    setShownWorkspaceId(workspaceId);
    setQuery("");
    setSelectedId(undefined);
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (selectedId || !returnFocusId.current) return;
    const id = returnFocusId.current;
    returnFocusId.current = undefined;
    panelRef.current?.querySelector<HTMLElement>(`[data-resource-id="${CSS.escape(id)}"]`)?.focus();
  }, [selectedId]);
  const selectItem = (id: string | undefined) => {
    if (id === undefined) returnFocusId.current = selectedId;
    setSelectedId(id);
  };
  return { query, setQuery, selectedId, selectItem, panelRef };
}

interface ResourcePageProps {
  readonly title: string;
  readonly subtitle: string;
  readonly workspacePicker: ReactNode;
  readonly refreshLabel: string;
  readonly onRefresh: () => void;
  readonly primaryAction?: { readonly label: string; readonly run: () => void };
  readonly countLabel: string;
  readonly searchLabel: string;
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly children: ReactNode;
}

/**
 * One resource page: its own header, workspace picker, search and list. Skills and extensions
 * are separate pages, as in Codex, so neither needs a tab strip to reach the other.
 */
export function ResourcePage({
  title,
  subtitle,
  workspacePicker,
  refreshLabel,
  onRefresh,
  primaryAction,
  countLabel,
  searchLabel,
  query,
  onQueryChange,
  panelRef,
  children,
}: ResourcePageProps) {
  return (
    <section className="canvas">
      <div className="conversation settings-view">
        <header className="view-header">
          <div>
            <h1 className="view-header__title">{title}</h1>
            <p className="view-header__body">{subtitle}</p>
          </div>
          <div className="view-header__actions">
            {workspacePicker}
            <button
              aria-label={refreshLabel}
              className="icon-button resource-refresh"
              title={refreshLabel}
              type="button"
              onClick={onRefresh}
            >
              <RefreshIcon />
            </button>
            {primaryAction ? (
              <button className="button button--primary" type="button" onClick={primaryAction.run}>
                {primaryAction.label}
              </button>
            ) : null}
          </div>
        </header>

        <div className="resource-toolbar">
          <span className="resource-toolbar__count">{countLabel}</span>
          <label className="resource-search">
            <SearchIcon />
            <input
              aria-label={searchLabel}
              placeholder={searchLabel}
              spellCheck={false}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.currentTarget.value)}
            />
          </label>
        </div>

        <div className="settings-grid" ref={panelRef}>
          {children}
        </div>
      </div>
    </section>
  );
}

export function matchesQuery(text: string, normalizedQuery: string): boolean {
  return !normalizedQuery || text.includes(normalizedQuery);
}

export function skillSearchText(skill: RuntimeSkillRecord): string {
  return [skill.name, skill.description, skill.source, skill.slashCommand].join(" ").toLowerCase();
}

export function extensionSearchText(extension: RuntimeExtensionRecord, t: Translate): string {
  return [
    extension.displayName,
    extension.description ?? "",
    extension.path,
    extension.sourceInfo.source,
    extensionScopeLabel(extension, t),
    ...extension.commands,
    ...extension.tools.flatMap((tool) => [tool.name, tool.label]),
    ...extension.flags,
    ...extension.shortcuts,
    ...extension.diagnostics.map((diagnostic) => diagnostic.message),
  ]
    .join(" ")
    .toLowerCase();
}
