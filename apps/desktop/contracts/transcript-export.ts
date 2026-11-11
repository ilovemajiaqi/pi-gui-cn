import type { TranscriptMessage } from "./timeline-types";

/**
 * A saved-thread Markdown export, ready for the main process to hand to a save dialog.
 * The conversation owner builds it from its transcript cache; nothing here reads the
 * renderer or the runtime.
 */
export interface TranscriptExportDocument {
  /** A safe file name derived from the session title, without an extension. */
  readonly fileName: string;
  readonly markdown: string;
}

/** The renderer-facing result of one export: either a saved path or a canceled dialog. */
export type TranscriptExportResult = { readonly canceled: true } | { readonly savedPath: string };

/** Fenced tool output longer than this is cut with an explicit truncation marker. */
const MAX_FENCED_OUTPUT_CHARS = 100_000;

const ROLE_HEADINGS: Record<string, string> = {
  user: "User",
  assistant: "Assistant",
  branchSummary: "Branch summary",
  compactionSummary: "Compaction summary",
};

/**
 * Renders one thread's transcript as Markdown. Message texts are already Markdown, so
 * they pass through verbatim; tool rows, activity lines, cards and custom messages are
 * rendered as headings, quotes and fenced blocks. Pins are skipped: they are composer
 * furniture, not transcript content.
 */
export function buildTranscriptMarkdown(
  items: readonly TranscriptMessage[],
  options: {
    readonly title?: string;
    /** ISO timestamp baked into the header; defaults to now. */
    readonly exportedAt?: string;
  } = {},
): string {
  const parts: string[] = [];
  const title = options.title?.trim();
  if (title) {
    parts.push(`# ${title}`, "");
  }
  const exportedAt = options.exportedAt ?? new Date().toISOString();
  parts.push(`_Exported ${exportedAt} from pi-gui._`, "");

  for (const item of items) {
    const rendered = renderItem(item);
    if (rendered.trim()) {
      parts.push(rendered, "");
    }
  }
  return `${parts.join("\n").trimEnd()}\n`;
}

function renderItem(item: TranscriptMessage): string {
  switch (item.kind) {
    case "message":
      return renderMessage(item);
    case "tool":
      return renderTool(item);
    case "custom":
      return [`**[${item.customType}]**`, "", item.text.trim()].join("\n");
    case "card":
      return renderCard(item.card);
    case "activity":
      return `_${item.label.trim() || item.activity || "activity"}_`;
    case "summary":
      return `_${item.label.trim() || "summary"}_`;
    case "pin":
      return "";
    default:
      return "";
  }
}

function renderMessage(item: TranscriptMessage & { readonly kind: "message" }): string {
  const heading = ROLE_HEADINGS[item.role] ?? "Message";
  const sections: string[] = [`## ${heading}`];
  if (item.role === "assistant" && item.thinking?.trim()) {
    sections.push("", "**Thought process**", "", quoteBlock(item.thinking.trim()));
  }
  const text = item.text.trim();
  if (text) {
    sections.push("", text);
  }
  for (const attachment of item.attachments ?? []) {
    sections.push("", `- Attachment: ${attachment.name || attachment.kind}`);
  }
  return sections.join("\n");
}

function renderTool(item: TranscriptMessage & { readonly kind: "tool" }): string {
  const heading = `**Tool: ${item.toolName} — ${item.status}**`;
  const detail = item.detail?.trim();
  const body: string[] = [];
  if (detail) {
    body.push(`> ${detail}`);
  }
  const output = fencedOutput(item.output);
  if (output) {
    body.push("", output);
  }
  return [heading, ...(body.length ? ["", ...body] : [])].join("\n");
}

function renderCard(card: {
  readonly title: string;
  readonly subtitle?: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
}): string {
  const lines = [`**${card.title}**`];
  if (card.subtitle?.trim()) {
    lines.push("", `_${card.subtitle.trim()}_`);
  }
  for (const row of card.rows) {
    lines.push("", `- ${row.label}: ${row.value}`);
  }
  return lines.join("\n");
}

function fencedOutput(output: unknown): string | undefined {
  if (typeof output !== "string") {
    return undefined;
  }
  const text = output.trimEnd();
  if (!text) {
    return undefined;
  }
  const truncated =
    text.length > MAX_FENCED_OUTPUT_CHARS
      ? `${text.slice(0, MAX_FENCED_OUTPUT_CHARS)}\n… (truncated)`
      : text;
  // A fence that would close early gets a longer fence, so embedded ``` blocks survive.
  const longestRun = Math.max(
    ...[...truncated.matchAll(/^`{3,}/gm)].map((match) => match[0].length),
    3,
  );
  return [`${"`".repeat(longestRun + 1)}text`, truncated, `${"`".repeat(longestRun + 1)}`].join(
    "\n",
  );
}

function quoteBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
}

/** A Windows- and POSIX-safe file name stem for one session title. */
export function transcriptExportFileName(title: string, exportedAt: string): string {
  const date = exportedAt.slice(0, 10).replaceAll("-", "");
  const stem =
    title
      .normalize("NFKD")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60)
      .replace(/^[-.]+|[-.]+$/g, "")
      .trim() || "thread";
  return `${stem}-${date}.md`;
}
