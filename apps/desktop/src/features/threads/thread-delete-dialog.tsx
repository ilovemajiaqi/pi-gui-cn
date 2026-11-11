import type { ThreadActionSubject } from "./thread-actions";
import { useTranslation } from "../../i18n";
import { ConfirmDialog } from "../../ui/confirm-dialog";

interface ThreadDeleteDialogProps {
  readonly target: ThreadActionSubject | null;
  readonly deleting: boolean;
  readonly error?: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

/** The one confirmation gate in front of an irreversible thread deletion. */
export function ThreadDeleteDialog({
  target,
  deleting,
  error,
  onCancel,
  onConfirm,
}: ThreadDeleteDialogProps) {
  const { t } = useTranslation();
  if (!target) return null;
  return (
    <ConfirmDialog
      danger
      cancelLabel={t("threads.delete.cancel")}
      confirmLabel={deleting ? t("threads.delete.deleting") : t("threads.delete.confirm")}
      description={t("threads.delete.body")}
      error={error}
      eyebrow={t("threads.delete.eyebrow")}
      submitting={deleting}
      testId="thread-delete-dialog"
      title={t("threads.delete.title", { title: target.session.title })}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
