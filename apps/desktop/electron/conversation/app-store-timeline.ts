import { isCardEntryItem, sessionKey } from "@pi-gui/session-driver";
import type { SessionTranscriptItem, SessionTranscriptPin } from "@pi-gui/session-driver";
import type { SessionDriverEvent, SessionQueuedMessage, SessionRef } from "@pi-gui/session-driver";
import type {
  BuiltinToolLabel,
  TimelineMetrics,
  TimelineToolCall,
  TranscriptMessage,
} from "../../contracts/desktop-state";
import {
  extensionToolRowLabel,
  toolInputSummary,
  truncate,
  type ExtensionToolLabels,
} from "../../contracts/tool-labels";
import {
  formatElapsedDuration,
  makeActivityItem,
  makeSummaryItem,
  makeToolItem,
  makeTranscriptMessage,
  makeTranscriptMessageWithAttachments,
} from "../application/app-store-utils";
import {
  archiveChildThreadsToolName,
  createChildThreadToolName,
  listThreadsToolName,
  orchestrationToolNames,
  readThreadToolName,
  sendMessageToThreadToolName,
} from "../orchestration/orchestration-runtime";

export interface RunMetrics {
  readonly startedAt: string;
  /** The run these counts belong to; a Stop settles a run without runCompleted. */
  readonly runId?: string;
  toolCount: number;
  searchCount: number;
  fileCount: number;
}

interface TimelineRuntimeState {
  readonly runMetricsBySession: Map<string, RunMetrics>;
  readonly runningSinceBySession: Map<string, string>;
  readonly activeAssistantMessageBySession: Map<string, string>;
  readonly pendingAssistantMessageBySession: Map<string, string>;
  /** Labels of the tools the session's folder extensions registered. */
  readonly extensionToolLabels: (sessionRef: SessionRef) => ExtensionToolLabels;
}

export function timelineFromDriverTranscript(
  items: readonly SessionTranscriptItem[],
  extensionToolLabels: ExtensionToolLabels,
): TranscriptMessage[] {
  return items.map((item) => {
    if (item.kind !== "tool") {
      return item;
    }
    const detail = detailFromOutput(item.output);
    const extensionLabel = extensionToolLabels.get(item.toolName);
    // A folder extension's tool keeps the label it registered; only our own tools get a kind.
    const resolved =
      extensionLabel === undefined
        ? describeToolLabel(item.toolName, item.input)
        : { label: extensionToolRowLabel(extensionLabel, item.input), toolLabel: undefined };
    return {
      ...makeToolItem(item.callId, item.toolName, item.status, resolved.label, {
        ...(detail !== undefined ? { detail } : {}),
        ...(item.input !== undefined ? { input: item.input } : {}),
        ...(item.output !== undefined ? { output: item.output } : {}),
        ...(resolved.toolLabel ? { toolLabel: resolved.toolLabel } : {}),
      }),
      createdAt: item.createdAt,
    };
  });
}

export function appendUserMessage(
  transcriptCache: Map<string, readonly TranscriptMessage[]>,
  sessionRef: SessionRef,
  text: string,
  attachments: NonNullable<Extract<TranscriptMessage, { kind: "message" }>["attachments"]> = [],
): string {
  const key = sessionKey(sessionRef);
  const transcript = [...(transcriptCache.get(key) ?? [])];
  const message =
    attachments.length > 0
      ? makeTranscriptMessageWithAttachments("user", text, attachments)
      : makeTranscriptMessage("user", text);
  transcript.push(message);
  transcriptCache.set(key, transcript);
  return message.id;
}

export function appendQueuedUserMessage(
  transcriptCache: Map<string, readonly TranscriptMessage[]>,
  sessionRef: SessionRef,
  message: SessionQueuedMessage,
): void {
  const key = sessionKey(sessionRef);
  const transcript = [...(transcriptCache.get(key) ?? [])];
  const existingIndex = transcript.findIndex(
    (item) => item.kind === "message" && item.id === message.id,
  );
  const nextMessage = {
    kind: "message" as const,
    id: message.id,
    role: "user" as const,
    text: message.text,
    createdAt: message.createdAt,
    ...(message.attachments?.length
      ? {
          attachments: message.attachments.map((attachment) => ({ ...attachment })),
        }
      : {}),
  };

  if (existingIndex >= 0) {
    transcript[existingIndex] = nextMessage;
  } else {
    transcript.push(nextMessage);
  }
  transcriptCache.set(key, transcript);
}

