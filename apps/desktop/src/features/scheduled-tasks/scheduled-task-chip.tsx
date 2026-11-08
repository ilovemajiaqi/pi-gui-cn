import type { ScheduledTaskRecord } from "../../../contracts/desktop-state";
import { useTranslation } from "../../i18n";
import { formatScheduledTaskRowMetaI18n } from "./scheduled-task-format";

interface ScheduledTaskChipProps {
  readonly task: ScheduledTaskRecord;
  readonly onOpen: () => void;
}

export function ScheduledTaskChip({ task, onOpen }: ScheduledTaskChipProps) {
  const { t, locale } = useTranslation();
  return (
    <div className="scheduled-task-chip" data-testid="scheduled-task-chip">
      <span>{formatScheduledTaskRowMetaI18n(task, t, locale)}</span>
      <button className="button button--secondary" type="button" onClick={onOpen}>
        {t("scheduledTasks.chip.open")}
      </button>
    </div>
  );
}
