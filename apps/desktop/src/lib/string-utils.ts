export function titleCase(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Relative timestamps for the sidebar, header and command palette.
 *
 * The unit suffixes used to be hardcoded English ("now", "5m", "3d"), which leaked
 * English into the Chinese UI because these strings are built at render time and
 * never went through the message catalogue. Intl.RelativeTimeFormat already knows
 * the unit words for both locales, so the only judgement call is width: "narrow"
 * keeps the compact shape the sidebar was designed around ("5m ago" / "5分钟前")
 * while "auto" lets a language use its own word where one exists ("yesterday" /
 * "昨天") instead of "1 day ago".
 */
export function formatRelativeTime(value: string, locale: string): string {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  const ago = (amount: number, unit: Intl.RelativeTimeFormatUnit): string =>
    formatter.format(-amount, unit);

  const diffMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return ago(0, "second");
  if (diffMinutes < 60) return ago(diffMinutes, "minute");
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return ago(diffHours, "hour");
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return ago(diffDays, "day");
  if (diffDays < 30) return ago(Math.floor(diffDays / 7), "week");
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return ago(diffMonths, "month");
  return ago(Math.floor(diffDays / 365), "year");
}
