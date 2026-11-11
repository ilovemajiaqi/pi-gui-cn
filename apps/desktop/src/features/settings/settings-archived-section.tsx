import { useMemo, useState } from "react";
import type { SessionRecord, WorkspaceSessionTarget } from "../../../contracts/desktop-state";
import { ARCHIVE_RETENTION_MAX_DAYS } from "../../../contracts/desktop-state";
import { useTranslation } from "../../i18n";
import { formatRelativeTime } from "../../lib/string-utils";
import { ConfirmDialog } from "../../ui/confirm-dialog";
import { ArchiveIcon, RestoreIcon, TrashIcon } from "../../ui/icons";
import { SettingsSelect } from "./settings-controls";
import { SettingsGroup, SettingsRow } from "./settings-utils";

/** One archived thread, with the workspace it came from so the list can be app-wide. */
export interface ArchivedThreadEntry {
  readonly workspaceId: string;
  readonly workspaceName: string;
  readonly session: SessionRecord;
}

interface SettingsArchivedSectionProps {
  readonly entries: readonly ArchivedThreadEntry[];
  readonly archiveRetentionDays: number;
  readonly locale: string;
  readonly onSetArchiveRetentionDays: (days: number) => void;
  readonly onRestore: (target: WorkspaceSessionTarget) => void;
  /** Resolves when the thread is gone; rejects with a message the row shows. */
  readonly onDelete: (target: WorkspaceSessionTarget) => Promise<void>;
}

/** Retention choices in days; 0 keeps archived threads forever. */
const RETENTION_CHOICES = [0, 7, 30, 90, 180, 365] as const;

/**
 * Archive management: the one place that lists every archived thread and the only place that
 * offers irreversible deletion, so the retention setting can explain what it prunes.
 */
export function SettingsArchivedSection({
  entries,
  archiveRetentionDays,
  locale,
  onSetArchiveRetentionDays,
  onRestore,
  onDelete,
}: SettingsArchivedSectionProps) {
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState<ArchivedThreadEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const retentionOptions = useMemo(
    () =>
      RETENTION_CHOICES.map((days) => ({
        value: String(days),
        label:
          days === 0
            ? t("settings.archived.retention.forever")
            : t("settings.archived.retention.days", { count: String(days) }),
      })),
    [t],
  );
  const retentionValue = RETENTION_CHOICES.includes(
    archiveRetentionDays as (typeof RETENTION_CHOICES)[number],
  )
    ? String(archiveRetentionDays)
    : String(ARCHIVE_RETENTION_MAX_DAYS);

  const targetFor = (entry: ArchivedThreadEntry): WorkspaceSessionTarget => ({
    workspaceId: entry.workspaceId,
    sessionId: entry.session.id,
  });

  const confirmDelete = () => {
    if (!pendingDelete || deleting) return;
    const entry = pendingDelete;
    setError(undefined);
    setDeleting(true);
    void onDelete(targetFor(entry))
      .then(() => setPendingDelete(null))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => setDeleting(false));
  };

  const deleteAll = () => {
    if (deletingAll) return;
    setError(undefined);
    setDeletingAll(true);
    void (async () => {
      // Keep going after a failure so one stuck thread cannot strand the rest.
      let firstError: unknown;
      for (const entry of entries) {
        try {
          await onDelete(targetFor(entry));
        } catch (caught: unknown) {
          firstError ??= caught;
        }
      }
      if (firstError !== undefined) throw firstError;
    })()
      .then(() => setConfirmingDeleteAll(false))
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => setDeletingAll(false));
  };

  return (
    <>
      {error ? <div className="error-banner">{error}</div> : null}

      <SettingsGroup
        description={t("settings.archived.retention.description")}
        title={t("settings.archived.retention.title")}
      >
        <SettingsRow
          description={t("settings.archived.retention.rowDescription")}
          title={t("settings.archived.retention.rowTitle")}
        >
          <SettingsSelect
            label={t("settings.archived.retention.label")}
            options={retentionOptions}
            value={retentionValue}
            onChange={(value) => onSetArchiveRetentionDays(Number(value))}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup
        description={t("settings.archived.listDescription", { count: String(entries.length) })}
        title={t("settings.archived.listTitle")}
      >
        {entries.length === 0 ? (
          <SettingsRow
            description={t("settings.archived.emptyDescription")}
            title={t("settings.archived.emptyTitle")}
          />
        ) : (
          <>
            <SettingsRow
              description={t("settings.archived.deleteAllDescription")}
              title={t("settings.archived.deleteAllTitle")}
            >
              <button
                className="button button--danger"
                data-testid="archive-delete-all"
                disabled={deletingAll}
                type="button"
                onClick={() => {
                  setError(undefined);
                  setConfirmingDeleteAll(true);
                }}
              >
                <TrashIcon />
                {deletingAll ? t("settings.archived.deleting") : t("settings.archived.deleteAll")}
              </button>
            </SettingsRow>
            <div className="archive-list" data-testid="archive-list">
              {entries.map((entry) => (
                <div
                  className="archive-row"
                  data-archived-id={entry.session.id}
                  key={entry.session.id}
                >
                  <span className="archive-row__icon" aria-hidden="true">
                    <ArchiveIcon />
                  </span>
                  <div className="archive-row__label">
                    <div className="archive-row__title">{entry.session.title}</div>
                    <div className="archive-row__meta">
                      {t("settings.archived.rowMeta", {
                        workspace: entry.workspaceName,
                        when: entry.session.archivedAt
                          ? formatRelativeTime(entry.session.archivedAt, locale)
                          : "",
                      })}
                    </div>
                  </div>
                  <div className="archive-row__actions">
                    <button
                      aria-label={t("settings.archived.restoreAria", {
                        title: entry.session.title,
                      })}
                      className="archive-row__button"
                      type="button"
                      onClick={() => onRestore(targetFor(entry))}
                    >
                      <RestoreIcon />
                    </button>
                    <button
                      aria-label={t("settings.archived.deleteAria", { title: entry.session.title })}
                      className="archive-row__button archive-row__button--danger"
                      data-testid="archive-row-delete"
                      type="button"
                      onClick={() => {
                        setError(undefined);
                        setPendingDelete(entry);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </SettingsGroup>

      {pendingDelete ? (
        <ConfirmDialog
          danger
          cancelLabel={t("threads.delete.cancel")}
          confirmLabel={deleting ? t("threads.delete.deleting") : t("threads.delete.confirm")}
          description={t("threads.delete.body")}
          eyebrow={t("threads.delete.eyebrow")}
          error={error}
          submitting={deleting}
          testId="archive-delete-dialog"
          title={t("threads.delete.title", { title: pendingDelete.session.title })}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}

      {confirmingDeleteAll ? (
        <ConfirmDialog
          danger
          cancelLabel={t("threads.delete.cancel")}
          confirmLabel={deletingAll ? t("threads.delete.deleting") : t("threads.delete.confirm")}
          description={t("threads.delete.deleteAllBody")}
          eyebrow={t("threads.delete.eyebrow")}
          error={error}
          submitting={deletingAll}
          testId="archive-delete-all-dialog"
          title={t("threads.delete.deleteAllTitle")}
          onCancel={() => setConfirmingDeleteAll(false)}
          onConfirm={deleteAll}
        />
      ) : null}
    </>
  );
}
