import { useMemo, useRef, useState } from "react";
import type {
  SessionTranscriptCustomMessage,
  SessionTranscriptMessage,
} from "@pi-gui/session-driver";
import type {
  DisplayTimelineItem,
  TimelineActivity,
  TimelineToolCall,
  TimelineSummary,
  TimelineTurnMarker,
  TimelineWorkingIndicator,
} from "../../../contracts/timeline-types";
import type { ScheduledTaskOrigin } from "../../../contracts/scheduled-tasks";
import { parseCrossProjectMessage } from "../../../contracts/thread-message";
import { extensionToolRowLabel } from "../../../contracts/tool-labels";
import { useExtensionToolLabel } from "../extensions/extension-tool-labels";
import { useTranslation } from "../../i18n";
import type { Translate } from "../../i18n/translate";
import { useRunningLabel } from "./hooks/use-running-label";
import {
  activityLabel,
  activityMetadata,
  formatClockTime,
  formatDuration,
  summaryLabel,
  summaryMetadata,
  toolRowLabel,
} from "./timeline-label";
import {
  AnnotationMarkers,
  type AnnotationMarker,
  type OpenAnnotation,
} from "./annotations/annotation-markers";
import { parseAnnotatedPrompt } from "./annotations/annotation-prompt";
import { SentAnnotations } from "./annotations/sent-annotations";
import { ExtensionCardItem, type RunExtensionAction } from "./extension-card";
import { ImageAttachmentThumb } from "./image-attachment-thumb";
import { MessageMarkdown } from "./message-markdown";
import { stringifyToolValue, toolOutputImages } from "./tool-output-images";
import { TurnChangesCard, type OpenTurnChange } from "./turn-changes-card";
import type { WorkspaceFileLine } from "./workspace-file-line";
import { InlineDiff, extractDiffFromOutput } from "../../ui/diff-inline";
import {
  ChevronRightIcon,
  CopyIcon,
  DiffIcon,
  FileIcon,
  ForkIcon,
  SparkIcon,
  TerminalIcon,
} from "../../ui/icons";
import { extensionToLanguage } from "../../ui/syntax-highlight";

export function TimelineItem({
  item,
  expandedToolCallIds,
  onToggleToolCall,
  onViewFileInDiff,
  sourceMessageIndex,
  onForkFromMessage,
  onOpenTurnChange,
  scheduledOrigin,
  workspacePath,
  onOpenWorkspaceFileLine,
  onExtensionAction,
  annotationMarkers,
  onOpenAnnotation,
  thinkingActive,
}: {
  readonly item: DisplayTimelineItem;
  readonly expandedToolCallIds?: ReadonlySet<string>;
  readonly onToggleToolCall?: (callId: string) => void;
  readonly onViewFileInDiff?: (path: string) => void;
  readonly sourceMessageIndex?: number;
  readonly onForkFromMessage?: (messageIndex: number, preview?: string) => void;
  readonly onOpenTurnChange?: OpenTurnChange;
  readonly scheduledOrigin?: ScheduledTaskOrigin;
  readonly workspacePath?: string;
  readonly onOpenWorkspaceFileLine?: (target: WorkspaceFileLine) => void;
  readonly onExtensionAction?: RunExtensionAction;
  readonly annotationMarkers?: readonly AnnotationMarker[];
  readonly onOpenAnnotation?: OpenAnnotation;
  readonly thinkingActive?: boolean;
}) {
  switch (item.kind) {
    case "turn-marker":
      return <TimelineTurnMarkerItem item={item} />;
    case "working":
      return <TimelineWorkingItem item={item} />;
    case "turn-changes":
      return <TurnChangesCard turn={item.turn} onOpen={onOpenTurnChange} />;
    case "message":
      return (
        <TimelineMessage
          item={item}
          sourceMessageIndex={sourceMessageIndex}
          onForkFromMessage={onForkFromMessage}
          onOpenWorkspaceFileLine={onOpenWorkspaceFileLine}
          scheduledOrigin={scheduledOrigin}
          workspacePath={workspacePath}
          annotationMarkers={annotationMarkers}
          onOpenAnnotation={onOpenAnnotation}
          thinkingActive={thinkingActive}
        />
      );
    case "activity":
      return <TimelineActivityItem item={item} />;
    case "tool":
      return (
        <TimelineToolCallItem
          item={item}
          expanded={expandedToolCallIds?.has(item.callId) ?? false}
          onToggle={onToggleToolCall}
          onViewFileInDiff={onViewFileInDiff}
        />
      );
    case "summary":
      return <TimelineSummaryItem item={item} />;
    case "custom":
      return <TimelineCustomMessage item={item} />;
    case "card":
      return <ExtensionCardItem card={item.card} onAction={onExtensionAction} />;
    default:
      return unhandledTimelineItem(item);
  }
}

