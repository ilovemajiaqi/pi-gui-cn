import { useMemo, type ReactNode } from "react";
import type { RuntimeSnapshot, RuntimeSkillRecord } from "@pi-gui/session-driver/runtime-types";
import type { WorkspaceRecord } from "../../../contracts/desktop-state";
import { useTranslation } from "../../i18n";
import { ResourcePage, matchesQuery, skillSearchText, useResourcePageState } from "./resource-page";
import { SkillsTab } from "./skills-view";

interface SkillsPageProps {
  readonly workspace?: WorkspaceRecord;
  readonly workspacePicker: ReactNode;
  readonly runtime?: RuntimeSnapshot;
  readonly onRefresh: () => void;
  readonly onToggleSkill: (filePath: string, enabled: boolean) => void;
  readonly onOpenSkillFolder: (filePath: string) => void;
  readonly onTryCommand: (command: string) => void;
}

/** Codex's Skills page: one searchable, grouped list of the workspace's skills. */
export function SkillsPage({
  workspace,
  workspacePicker,
  runtime,
  onRefresh,
  onToggleSkill,
  onOpenSkillFolder,
  onTryCommand,
}: SkillsPageProps) {
  const { t } = useTranslation();
  const { query, setQuery, selectedId, selectItem, panelRef } = useResourcePageState(workspace?.id);
  const skills = runtime?.skills ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSkills = useMemo(
    () => skills.filter((skill) => matchesQuery(skillSearchText(skill), normalizedQuery)),
    [skills, normalizedQuery],
  );

  return (
    <ResourcePage
      countLabel={t("skills.count", { count: skills.length })}
      primaryAction={
        workspace
          ? {
              label: t("skills.newSkill"),
              run: () => onTryCommand(t("skills.newSkillPrompt")),
            }
          : undefined
      }
      panelRef={panelRef}
      query={query}
      refreshLabel={t("extensions.common.refresh")}
      searchLabel={t("skills.searchLabel")}
      subtitle={t("skills.subtitle", {
        workspace: workspace?.name ?? t("extensions.thisWorkspace"),
      })}
      title={t("skills.title")}
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
        <SkillsTab
          searching={normalizedQuery.length > 0}
          selected={skills.find((skill) => skill.filePath === selectedId)}
          skills={filteredSkills}
          workspace={workspace}
          onOpenSkillFolder={onOpenSkillFolder}
          onSelect={selectItem}
          onToggleSkill={onToggleSkill}
          onTrySkill={(skill: RuntimeSkillRecord) => onTryCommand(`${skill.slashCommand} `)}
        />
      )}
    </ResourcePage>
  );
}
