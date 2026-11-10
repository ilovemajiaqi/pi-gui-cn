/*
 * Phrasing for the rows the main process writes about a run: what happened, which
 * built-in tool ran, and what a finished run added up to. The store keeps the English
 * sentence next to a semantic kind, so the same history reads correctly after a language
 * switch; rows without a kind (a folder extension's tool, a runtime error message) keep
 * the copy they arrived with, because that copy is not ours to reword.
 */
import type {
  BuiltinToolLabel,
  TimelineActivity,
  TimelineMetrics,
  TimelineSummary,
  TimelineToolCall,
} from "../../../contracts/timeline-types";
import { toolInputSummary } from "../../../contracts/tool-labels";
import type { AppLocale, MessageKey } from "../../i18n/catalog";
import type { Translate } from "../../i18n/translate";

/** The sentence for an activity line, or the stored label when the line is not ours. */
export function activityLabel(item: TimelineActivity, t: Translate): string {
  if (item.activity === "resumed") {
    return t("conversation.timeline.activity.resumed");
  }
  if (item.activity === "stopped") {
    return t("conversation.timeline.activity.stopped");
  }
  return item.label;
}

/**
 * The right-hand note on an activity line: the event's own clock time, or how long the
 * failed run took. Both are formatted here with the active locale, so they follow a
 * language switch; `metadata` stays as the fallback for rows stored before this.
 */
export function activityMetadata(
  item: TimelineActivity,
  locale: AppLocale,
  t: Translate,
  formatDuration: (durationMs: number) => string,
): string | undefined {
  if (item.durationMs !== undefined) {
    return t("conversation.timeline.workedFor", { duration: formatDuration(item.durationMs) });
  }
  if (item.timestamp !== undefined) {
    return formatClockTime(item.timestamp, locale);
  }
  return item.metadata;
}

/** The label for a built-in tool row, or the stored label for an extension's own tool. */
export function toolRowLabel(item: TimelineToolCall, t: Translate): string {
  const kind = item.toolLabel;
  if (kind === undefined || kind === "pending") {
    return kind === "pending" ? t("conversation.timeline.tool.pending") : item.label;
  }
  // The store derives the summary from the call's own argument; rebuild it the same way
  // so the translated sentence names the same file, query or command.
  const detail = toolInputSummary(item.input);
  const [plain, withDetail] = toolLabelKeys(kind);
  if (withDetail !== undefined && detail) {
    return t(withDetail, { detail, tool: item.toolName });
  }
  return t(plain, { tool: item.toolName });
}

/** The summary a finished run leaves behind, phrased with this locale's plural rules. */
export function summaryLabel(item: TimelineSummary, locale: AppLocale, t: Translate): string {
  if (item.summary === "completed") {
    return t("conversation.timeline.summary.completed");
  }
  const metrics = item.metrics;
  if (item.summary !== undefined && metrics !== undefined) {
    return runSummaryPhrase(metrics, locale, t);
  }
  return item.label;
}

/** A summary row's note follows the same rule as an activity row's. */
export function summaryMetadata(item: TimelineSummary, locale: AppLocale): string | undefined {
  return item.timestamp === undefined ? item.metadata : formatClockTime(item.timestamp, locale);
}

function runSummaryPhrase(metrics: TimelineMetrics, locale: AppLocale, t: Translate): string {
  const parts: string[] = [];
  if ((metrics.fileCount ?? 0) > 0) {
    parts.push(t("conversation.timeline.summary.explored", { count: metrics.fileCount ?? 0 }));
  }
  if ((metrics.searchCount ?? 0) > 0) {
    parts.push(t("conversation.timeline.summary.searches", { count: metrics.searchCount ?? 0 }));
  }
  if (parts.length === 0 && (metrics.toolCount ?? 0) > 0) {
    parts.push(t("conversation.timeline.summary.usedTools", { count: metrics.toolCount ?? 0 }));
  }
  if (parts.length === 0) {
    // The store only writes this row when one of the counts is above zero; keep the old
    // sentence if a stored row ever disagrees rather than rendering an empty line.
    return t("conversation.timeline.summary.completed");
  }
  return new Intl.ListFormat(locale, { style: "narrow", type: "conjunction" }).format(parts);
}

/** A built-in kind's two keys: the bare sentence, and its `{detail}` form when it has one. */
function toolLabelKeys(kind: BuiltinToolLabel): readonly [MessageKey, MessageKey?] {
  switch (kind) {
    case "createChildThread":
      return [
        "conversation.timeline.tool.createChildThread",
        "conversation.timeline.tool.createChildThreadDetail",
      ];
    case "listThreads":
      return ["conversation.timeline.tool.listThreads"];
    case "readThread":
      return [
        "conversation.timeline.tool.readThread",
        "conversation.timeline.tool.readThreadDetail",
      ];
    case "sendMessageToThread":
      return [
        "conversation.timeline.tool.sendToThread",
        "conversation.timeline.tool.sendToThreadDetail",
      ];
    case "archiveChildThreads":
      return ["conversation.timeline.tool.archiveChildThreads"];
    case "search":
      return ["conversation.timeline.tool.search", "conversation.timeline.tool.searchDetail"];
    case "read":
      return ["conversation.timeline.tool.read", "conversation.timeline.tool.readDetail"];
    case "explore":
      return ["conversation.timeline.tool.explore", "conversation.timeline.tool.exploreDetail"];
    case "run":
      return ["conversation.timeline.tool.run", "conversation.timeline.tool.runDetail"];
    case "pending":
      return ["conversation.timeline.tool.pending"];
  }
}

/** An event's clock time in the active locale, e.g. "9:14 PM" or "21:14". */
export function formatClockTime(timestamp: string, locale: AppLocale): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}

const durationFormatters = new Map<string, Intl.NumberFormat>();

/**
 * A duration in the reader's units: "8s", "2m 5s", "1h 3m" in English; "8秒", "2分钟 5秒"
 * in Chinese. Narrow unit formatting keeps English byte-identical to the hand-built
 * string this replaced, so stored expectations and e2e assertions still read the same.
 */
export function formatDuration(durationMs: number, locale: AppLocale): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return unit(totalSeconds, "second", locale);
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0
      ? `${unit(minutes, "minute", locale)} ${unit(seconds, "second", locale)}`
      : unit(minutes, "minute", locale);
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes > 0
    ? `${unit(hours, "hour", locale)} ${unit(remMinutes, "minute", locale)}`
    : unit(hours, "hour", locale);
}

function unit(value: number, name: "second" | "minute" | "hour", locale: AppLocale): string {
  const cacheKey = `${locale}:${name}`;
  let formatter = durationFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "unit",
      unit: name,
      unitDisplay: "narrow",
    });
    durationFormatters.set(cacheKey, formatter);
  }
  return formatter.format(value);
}