function unhandledTimelineItem(item: never): null {
  console.warn("[timeline] unhandled item kind", item);
  return null;
}

function copyText(text: string): void {
  void navigator.clipboard.writeText(text).catch((error: unknown) => {
    console.error("[renderer] navigator.clipboard.writeText failed", error);
  });
}

/** An extension message, drawn like terminal pi: its customType labels the markdown. */
function TimelineCustomMessage({ item }: { readonly item: SessionTranscriptCustomMessage }) {
  return (
    <article className="timeline-item timeline-item--custom" data-testid="timeline-custom-message">
      <div className="timeline-item__custom-type">{item.customType}</div>
      <MessageMarkdown text={item.text} />
    </article>
  );
}

function TimelineMessage({
  item,
  sourceMessageIndex,
  onForkFromMessage,
  scheduledOrigin,
  workspacePath,
  onOpenWorkspaceFileLine,
  annotationMarkers,
  onOpenAnnotation,
  thinkingActive,
}: {
  readonly item: SessionTranscriptMessage;
  readonly sourceMessageIndex?: number;
  readonly onForkFromMessage?: (messageIndex: number, preview?: string) => void;
  readonly scheduledOrigin?: ScheduledTaskOrigin;
  readonly workspacePath?: string;
  readonly onOpenWorkspaceFileLine?: (target: WorkspaceFileLine) => void;
  readonly annotationMarkers?: readonly AnnotationMarker[];
  readonly onOpenAnnotation?: OpenAnnotation;
  readonly thinkingActive?: boolean;
}) {
  const { t, locale } = useTranslation();
  const articleRef = useRef<HTMLElement | null>(null);
  const crossProject = useMemo(
    () => (item.role === "user" ? parseCrossProjectMessage(item.text) : null),
    [item.role, item.text],
  );
  const annotated = useMemo(
    () => (item.role === "user" ? parseAnnotatedPrompt(item.text) : null),
    [item.role, item.text],
  );
  const markers =
    annotationMarkers?.length && onOpenAnnotation ? (
      <AnnotationMarkers
        articleRef={articleRef}
        markers={annotationMarkers}
        messageId={item.id}
        onOpen={onOpenAnnotation}
      />
    ) : null;

  if (item.role === "user") {
    const body = annotated ? annotated.body : (crossProject?.body ?? item.text);
    return (
      <article className="timeline-item timeline-item--user" ref={articleRef}>
        <div className="timeline-item__user-stack">
          {scheduledOrigin ? (
            <div className="timeline-item__scheduled-origin" data-testid="sent-by-scheduled-task">
              {t("conversation.timeline.sentByTask")}
            </div>
          ) : null}
          {crossProject ? (
            <div className="timeline-item__project-origin" data-testid="message-project-origin">
              {t("conversation.timeline.fromProject", { project: crossProject.project })}
            </div>
          ) : null}
          <div className="timeline-item__bubble">
            {item.attachments?.length ? (
              <div className="timeline-item__attachments">
                {item.attachments.map((attachment, index) =>
                  attachment.kind === "image" ? (
                    <ImageAttachmentThumb
                      className="timeline-item__attachment timeline-item__attachment--image"
                      key={`${item.id}:${index}`}
                      name={
                        attachment.name ??
                        t("conversation.timeline.attachmentN", { index: index + 1 })
                      }
                      src={`data:${attachment.mimeType};base64,${attachment.data}`}
                    />
                  ) : (
                    <div
                      className="timeline-item__attachment timeline-item__attachment--file"
                      key={`${item.id}:${index}`}
                      title={attachment.fsPath}
                    >
                      <span className="timeline-item__attachment-icon" aria-hidden="true">
                        <FileIcon />
                      </span>
                      <span className="timeline-item__attachment-name">{attachment.name}</span>
                    </div>
                  ),
                )}
              </div>
            ) : null}
            {annotated ? <SentAnnotations annotations={annotated.annotations} /> : null}
            {annotated && !body.trim() ? null : <MessageMarkdown annotationRoot text={body} />}
          </div>
          <div className="timeline-item__user-meta">
            <time className="timeline-item__timestamp" title={item.createdAt}>
              {formatClockTime(item.createdAt, locale)}
            </time>
            <button
              type="button"
              className="timeline-item__action"
              title={t("conversation.timeline.copy")}
              aria-label={t("conversation.timeline.copy")}
              data-testid="copy-message"
              onClick={() => copyText(body)}
            >
              <CopyIcon />
            </button>
          </div>
        </div>
        {markers}
      </article>
    );
  }

  if (item.role === "branchSummary" || item.role === "compactionSummary") {
    return (
      <article className="timeline-item timeline-item--summary-card">
        <div className="timeline-item__summary-eyebrow">
          {item.role === "branchSummary"
            ? t("conversation.timeline.branchSummary")
            : t("conversation.timeline.compactionSummary")}
        </div>
        <MessageMarkdown text={item.text} />
      </article>
    );
  }

  // The row stays while a run streams (Fork is disabled then), so the transcript never
  // shifts by the row's height when a run starts or ends.
  const forkable = sourceMessageIndex !== undefined;
  return (
    <article className="timeline-item timeline-item--assistant" ref={articleRef}>
      {item.thinking ? <ThinkingBlock thinking={item.thinking} active={thinkingActive} /> : null}
      <MessageMarkdown
        annotationRoot
        onOpenWorkspaceFileLine={onOpenWorkspaceFileLine}
        text={item.text}
        workspacePath={workspacePath}
      />
      <div className="timeline-item__actions">
        <button
          type="button"
          className="timeline-item__action"
          title={t("conversation.timeline.copy")}
          aria-label={t("conversation.timeline.copy")}
          data-testid="copy-message"
          onClick={() => copyText(item.text)}
        >
          <CopyIcon />
        </button>
        {forkable ? (
          <button
            type="button"
            className="timeline-item__action"
            title={
              onForkFromMessage
                ? t("conversation.timeline.forkFromHere")
                : t("conversation.timeline.forkUnavailable")
            }
            aria-label={t("conversation.timeline.forkFromHere")}
            data-testid="fork-from-message"
            disabled={!onForkFromMessage}
            onClick={() => onForkFromMessage?.(sourceMessageIndex, item.text)}
          >
            <ForkIcon />
            <span className="timeline-item__action-label">{t("conversation.timeline.fork")}</span>
          </button>
        ) : null}
      </div>
      {markers}
    </article>
  );
}

