import type {
  SessionTranscriptCard,
  SessionTranscriptCustomMessage,
  SessionTranscriptMessage,
  SessionTranscriptPin,
  SessionTranscriptRole,
} from "@pi-gui/session-driver";
import type { TurnChangeSummary } from "./review";

export type SessionRole = SessionTranscriptRole;
export type TimelineTone = "neutral" | "success" | "warning" | "error";
export type TimelineToolStatus = "running" | "success" | "error";
export type TimelineSummaryPresentation = "inline" | "divider";

/**
 * A line the app itself writes for a run's lifecycle. The main process stores the
 * kind next to the English `label`, so the renderer can re-phrase the history in the
 * active locale after a language switch instead of re-reading the stored sentence.
 */
export type TimelineActivityKind = "resumed" | "stopped";

/**
 * A row summary over a finished run. `completed` is the divider that closes a run the
 * store has no metrics for; `runSummary` re-counts what the run did.
 */
export type TimelineSummaryKind = "completed" | "runSummary";

/**
 * What one run did, kept as numbers so the renderer phrases them with the active
 * locale's plural rules rather than baking an English sentence into the transcript.
 */
export interface TimelineMetrics {
  readonly toolCount?: number;
  readonly searchCount?: number;
  readonly fileCount?: number;
}

/**
 * A built-in tool row the renderer can phrase itself. Tools a folder extension
 * registered keep their own label: that copy belongs to the extension, not to us.
 */
export type BuiltinToolLabel =
  | "pending"
  | "createChildThread"
  | "listThreads"
  | "readThread"
  | "sendMessageToThread"
  | "archiveChildThreads"
  | "search"
  | "read"
  | "explore"
  | "run";

export interface TimelineActivity {
  readonly kind: "activity";
  readonly id: string;
  readonly createdAt: string;
  /**
   * The English sentence as the main process phrased it. Still written so an older
   * renderer, a preview snippet and stored transcripts keep reading; the current
   * renderer prefers `activity` when it is present.
   */
  readonly label: string;
  readonly activity?: TimelineActivityKind;
  /** When the event happened, so the renderer can format its own time for `metadata`. */
  readonly timestamp?: string;
  /** How long the failed run took, for the renderer to phrase "Worked for …". */
  readonly durationMs?: number;
  readonly detail?: string;
  readonly metadata?: string;
  readonly tone?: TimelineTone;
}

export interface TimelineToolCall {
  readonly kind: "tool";
  readonly id: string;
  readonly callId: string;
  readonly toolName: string;
  readonly status: TimelineToolStatus;
  readonly label: string;
  readonly toolLabel?: BuiltinToolLabel;
  readonly detail?: string;
  readonly metadata?: string;
  readonly createdAt: string;
  readonly input?: unknown;
  readonly output?: unknown;
}

export interface TimelineSummary {
  readonly kind: "summary";
  readonly id: string;
  readonly createdAt: string;
  readonly label: string;
  readonly summary?: TimelineSummaryKind;
  readonly metrics?: TimelineMetrics;
  readonly timestamp?: string;
  readonly metadata?: string;
  readonly presentation: TimelineSummaryPresentation;
}

export type TranscriptMessage =
  | SessionTranscriptMessage
  | SessionTranscriptCustomMessage
  | SessionTranscriptCard
  | SessionTranscriptPin
  | TimelineActivity
  | TimelineToolCall
  | TimelineSummary;

/**
 * What the conversation timeline draws: the transcript without its pins, which show above the
 * composer. The renderer splits them off once, so a pin reaching the timeline fails typecheck.
 */
export type TimelineTranscriptItem = Exclude<TranscriptMessage, SessionTranscriptPin>;

/**
 * A derived, view-only marker inserted between turns to show how long the agent
 * worked on the preceding user prompt. Never persisted or produced by the store;
 * the timeline computes it from real message/tool timestamps at render time, so
 * it is kept out of {@link TranscriptMessage} to avoid leaking into store code.
 */
export interface TimelineTurnMarker {
  readonly kind: "turn-marker";
  readonly id: string;
  readonly durationMs: number;
}

/** A derived, view-only card listing the files one captured turn changed, placed after that turn. */
export interface TimelineTurnChanges {
  readonly kind: "turn-changes";
  readonly id: string;
  readonly turn: TurnChangeSummary;
}

/**
 * A derived, view-only "Working" line kept at the bottom of the turn that is still running, so
 * it stays under the latest tool row or reply text. `startedAt` is when the run began.
 */
export interface TimelineWorkingIndicator {
  readonly kind: "working";
  readonly id: "working-indicator";
  readonly startedAt?: string;
}

export type DisplayTimelineItem =
  TimelineTranscriptItem | TimelineTurnMarker | TimelineTurnChanges | TimelineWorkingIndicator;
