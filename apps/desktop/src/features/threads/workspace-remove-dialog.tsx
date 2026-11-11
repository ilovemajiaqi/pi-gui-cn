import { useTranslation } from "../../i18n";
import { ConfirmDialog } from "../../ui/confirm-dialog";
import type { WorkspaceMenuState } from "./hooks/use-workspace-menu";

interface WorkspaceRemoveDialogProps {
  readonly menu: WorkspaceMenuState;
}

/**
 * Removing a workspace from the list is destructive enough to confirm, but it never
 * touches files, so the dialog is the plain accent button rather than the danger one.
 */
export function WorkspaceRemoveDialog({ menu }: WorkspaceRemoveDialogProps) {
  const { t } = useTranslation();
  const pending = menu.pendingRemove;
  if (!pending) {
    return null;
  }
  const worktree = pending.kind === "worktree";
  return (
    <ConfirmDialog
      cancelLabel={t("threads.removeDialog.cancel")}
      confirmLabel={t("threads.removeDialog.confirm")}
      description={
        worktree
          ? t("threads.removeDialog.worktreeBody", { name: pending.worktree.name })
          : t("threads.removeDialog.workspaceBody", { name: pending.workspace.name })
      }
      error={menu.removeError}
      eyebrow={t("threads.removeDialog.eyebrow")}
      submitting={menu.removing}
      testId="workspace-remove-dialog"
      title={
        worktree
          ? t("threads.removeDialog.worktreeTitle", { name: pending.worktree.name })
          : t("threads.removeDialog.workspaceTitle", { name: pending.workspace.name })
      }
      onCancel={menu.cancelRemove}
      onConfirm={menu.confirmRemove}
    />
  );
}