/**
 * The assistant message's reasoning, collapsed to one quiet line while streaming and after
 * the run, expandable to the full text the model produced. Only rendered for messages
 * that carry thinking content, so non-thinking models see no dead UI.
 */
function ThinkingBlock({
  thinking,
  active,
}: {
  readonly thinking: string;
  readonly active?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const firstLine = useMemo(() => {
    const line = thinking.split("\n").find((candidate) => candidate.trim().length > 0);
    if (!line) return "";
    return line.length > 160 ? `${line.slice(0, 160)}…` : line;
  }, [thinking]);

  return (
    <div
      className={`timeline-thinking${active ? " timeline-thinking--active" : ""}`}
      data-testid="timeline-thinking"
    >
      <button
        type="button"
        className="timeline-thinking__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="timeline-thinking__chevron" aria-hidden="true">
          <ChevronRightIcon />
        </span>
        <span className="timeline-thinking__label">
          {active
            ? t("conversation.timeline.thinkingRunning")
            : t("conversation.timeline.thinking")}
        </span>
        {!expanded && firstLine ? (
          <span className="timeline-thinking__preview">{firstLine}</span>
        ) : null}
      </button>
      {expanded ? <div className="timeline-thinking__body">{thinking}</div> : null}
    </div>
  );
}

function TimelineActivityItem({ item }: { readonly item: TimelineActivity }) {
  const { t, locale } = useTranslation();
  const label = activityLabel(item, t);
  const metadata = activityMetadata(item, locale, t, (durationMs) =>
    formatDuration(durationMs, locale),
  );
  return (
    <div className={`timeline-activity timeline-activity--${item.tone ?? "neutral"}`}>
      <span className="timeline-activity__label">{label}</span>
      {item.detail ? <span className="timeline-activity__detail">{item.detail}</span> : null}
      {metadata ? <span className="timeline-activity__meta">{metadata}</span> : null}
    </div>
  );
}

function TimelineToolCallItem({
  item,
  expanded,
  onToggle,
  onViewFileInDiff,
}: {
  readonly item: TimelineToolCall;
  readonly expanded: boolean;
  readonly onToggle?: (callId: string) => void;
  readonly onViewFileInDiff?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const hasContent = item.input !== undefined || item.output !== undefined;
  // An extension's tool shows the label it registered instead of a guess from its name.
  const extensionLabel = useExtensionToolLabel(item.toolName);
  const writeTool = isWriteTool(item.toolName);
  const diffText = writeTool ? extractDiffFromOutput(item.output) : undefined;
  const diffStats = diffText ? countDiffStats(diffText) : undefined;
  const compactLabel =
    extensionLabel === undefined
      ? buildCompactLabel(item, diffStats, t)
      : extensionToolRowLabel(extensionLabel, item.input);
  const filePath = writeTool ? extractFilename(item.input) || undefined : undefined;
  const diffLanguage = diffText && filePath ? extensionToLanguage(filePath) : undefined;
  const inlineDetail = item.status === "error" ? item.detail : undefined;
  const images = toolOutputImages(item.output);

  const handleCopy = () => {
    const text = diffText ?? formatToolContent(item.input, item.output);
    void navigator.clipboard.writeText(text).catch((error: unknown) => {
      console.error("[renderer] navigator.clipboard.writeText failed", error);
    });
  };

  return (
    <article className={`timeline-tool timeline-tool--${item.status}`}>
      <div className="timeline-tool__header-row">
        <span className="timeline-tool__glyph" aria-hidden="true">
          {extensionLabel === undefined || diffText ? toolGlyph(item.toolName) : <SparkIcon />}
        </span>
        <button
          className="timeline-tool__header"
          type="button"
          aria-expanded={expanded}
          disabled={!hasContent}
          onClick={() => onToggle?.(item.callId)}
        >
          {hasContent ? (
            <span
              className={`timeline-tool__chevron ${expanded ? "timeline-tool__chevron--expanded" : ""}`}
            >
              <ChevronRightIcon />
            </span>
          ) : null}
          <span className="timeline-tool__label">{compactLabel}</span>
          {inlineDetail ? <span className="timeline-tool__detail">{inlineDetail}</span> : null}
          {diffStats ? (
            <span className="timeline-tool__diff-stats">
              <span className="timeline-tool__stat-add">+{diffStats.added}</span>{" "}
              <span className="timeline-tool__stat-del">-{diffStats.removed}</span>
            </span>
          ) : null}
          <span className="timeline-tool__meta-inline">
            <span className="timeline-tool__status-pip" aria-hidden="true" />
            {`${item.toolName} \u00b7 ${statusLabel(item.status, t)}`}
          </span>
        </button>
        {filePath && onViewFileInDiff ? (
          <button
            aria-label={t("conversation.timeline.viewInChanges", { file: filePath })}
            className="icon-button timeline-tool__view-in-diff"
            data-testid="timeline-tool-view-in-diff"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewFileInDiff(filePath);
            }}
          >
            <DiffIcon />
          </button>
        ) : null}
      </div>
      {images.length > 0 ? (
        // Shown while collapsed too: an image a tool made is a result in itself.
        <div className="timeline-tool__images" data-testid="timeline-tool-images">
          {images.map((image, index) => (
            <ImageAttachmentThumb
              className="timeline-tool__image"
              key={`${item.callId}:${index}`}
              name={t("conversation.timeline.imageN", { tool: item.toolName, index: index + 1 })}
              src={image.src}
            />
          ))}
        </div>
      ) : null}
      {expanded && hasContent ? (
        <div className="timeline-tool__body">
          {diffText ? (
            <>
              <div className="timeline-tool__diff-header">
                <span className="timeline-tool__diff-filename">
                  {extractFilename(item.input)}
                  {diffStats ? (
                    <span className="timeline-tool__diff-stats">
                      {" "}
                      <span className="timeline-tool__stat-add">+{diffStats.added}</span>{" "}
                      <span className="timeline-tool__stat-del">-{diffStats.removed}</span>
                    </span>
                  ) : null}
                </span>
                <button
                  className="icon-button timeline-tool__copy"
                  type="button"
                  onClick={handleCopy}
                  aria-label={t("conversation.timeline.copy")}
                >
                  <CopyIcon />
                </button>
              </div>
              <InlineDiff diff={diffText} language={diffLanguage} />
            </>
          ) : (
            <>
              <div className="timeline-tool__body-actions">
                <button
                  className="icon-button timeline-tool__copy"
                  type="button"
                  onClick={handleCopy}
                  aria-label={t("conversation.timeline.copy")}
                >
                  <CopyIcon />
                </button>
              </div>
              <pre className="timeline-tool__pre">{formatToolContent(item.input, item.output)}</pre>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

function isWriteTool(toolName: string): boolean {
  return /write|edit|patch|apply/i.test(toolName);
}

function toolGlyph(toolName: string) {
  if (isWriteTool(toolName)) {
    return <DiffIcon />;
  }
  if (/bash|shell|exec|terminal|command|run/i.test(toolName)) {
    return <TerminalIcon />;
  }
  if (/read|view|cat|open|file|glob|grep|search|ls/i.test(toolName)) {
    return <FileIcon />;
  }
  return <SparkIcon />;
}

function buildCompactLabel(
  item: TimelineToolCall,
  diffStats: { added: number; removed: number } | undefined,
  t: Translate,
): string {
  if (isWriteTool(item.toolName)) {
    const filename = extractFilename(item.input);
    if (filename) {
      return t("conversation.timeline.edited", { file: shortenPath(filename) });
    }
  }
  // A built-in tool row names what it did from its kind, so it reads in the active
  // language; an extension's tool keeps the label it registered.
  return toolRowLabel(item, t);
}

function extractFilename(input: unknown): string {
  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    const path = record.file_path ?? record.filePath ?? record.path ?? record.filename;
    if (typeof path === "string") {
      return path;
    }
  }
  return "";
}

function shortenPath(filePath: string): string {
  // Show last 2-3 path segments for readability
  const parts = filePath.split("/");
  if (parts.length <= 3) {
    return filePath;
  }
  return parts.slice(-3).join("/");
}

function countDiffStats(diff: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      added += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      removed += 1;
    }
  }
  return { added, removed };
}

function formatToolContent(input: unknown, output: unknown): string {
  const parts: string[] = [];
  if (input !== undefined) {
    parts.push(typeof input === "string" ? input : stringifyToolValue(input));
  }
  if (output !== undefined) {
    parts.push(typeof output === "string" ? output : stringifyToolValue(output));
  }
  return parts.join("\n\n");
}

function statusLabel(status: "running" | "success" | "error", t: Translate) {
  if (status === "running") return t("conversation.timeline.statusRunning");
  if (status === "success") return t("conversation.timeline.statusDone");
  return t("conversation.timeline.statusFailed");
}

function TimelineTurnMarkerItem({ item }: { readonly item: TimelineTurnMarker }) {
  const { t, locale } = useTranslation();
  return (
    <div className="timeline-turn-marker" data-testid="timeline-turn-marker">
      <span className="timeline-turn-marker__label">
        {t("conversation.timeline.workedFor", {
          duration: formatDuration(item.durationMs, locale),
        })}
      </span>
    </div>
  );
}

function TimelineWorkingItem({ item }: { readonly item: TimelineWorkingIndicator }) {
  const label = useRunningLabel(item.startedAt);
  return (
    <div className="timeline-working" data-testid="timeline-working">
      <span className="timeline-working__label">{label}</span>
    </div>
  );
}

function TimelineSummaryItem({ item }: { readonly item: TimelineSummary }) {
  const { t, locale } = useTranslation();
  const label = summaryLabel(item, locale, t);
  const metadata = summaryMetadata(item, locale);
  if (item.presentation === "divider") {
    return (
      <div className="timeline-summary">
        <span>{label}</span>
        {metadata ? <span className="timeline-summary__meta">{metadata}</span> : null}
      </div>
    );
  }

  return (
    <div className="timeline-activity timeline-activity--summary">
      <span className="timeline-activity__label">{label}</span>
      {metadata ? <span className="timeline-activity__meta">{metadata}</span> : null}
    </div>
  );
}