export function appendAssistantDelta(
  transcriptCache: Map<string, readonly TranscriptMessage[]>,
  activeAssistantMessageBySession: Map<string, string>,
  sessionRef: SessionRef,
  text: string,
): void {
  const key = sessionKey(sessionRef);
  const transcript = [...(transcriptCache.get(key) ?? [])];
  const activeId = activeAssistantMessageBySession.get(key);

  if (activeId) {
    const index = transcript.findIndex((message) => message.id === activeId);
    const current = index >= 0 ? transcript[index] : undefined;
    if (current?.kind === "message") {
      transcript[index] = {
        ...current,
        text: `${current.text}${text}`,
      };
    } else {
      const message = makeTranscriptMessage("assistant", text);
      transcript.push(message);
      activeAssistantMessageBySession.set(key, message.id);
    }
  } else {
    const message = makeTranscriptMessage("assistant", text);
    transcript.push(message);
    activeAssistantMessageBySession.set(key, message.id);
  }

  transcriptCache.set(key, transcript);
}

export function clearActiveAssistantMessage(
  activeAssistantMessageBySession: Map<string, string>,
  sessionRef: SessionRef,
): void {
  activeAssistantMessageBySession.delete(sessionKey(sessionRef));
}

export function applyTimelineEvent(
  transcriptCache: Map<string, readonly TranscriptMessage[]>,
  event: SessionDriverEvent,
  state: TimelineRuntimeState,
): void {
  if (event.type === "assistantDelta") {
    return;
  }

  const key = sessionKey(event.sessionRef);
  const previous = transcriptCache.get(key);
  const transcript = [...(previous ?? [])];
  const currentMetrics = state.runMetricsBySession.get(key);

  switch (event.type) {
    case "assistantMessageEnded": {
      const activeId = state.activeAssistantMessageBySession.get(key);
      if (activeId) state.pendingAssistantMessageBySession.set(key, activeId);
      else state.pendingAssistantMessageBySession.delete(key);
      clearActiveAssistantMessage(state.activeAssistantMessageBySession, event.sessionRef);
      return;
    }
    case "assistantMessagePersisted": {
      const endedId = state.pendingAssistantMessageBySession.get(key);
      state.pendingAssistantMessageBySession.delete(key);
      const index = transcript.findIndex((item) => item.id === endedId);
      const ended = transcript[index];
      if (ended?.kind !== "message" || ended.role !== "assistant") return;
      transcript[index] = { ...ended, sourceMessageId: event.sourceMessageId };
      break;
    }
    case "sessionOpened":
      state.pendingAssistantMessageBySession.delete(key);
      transcript.push(
        makeActivityItem("Resumed session", {
          activity: "resumed",
          metadata: relativeDetail(event.timestamp),
          timestamp: event.timestamp,
        }),
      );
      break;
    case "sessionUpdated":
      // A Stop publishes only idle, so a new run id (not a missing start) begins a new run.
      if (
        event.snapshot.status === "running" &&
        event.snapshot.runningRunId &&
        (!state.runningSinceBySession.has(key) ||
          (currentMetrics?.runId !== undefined &&
            currentMetrics.runId !== event.snapshot.runningRunId))
      ) {
        state.runningSinceBySession.set(key, event.timestamp);
        state.runMetricsBySession.set(key, {
          startedAt: event.timestamp,
          runId: event.snapshot.runningRunId,
          toolCount: 0,
          searchCount: 0,
          fileCount: 0,
        });
      }
      break;
    case "queuedMessageStarted":
      state.pendingAssistantMessageBySession.delete(key);
      clearActiveAssistantMessage(state.activeAssistantMessageBySession, event.sessionRef);
      appendQueuedUserMessage(transcriptCache, event.sessionRef, event.message);
      return;
    case "toolStarted": {
      clearActiveAssistantMessage(state.activeAssistantMessageBySession, event.sessionRef);
      const metrics = currentMetrics ?? {
        startedAt: event.timestamp,
        toolCount: 0,
        searchCount: 0,
        fileCount: 0,
      };
      metrics.toolCount += 1;
      const extensionLabel = state.extensionToolLabels(event.sessionRef).get(event.toolName);
      // Extension and thread tools count as tools: their names say nothing about files or searches.
      const nameHeuristics =
        extensionLabel === undefined && !orchestrationToolNames.has(event.toolName);
      if (nameHeuristics && looksLikeSearch(event.toolName, event.input)) {
        metrics.searchCount += 1;
      }
      if (nameHeuristics && looksLikeFileExplore(event.toolName, event.input)) {
        metrics.fileCount += 1;
      }
      state.runMetricsBySession.set(key, metrics);
      const resolved =
        extensionLabel === undefined
          ? describeToolLabel(event.toolName, event.input)
          : { label: extensionToolRowLabel(extensionLabel, event.input), toolLabel: undefined };
      upsertToolRow(
        transcript,
        event.callId,
        event.toolName,
        "running",
        resolved.label,
        undefined,
        event.input,
        undefined,
        resolved.toolLabel,
      );
      break;
    }
    case "toolUpdated":
      upsertToolRow(
        transcript,
        event.callId,
        undefined,
        "running",
        undefined,
        event.text ?? progressLabel(event.progress),
      );
      break;
    case "toolFinished":
      upsertToolRow(
        transcript,
        event.callId,
        undefined,
        event.success ? "success" : "error",
        undefined,
        detailFromOutput(event.output),
        undefined,
        event.output,
      );
      break;
    case "runCompleted": {
      const metrics = currentMetrics;
      clearRunState(key, event.sessionRef, state);
      if (metrics) {
        const label = summaryLabel(metrics);
        if (label) {
          transcript.push(
            makeSummaryItem(label, {
              presentation: "inline",
              summary: "runSummary",
              metrics: runMetricsSnapshot(metrics),
              timestamp: event.timestamp,
            }),
          );
        }
        // No "Worked for" row here: the renderer derives one per turn from
        // timestamps and places it above the turn's final reply.
      } else {
        transcript.push(
          makeSummaryItem("Completed", {
            presentation: "divider",
            summary: "completed",
            metadata: relativeDetail(event.timestamp),
            timestamp: event.timestamp,
          }),
        );
      }
      break;
    }
    case "runFailed": {
      const metrics = currentMetrics;
      const latestToolError = metrics
        ? latestErrorToolDetail(transcript, metrics.startedAt)
        : undefined;
      const failureLabel = clearerRunFailureLabel(event.error.message, latestToolError);
      const failureDetail = event.error.code;
      // The failure sentence belongs to the runtime, so it stays as written; the kind only
      // marks it as a run failure, and the duration lets the renderer phrase the elapsed time.
      const durationMs = metrics
        ? Math.max(0, Date.parse(event.timestamp) - Date.parse(metrics.startedAt))
        : undefined;
      clearRunState(key, event.sessionRef, state);
      transcript.push(
        makeActivityItem(failureLabel, {
          tone: "error",
          metadata: metrics ? workedForLabel(metrics.startedAt, event.timestamp) : undefined,
          detail: failureDetail,
          ...(metrics ? { timestamp: event.timestamp, durationMs } : {}),
        }),
      );
      break;
    }
    case "sessionClosed":
      clearRunState(key, event.sessionRef, state);
      transcript.push(
        makeActivityItem("Stopped", {
          activity: "stopped",
          metadata: relativeDetail(event.timestamp),
          timestamp: event.timestamp,
        }),
      );
      break;
    case "transcriptItemAppended": {
      // A pin shows above the composer, so it never ends or moves a streaming reply.
      if (event.item.kind === "pin") {
        upsertPin(transcript, event.item);
        break;
      }
      // Same id as the persisted entry, so a transcript reload replaces rather than duplicates it.
      // A keyed card (or a pin's error row) that is already shown updates where it is, as the
      // session file projects it.
      const existingIndex = transcript.findIndex((item) => item.id === event.item.id);
      if (existingIndex >= 0) {
        if (!isCardEntryItem(event.item)) return;
        transcript[existingIndex] = event.item;
        break;
      }
      // pi saves a streaming reply only when it ends, so a card (or its error row) appended
      // mid-reply comes before that reply in the session file. Place it there now so a reload never moves it.
      const streamingId = state.activeAssistantMessageBySession.get(key);
      const streamingIndex =
        isCardEntryItem(event.item) && streamingId
          ? transcript.findIndex((item) => item.id === streamingId)
          : -1;
      if (streamingIndex >= 0) {
        transcript.splice(streamingIndex, 0, event.item);
        break;
      }
      // Otherwise it lands between assistant messages like a tool row: the reply above keeps
      // its row and later text starts a new one below.
      clearActiveAssistantMessage(state.activeAssistantMessageBySession, event.sessionRef);
      transcript.push(event.item);
      break;
    }
    case "hostUiRequest":
      // Notices show as toasts; only errors also stay in the transcript.
      if (event.request.kind === "notify" && event.request.level === "error") {
        transcript.push(
          makeActivityItem(event.request.message, {
            tone: "error",
            metadata: relativeDetail(event.timestamp),
          }),
        );
      }
      break;
    default:
      break;
  }

  // Keep the same array when nothing changed: the window skips publishing an unchanged
  // transcript by identity, and frequent events (title updates, running ticks) change nothing.
  if (previous ? sameItems(previous, transcript) : transcript.length === 0) return;
  transcriptCache.set(key, transcript);
}

