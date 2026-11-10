/*
 * Locale-aware rendering of the copy contracts/scheduled-tasks.ts formats in English:
 * the recurrence line, the next-run line and the list row meta. The contract stays
 * locale-independent (its output also feeds search matching and English-pinned specs),
 * so the translated rewrite lives beside the components that display it.
 */
import type { ScheduledTaskRecord, ScheduledTaskSchedule } from "../../../contracts/desktop-state";
import { formatClockTime, type Weekday } from "../../../contracts/scheduled-tasks";
import type { AppLocale, MessageKey, Translate } from "../../i18n";

/** Short weekday labels by `Weekday` index; the contract's names stay untranslated. */
const DAY_KEYS: Readonly<Record<Weekday, MessageKey>> = {
  0: "scheduledTasks.day.sun",
  1: "scheduledTasks.day.mon",
  2: "scheduledTasks.day.tue",
  3: "scheduledTasks.day.wed",
  4: "scheduledTasks.day.thu",
  5: "scheduledTasks.day.fri",
  6: "scheduledTasks.day.sat",
};

function dayList(days: readonly Weekday[], t: Translate): string {
  const names = [...days].sort((left, right) => left - right).map((day) => t(DAY_KEYS[day]));
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0] ?? "";
  }
  if (names.length === 2) {
    return t("scheduledTasks.recurrence.listAnd", { left: names[0] ?? "", right: names[1] ?? "" });
  }
  return t("scheduledTasks.recurrence.listAndMore", {
    list: names.slice(0, -1).join(", "),
    last: names[names.length - 1] ?? "",
  });
}

/** The translated form of `formatScheduledTaskRecurrence`. */
export function formatScheduledTaskRecurrenceI18n(
  schedule: ScheduledTaskSchedule,
  t: Translate,
  locale: AppLocale,
): string {
  if (schedule.kind === "once") {
    const at = Date.parse(schedule.at);
    if (Number.isNaN(at)) {
      return t("scheduledTasks.recurrence.once");
    }
    return t("scheduledTasks.recurrence.onceAt", {
      time: new Date(at).toLocaleString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }
  if (schedule.kind === "interval") {
    const minutes = Math.round(schedule.everyMs / 60_000);
    if (minutes % (24 * 60) === 0) {
      const days = minutes / (24 * 60);
      return days === 1
        ? t("scheduledTasks.recurrence.everyDay")
        : t("scheduledTasks.recurrence.everyDays", { count: days });
    }
    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      return hours === 1
        ? t("scheduledTasks.recurrence.everyHour")
        : t("scheduledTasks.recurrence.everyHours", { count: hours });
    }
    return minutes === 1
      ? t("scheduledTasks.recurrence.everyMinute")
      : t("scheduledTasks.recurrence.everyMinutes", { count: minutes });
  }
  const time = formatClockTime(schedule.hour, schedule.minute);
  if (schedule.kind === "daily") {
    return t("scheduledTasks.recurrence.dailyAt", { time });
  }
  return `${t("scheduledTasks.recurrence.weeklyOn", { days: dayList(schedule.days, t) })} ${time}`;
}

/** The translated form of `formatScheduledTaskNextRun`. */
export function formatScheduledTaskNextRunI18n(
  nextRunAt: string,
  t: Translate,
  now = new Date(),
): string {
  const timestamp = Date.parse(nextRunAt);
  if (Number.isNaN(timestamp)) {
    return "";
  }
  const diffMs = timestamp - now.getTime();
  if (diffMs <= 0) {
    return t("scheduledTasks.nextRun.dueNow");
  }
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) {
    return t("scheduledTasks.nextRun.underMinute");
  }
  if (diffMinutes < 60) {
    return t("scheduledTasks.nextRun.minutes", { count: diffMinutes });
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t("scheduledTasks.nextRun.hours", { count: diffHours });
  }
  const diffDays = Math.floor(diffHours / 24);
  return t("scheduledTasks.nextRun.days", { count: diffDays });
}

/** The translated form of `formatScheduledTaskRowMeta`. */
export function formatScheduledTaskRowMetaI18n(
  task: ScheduledTaskRecord,
  t: Translate,
  locale: AppLocale,
  now = new Date(),
): string {
  const recurrence = formatScheduledTaskRecurrenceI18n(task.schedule, t, locale);
  if (task.status === "completed") {
    return recurrence;
  }
  if (task.status === "paused") {
    return t("scheduledTasks.recurrence.paused", { recurrence });
  }
  if (!task.nextRunAt) {
    return recurrence;
  }
  return `${recurrence} · ${formatScheduledTaskNextRunI18n(task.nextRunAt, t, now)}`;
}
