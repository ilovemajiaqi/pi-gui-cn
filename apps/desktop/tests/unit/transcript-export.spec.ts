import { expect, test } from "@playwright/test";
import {
  buildTranscriptMarkdown,
  transcriptExportFileName,
} from "../../contracts/transcript-export";
import type { TranscriptMessage } from "../../contracts/timeline-types";

const at = "2026-11-11T09:00:00.000Z";
const exportedAt = "2026-11-11T18:30:00.000Z";

function message(
  partial: Partial<Extract<TranscriptMessage, { kind: "message" }>>,
): TranscriptMessage {
  return {
    kind: "message",
    id: "m1",
    role: "user",
    text: "",
    createdAt: at,
    ...partial,
  };
}

test("renders messages with role headings and the export header", () => {
  const markdown = buildTranscriptMarkdown(
    [
      message({ role: "user", text: "Fix the failing test" }),
      message({ role: "assistant", text: "The test needed a **timeout**." }),
    ],
    { title: "Failing test", exportedAt },
  );
  expect(markdown).toContain("# Failing test");
  expect(markdown).toContain("_Exported 2026-11-11T18:30:00.000Z from pi-gui._");
  expect(markdown).toContain("## User");
  expect(markdown).toContain("Fix the failing test");
  expect(markdown).toContain("## Assistant");
  expect(markdown).toContain("The test needed a **timeout**.");
});

test("renders assistant thinking as a quoted section before the answer", () => {
  const markdown = buildTranscriptMarkdown(
    [
      message({
        role: "assistant",
        text: "Done.",
        thinking: "First line\n\nSecond line",
      }),
    ],
    { exportedAt },
  );
  expect(markdown).toContain("**Thought process**");
  expect(markdown).toContain("> First line");
  expect(markdown).toContain(">");
  expect(markdown).toContain("> Second line");
  expect(markdown.indexOf("**Thought process**")).toBeLessThan(markdown.indexOf("Done."));
});

test("renders tool rows with status, detail and fenced output", () => {
  const markdown = buildTranscriptMarkdown(
    [
      {
        kind: "tool",
        id: "t1",
        callId: "call1",
        toolName: "bash",
        status: "success",
        label: "Ran bash",
        detail: "npm test",
        output: "all green",
        createdAt: at,
      } as TranscriptMessage,
    ],
    { exportedAt },
  );
  expect(markdown).toContain("**Tool: bash — success**");
  expect(markdown).toContain("> npm test");
  expect(markdown).toContain("```text\nall green\n```");
});

test("lengthens the fence when the output itself contains a fence", () => {
  const markdown = buildTranscriptMarkdown(
    [
      {
        kind: "tool",
        id: "t1",
        callId: "call1",
        toolName: "bash",
        status: "success",
        label: "Ran bash",
        output: "```\nnested\n```",
        createdAt: at,
      } as TranscriptMessage,
    ],
    { exportedAt },
  );
  expect(markdown).toContain("````text\n```\nnested\n```\n````");
});

test("truncates oversized tool output with a marker", () => {
  const markdown = buildTranscriptMarkdown(
    [
      {
        kind: "tool",
        id: "t1",
        callId: "call1",
        toolName: "bash",
        status: "error",
        label: "Ran bash",
        output: "x".repeat(100_001),
        createdAt: at,
      } as TranscriptMessage,
    ],
    { exportedAt },
  );
  expect(markdown).toContain("… (truncated)");
  expect(markdown).toContain("**Tool: bash — error**");
});

test("renders summaries, activity lines, cards and skips pins", () => {
  const markdown = buildTranscriptMarkdown(
    [
      {
        kind: "summary",
        id: "s1",
        createdAt: at,
        label: "Completed",
        presentation: "inline",
      } as TranscriptMessage,
      {
        kind: "activity",
        id: "a1",
        createdAt: at,
        label: "Stopped",
        activity: "stopped",
      } as TranscriptMessage,
      {
        kind: "card",
        id: "c1",
        createdAt: at,
        card: { title: "Tests", tone: "success", rows: [{ label: "Passed", value: "12" }] },
      } as TranscriptMessage,
      {
        kind: "pin",
        id: "p1",
        createdAt: at,
        card: null,
      } as TranscriptMessage,
      {
        kind: "custom",
        id: "cu1",
        createdAt: at,
        customType: "notes",
        text: "extension line",
      } as TranscriptMessage,
    ],
    { exportedAt },
  );
  expect(markdown).toContain("_Completed_");
  expect(markdown).toContain("_Stopped_");
  expect(markdown).toContain("**Tests**");
  expect(markdown).toContain("- Passed: 12");
  expect(markdown).toContain("**[notes]**");
  expect(markdown).toContain("extension line");
  expect(markdown).not.toContain("pin");
});

test("lists attachments under their message", () => {
  const markdown = buildTranscriptMarkdown(
    [
      message({
        role: "user",
        text: "See attached",
        attachments: [
          { kind: "file", name: "log.txt", mimeType: "text/plain", fsPath: "/tmp/log.txt" },
        ],
      }),
    ],
    { exportedAt },
  );
  expect(markdown).toContain("- Attachment: log.txt");
});

test("derives a safe file name stem from the title", () => {
  expect(transcriptExportFileName("Fix the failing test", exportedAt)).toBe(
    "Fix-the-failing-test-20261111.md",
  );
  expect(transcriptExportFileName('a<b>:c/d*e?f"g', exportedAt)).toBe("abcdefg-20261111.md");
  expect(transcriptExportFileName("  ", exportedAt)).toBe("thread-20261111.md");
});