function sameItems(a: readonly TranscriptMessage[], b: readonly TranscriptMessage[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** Replaces a pin's earlier write, as the projection does; a pin written after removal is new. */
function upsertPin(transcript: TranscriptMessage[], pin: SessionTranscriptPin): void {
  const index = transcript.findIndex((item) => item.id === pin.id);
  const existing = transcript[index];
  if (existing?.kind === "pin" && (existing.card || !pin.card)) {
    transcript[index] = pin;
    return;
  }
  if (index >= 0) transcript.splice(index, 1);
  transcript.push(pin);
}

function upsertToolRow(
  transcript: TranscriptMessage[],
  callId: string,
  toolName?: string,
  status?: "running" | "success" | "error",
  label?: string,
  detail?: string,
  input?: unknown,
  output?: unknown,
  toolLabel?: BuiltinToolLabel,
) {
  const index = transcript.findIndex((item) => item.kind === "tool" && item.callId === callId);
  const existing = index >= 0 ? transcript[index] : undefined;
  const existingTool = existing?.kind === "tool" ? existing : undefined;
  // A row that arrives before its toolStarted keeps a neutral "pending" kind: the run is
  // working, and the renderer phrases that itself instead of reading this sentence.
  const kind = toolLabel ?? existingTool?.toolLabel ?? "pending";
  const next = makeToolItem(
    callId,
    toolName ?? existingTool?.toolName ?? "tool",
    status ?? existingTool?.status ?? "running",
    label ?? existingTool?.label ?? "Working",
    {
      detail: detail ?? existingTool?.detail,
      metadata: existingTool?.metadata,
      input: input ?? existingTool?.input,
      output: output ?? existingTool?.output,
      toolLabel: kind,
    },
  );

  if (index >= 0) {
    transcript[index] = {
      ...next,
      createdAt: existing?.createdAt ?? next.createdAt,
    };
    return;
  }

  transcript.push(next);
}

function clearRunState(key: string, sessionRef: SessionRef, state: TimelineRuntimeState): void {
  clearActiveAssistantMessage(state.activeAssistantMessageBySession, sessionRef);
  state.pendingAssistantMessageBySession.delete(key);
  state.runningSinceBySession.delete(key);
  state.runMetricsBySession.delete(key);
}

/**
 * The English label a built-in tool row carries in the store, plus the kind the renderer
 * phrases in the active locale. Both are written: the label keeps previews, stored
 * transcripts and older readers working, the kind lets a language switch re-phrase history.
 */
function describeToolLabel(
  toolName: string,
  input: unknown,
): { label: string; toolLabel: BuiltinToolLabel } {
  const detail = toolInputSummary(input);
  if (toolName === createChildThreadToolName) {
    return {
      label: detail ? `Started child thread: ${detail}` : "Started child thread",
      toolLabel: "createChildThread",
    };
  }
  if (toolName === listThreadsToolName) {
    return { label: "Listed threads", toolLabel: "listThreads" };
  }
  if (toolName === readThreadToolName) {
    return {
      label: detail ? `Read thread: ${detail}` : "Read thread",
      toolLabel: "readThread",
    };
  }
  if (toolName === sendMessageToThreadToolName) {
    return {
      label: detail ? `Sent message to thread: ${detail}` : "Sent message to thread",
      toolLabel: "sendMessageToThread",
    };
  }
  if (toolName === archiveChildThreadsToolName) {
    return { label: "Archived child threads", toolLabel: "archiveChildThreads" };
  }
  if (looksLikeSearch(toolName, input)) {
    return {
      label: detail ? `Searched ${detail}` : `Searched with ${toolName}`,
      toolLabel: "search",
    };
  }
  if (looksLikeFileExplore(toolName, input)) {
    if (toolName.toLowerCase() === "read") {
      return { label: detail ? `Read ${detail}` : "Read a file", toolLabel: "read" };
    }
    return {
      label: detail ? `Explored ${detail}` : `Explored files with ${toolName}`,
      toolLabel: "explore",
    };
  }
  return { label: detail ? `Ran ${toolName}: ${detail}` : `Ran ${toolName}`, toolLabel: "run" };
}

function progressLabel(progress: number | undefined): string | undefined {
  if (progress === undefined) {
    return undefined;
  }
  if (progress <= 1) {
    return `${Math.round(progress * 100)}%`;
  }
  return String(progress);
}

function detailFromOutput(output: unknown): string | undefined {
  if (isRecord(output)) {
    const directError =
      stringProperty(output, "error") ??
      stringProperty(output, "message") ??
      stringProperty(output, "stderr");
    if (directError) {
      return summarizeToolDetail(directError);
    }
  }
  if (isRecord(output) && Array.isArray(output.content)) {
    const text = output.content
      .map((part) =>
        isRecord(part) && part.type === "text" && typeof part.text === "string" ? part.text : "",
      )
      .join("\n")
      .trim();
    if (text) {
      return summarizeToolDetail(text);
    }
    // The row shows a tool's images itself, so the detail names them rather than dump their data.
    const images = output.content.flatMap((part) =>
      isRecord(part) && part.type === "image"
        ? [`[${stringProperty(part, "mimeType") ?? "image"} image]`]
        : [],
    );
    if (images.length > 0) {
      return summarizeToolDetail(images.join(" "));
    }
  }
  if (typeof output === "string") {
    return summarizeToolDetail(output);
  }
  if (output === undefined || output === null) {
    return undefined;
  }
  return truncate(JSON.stringify(output));
}

function looksLikeSearch(toolName: string, input: unknown): boolean {
  if (toolName.toLowerCase().includes("search")) {
    return true;
  }
  return typeof input === "string" && /https?:\/\/|site:|query|search/i.test(input);
}

function looksLikeFileExplore(toolName: string, input: unknown): boolean {
  if (/(read|glob|ls|list|open)/i.test(toolName)) {
    return true;
  }
  return typeof input === "string" && /\/|\.md|\.ts|file/i.test(input);
}

function summaryLabel(metrics: RunMetrics): string | undefined {
  const parts: string[] = [];
  if (metrics.fileCount > 0) {
    parts.push(`Explored ${metrics.fileCount} file${metrics.fileCount === 1 ? "" : "s"}`);
  }
  if (metrics.searchCount > 0) {
    parts.push(`${metrics.searchCount} search${metrics.searchCount === 1 ? "" : "es"}`);
  }
  if (parts.length === 0 && metrics.toolCount > 0) {
    parts.push(`Used ${metrics.toolCount} tool${metrics.toolCount === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** The counts a run summary row needs to phrase itself in the reader's language. */
function runMetricsSnapshot(metrics: RunMetrics): TimelineMetrics {
  return {
    toolCount: metrics.toolCount,
    searchCount: metrics.searchCount,
    fileCount: metrics.fileCount,
  };
}

function workedForLabel(startedAt: string, endedAt: string): string {
  return `Worked for ${formatElapsedDuration(startedAt, endedAt)}`;
}

function relativeDetail(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function summarizeToolDetail(value: string): string {
  return truncate(value);
}

function latestErrorToolDetail(
  transcript: readonly TranscriptMessage[],
  runStartedAt: string,
): string | undefined {
  const runStartedAtMs = Date.parse(runStartedAt);
  for (let index = transcript.length - 1; index >= 0; index -= 1) {
    const item = transcript[index];
    if (!item) {
      continue;
    }
    if (Number.isFinite(runStartedAtMs) && Date.parse(item.createdAt) < runStartedAtMs) {
      break;
    }
    if (item.kind === "tool" && item.status === "error" && item.detail) {
      return item.detail;
    }
  }
  return undefined;
}

function clearerRunFailureLabel(message: string, latestToolError: string | undefined): string {
  if (!latestToolError) {
    return message;
  }
  const normalized = message.trim().toLowerCase();
  if (
    normalized === "terminated" ||
    normalized === "failed" ||
    normalized === "error" ||
    normalized === "run failed"
  ) {
    return latestToolError;
  }
  return message;
}

function stringProperty(
  record: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
