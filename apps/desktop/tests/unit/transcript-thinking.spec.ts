import { expect, test } from "@playwright/test";
import { sessionKey, type SessionDriverEvent } from "@pi-gui/session-driver";
import type { TranscriptMessage } from "../../contracts/timeline-types";
import {
  appendAssistantDelta,
  appendAssistantThinkingDelta,
  applyTimelineEvent,
} from "../../electron/conversation/app-store-timeline";

const sessionRef = { workspaceId: "workspace", sessionId: "session" };
const key = sessionKey(sessionRef);
const timestamp = "2026-11-11T09:00:00.000Z";

function fixture() {
  const transcript = new Map<string, readonly TranscriptMessage[]>();
  const state: Parameters<typeof applyTimelineEvent>[2] = {
    activeAssistantMessageBySession: new Map(),
    pendingAssistantMessageBySession: new Map(),
    extensionToolLabels: () => new Map(),
    runningSinceBySession: new Map(),
    runMetricsBySession: new Map(),
  };
  const send = (event: SessionDriverEvent) => applyTimelineEvent(transcript, event, state);
  const think = (text: string) =>
    appendAssistantThinkingDelta(
      transcript,
      state.activeAssistantMessageBySession,
      sessionRef,
      text,
    );
  const append = (text: string) =>
    appendAssistantDelta(transcript, state.activeAssistantMessageBySession, sessionRef, text);
  return { transcript, state, send, think, append };
}

test("a thinking delta before any text creates the assistant row with reasoning only", () => {
  const h = fixture();
  h.think("First thoughts. ");
  h.think("More thoughts.");
  const rows = h.transcript.get(key)!;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    kind: "message",
    role: "assistant",
    text: "",
    thinking: "First thoughts. More thoughts.",
  });
  expect(h.state.activeAssistantMessageBySession.get(key)).toBe(rows[0]!.id);
});

test("reasoning accumulates on the active row while answer text lands on the same row", () => {
  const h = fixture();
  h.think("Plan the change.");
  h.append("Here is the change.");
  const rows = h.transcript.get(key)!;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    role: "assistant",
    text: "Here is the change.",
    thinking: "Plan the change.",
  });
});

test("a tool start closes the active row, so later reasoning opens a new row", () => {
  const h = fixture();
  h.think("Read the file first.");
  h.send({ type: "toolStarted", sessionRef, timestamp, toolName: "read", callId: "call-1" });
  h.think("Now summarize.");
  const rows = h.transcript.get(key)!;
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({ thinking: "Read the file first." });
  expect(rows[1]).toMatchObject({ kind: "tool", callId: "call-1" });
  expect(rows[2]).toMatchObject({ thinking: "Now summarize.", text: "" });
  expect(h.state.activeAssistantMessageBySession.get(key)).toBe(rows[2]!.id);
});

test("thinking delta events stay out of applyTimelineEvent like text deltas", () => {
  const h = fixture();
  h.send({ type: "assistantThinkingDelta", sessionRef, timestamp, text: "ignored here" });
  expect(h.transcript.get(key)).toBeUndefined();
});
