import { test, expect } from "@playwright/test";
import type {
  TimelineActivity,
  TimelineSummary,
  TimelineToolCall,
} from "../../contracts/timeline-types";
import {
  activityLabel,
  activityMetadata,
  formatClockTime,
  formatDuration,
  summaryLabel,
  summaryMetadata,
  toolRowLabel,
} from "../../src/features/conversation/timeline-label";
import { translatorFor } from "../../src/i18n/translate";

const en = translatorFor("en");
const zh = translatorFor("zh-CN");

function activity(patch: Partial<TimelineActivity> = {}): TimelineActivity {
  return {
    kind: "activity",
    id: "activity-1",
    createdAt: "2026-01-01T09:14:00.000Z",
    label: "Resumed session",
    ...patch,
  };
}

function tool(patch: Partial<TimelineToolCall> = {}): TimelineToolCall {
  return {
    kind: "tool",
    id: "call-1",
    callId: "call-1",
    toolName: "read",
    status: "success",
    label: "Read a file",
    createdAt: "2026-01-01T09:14:00.000Z",
    ...patch,
  };
}

function summary(patch: Partial<TimelineSummary> = {}): TimelineSummary {
  return {
    kind: "summary",
    id: "summary-1",
    createdAt: "2026-01-01T09:14:00.000Z",
    label: "Completed",
    presentation: "divider",
    ...patch,
  };
}

test("a stored timeline row keeps English byte-identical to the sentence the store wrote", () => {
  // The e2e lanes assert these exact strings with `--lang=en-US`, and old transcripts
  // only carry `label`; phrasing them through the catalog must not change one character.
  expect(activityLabel(activity({ activity: "resumed" }), en)).toBe("Resumed session");
  expect(activityLabel(activity({ activity: "stopped", label: "Stopped" }), en)).toBe("Stopped");
  expect(summaryLabel(summary({ summary: "completed" }), "en", en)).toBe("Completed");
  expect(
    summaryLabel(
      summary({
        summary: "runSummary",
        presentation: "inline",
        label: "Explored 3 files, 2 searches",
        metrics: { fileCount: 3, searchCount: 2, toolCount: 5 },
      }),
      "en",
      en,
    ),
  ).toBe("Explored 3 files, 2 searches");
});

test("a built-in tool row reads in the active language and keeps its call detail", () => {
  const row = tool({ toolLabel: "read", input: { path: "src/app.ts" }, label: "Read src/app.ts" });
  expect(toolRowLabel(row, en)).toBe("Read src/app.ts");
  expect(toolRowLabel(row, zh)).toBe("已读取 src/app.ts");

  const listing = tool({ toolName: "glob", toolLabel: "explore", label: "Explored files" });
  expect(toolRowLabel(listing, en)).toBe("Explored files with glob");
  expect(toolRowLabel(listing, zh)).toBe("已用 glob 浏览文件");
});

test("a run summary counts in the reader's plural rules", () => {
  const one = summary({
    summary: "runSummary",
    presentation: "inline",
    metrics: { fileCount: 1, searchCount: 0, toolCount: 1 },
  });
  expect(summaryLabel(one, "en", en)).toBe("Explored 1 file");
  expect(summaryLabel(one, "zh-CN", zh)).toBe("浏览了 1 个文件");

  const toolsOnly = summary({
    summary: "runSummary",
    presentation: "inline",
    metrics: { fileCount: 0, searchCount: 0, toolCount: 2 },
  });
  expect(summaryLabel(toolsOnly, "en", en)).toBe("Used 2 tools");
  expect(summaryLabel(toolsOnly, "zh-CN", zh)).toBe("使用了 2 个工具");
});

test("a row without a semantic kind keeps the copy it arrived with", () => {
  // A folder extension registered this label and a runtime wrote this failure sentence:
  // neither is ours to reword, so both survive a language switch untouched.
  expect(activityLabel(activity({ label: "OAuth token expired" }), zh)).toBe("OAuth token expired");
  expect(toolRowLabel(tool({ label: "Look up ticket: T-42" }), zh)).toBe("Look up ticket: T-42");
  expect(summaryLabel(summary({ label: "Some stored sentence" }), "zh-CN", zh)).toBe(
    "Some stored sentence",
  );
  // A row stored before the kind existed falls back to its label, never to an empty line.
  expect(toolRowLabel(tool({ toolLabel: undefined, label: "Read src/app.ts" }), zh)).toBe(
    "Read src/app.ts",
  );
});

test("a working tool row names the pending state instead of the stored English fallback", () => {
  expect(toolRowLabel(tool({ toolLabel: "pending", label: "Working" }), en)).toBe("Working");
  expect(toolRowLabel(tool({ toolLabel: "pending", label: "Working" }), zh)).toBe("运行中");
});

test("activity metadata is formatted at render time, so it follows a language switch", () => {
  const at = activity({ activity: "resumed", timestamp: "2026-01-01T21:14:00.000Z" });
  expect(activityMetadata(at, "en", en, (ms) => formatDuration(ms, "en"))).toBe(
    formatClockTime(at.timestamp!, "en"),
  );
  expect(activityMetadata(at, "zh-CN", zh, (ms) => formatDuration(ms, "zh-CN"))).not.toBe(
    activityMetadata(at, "en", en, (ms) => formatDuration(ms, "en")),
  );

  const failed = activity({ label: "boom", durationMs: 8000 });
  expect(activityMetadata(failed, "en", en, (ms) => formatDuration(ms, "en"))).toBe(
    "Worked for 8s",
  );
  expect(activityMetadata(failed, "zh-CN", zh, (ms) => formatDuration(ms, "zh-CN"))).toBe(
    "本次运行 8秒",
  );
});

test("a stored summary keeps its note until a timestamp lets the renderer format one", () => {
  expect(summaryMetadata(summary({ metadata: "9:14 PM" }), "zh-CN")).toBe("9:14 PM");
  const stamped = summary({ timestamp: "2026-01-01T21:14:00.000Z", metadata: "9:14 PM" });
  expect(summaryMetadata(stamped, "zh-CN")).toBe(formatClockTime(stamped.timestamp!, "zh-CN"));
});

test("durations read in the locale's units and keep English's narrow forms", () => {
  expect(formatDuration(8000, "en")).toBe("8s");
  expect(formatDuration(125_000, "en")).toBe("2m 5s");
  expect(formatDuration(120_000, "en")).toBe("2m");
  expect(formatDuration(3_780_000, "en")).toBe("1h 3m");
  expect(formatDuration(3_600_000, "en")).toBe("1h");
  expect(formatDuration(8000, "zh-CN")).toBe("8秒");
  expect(formatDuration(125_000, "zh-CN")).toBe("2分钟 5秒");
});
