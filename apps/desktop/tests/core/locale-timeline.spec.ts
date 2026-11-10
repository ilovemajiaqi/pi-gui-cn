import { expect, test, type Page } from "@playwright/test";
import type { SessionRef } from "@pi-gui/session-driver";
import { translatorFor } from "../../src/i18n/translate";
import {
  type DesktopHarness,
  createSessionViaIpc,
  desktopShortcut,
  emitTestSessionEvent,
  getDesktopState,
  chooseSelectOption,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  waitForTimelineLayout,
  waitForWorkspaceByPath,
} from "../helpers/electron-app";

const english = translatorFor("en");
const chinese = translatorFor("zh-CN");

const THREAD_TITLE = "Locale timeline";
const READ_TOOL_CALL = "locale-read-call";
const REQUESTED_PATH = "src/app.ts";

/** The two window sizes the layout must survive in Chinese. */
const DESKTOP_SIZE = { width: 1280, height: 800 } as const;
const NARROW_SIZE = { width: 1024, height: 768 } as const;

async function setWindowSize(
  harness: DesktopHarness,
  window: Page,
  size: { readonly width: number; readonly height: number },
): Promise<void> {
  // setContentSize, not setSize: the assertion below reads the viewport, and on
  // Windows a frame-sized window reports an innerWidth short of the requested width.
  const resized = await harness.electronApp.evaluate(({ BrowserWindow }, bounds) => {
    const appWindow = BrowserWindow.getAllWindows()[0];
    if (!appWindow) return false;
    appWindow.setContentSize(bounds.width, bounds.height);
    return true;
  }, size);
  expect(resized).toBe(true);
  await expect
    .poll(() =>
      window.evaluate(() => ({
        width: globalThis.window.innerWidth,
        height: globalThis.window.innerHeight,
      })),
    )
    .toEqual({ width: size.width, height: size.height });
}

/** Seeds the rows the main process writes as prose: an activity line, a tool row and a summary. */
async function seedLocalizedRows(harness: DesktopHarness, window: Page): Promise<SessionRef> {
  const state = await getDesktopState(window);
  const workspace = state.workspaces.find((entry) => entry.id === state.selectedWorkspaceId);
  const session = workspace?.sessions.find((entry) => entry.id === state.selectedSessionId);
  if (!workspace || !session) throw new Error("Expected a selected session");
  const sessionRef = { workspaceId: workspace.id, sessionId: session.id } satisfies SessionRef;
  const snapshot = {
    ref: sessionRef,
    workspace: {
      workspaceId: workspace.id,
      path: workspace.path,
      displayName: workspace.name,
    },
    title: session.title,
    status: "running" as const,
    updatedAt: new Date().toISOString(),
    preview: "locale timeline",
    runningRunId: "locale-run",
  };

  const startedAt = new Date().toISOString();
  await emitTestSessionEvent(harness, {
    type: "sessionOpened",
    sessionRef,
    timestamp: startedAt,
    snapshot,
  });
  await emitTestSessionEvent(harness, {
    type: "sessionUpdated",
    sessionRef,
    timestamp: startedAt,
    snapshot,
  });
  await emitTestSessionEvent(harness, {
    type: "toolStarted",
    sessionRef,
    timestamp: startedAt,
    toolName: "read",
    callId: READ_TOOL_CALL,
    input: { path: REQUESTED_PATH },
  });
  await emitTestSessionEvent(harness, {
    type: "toolFinished",
    sessionRef,
    timestamp: startedAt,
    callId: READ_TOOL_CALL,
    success: true,
    output: "export const app = 1;",
  });
  await emitTestSessionEvent(harness, {
    type: "runCompleted",
    sessionRef,
    timestamp: new Date(Date.now() + 8_000).toISOString(),
    snapshot: { ...snapshot, status: "idle", runningRunId: undefined },
  });
  return sessionRef;
}

async function switchLocale(window: Page, locale: string): Promise<void> {
  await window.keyboard.press(desktopShortcut(","));
  const surface = window.getByTestId("settings-surface");
  await expect(surface).toBeVisible();
  // The language picker lives on the Appearance page.
  await surface.getByRole("button", { name: /^(Appearance|外观)$/ }).click();
  await chooseSelectOption(
    window,
    window.getByRole("combobox", { name: /^(Language|语言)$/ }),
    locale,
  );
  await expect(window.locator("html")).toHaveAttribute("lang", locale);
  await window.getByRole("button", { name: /^(Back to app|返回应用)$/ }).click();
  await expect(surface).toBeHidden();
}

async function expectNoHorizontalOverflow(window: Page): Promise<void> {
  const overflow = await window.evaluate(() => {
    const tolerance = 1;
    const pane = document.querySelector<HTMLElement>('[data-testid="timeline-pane"]');
    const transcript = document.querySelector<HTMLElement>('[data-testid="transcript"]');
    if (!pane || !transcript) throw new Error("Expected the timeline pane and transcript");
    return {
      pane: pane.scrollWidth - pane.clientWidth,
      transcript: transcript.scrollWidth - transcript.clientWidth,
      tolerance,
    };
  });
  expect(overflow.pane, "the timeline pane does not scroll sideways").toBeLessThanOrEqual(
    overflow.tolerance,
  );
  expect(overflow.transcript, "the transcript does not scroll sideways").toBeLessThanOrEqual(
    overflow.tolerance,
  );
}

test("rows the main process wrote in English read Chinese after a language switch", async () => {
  test.setTimeout(120_000);
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("locale-timeline");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspacePath);
    await createSessionViaIpc(window, workspacePath, THREAD_TITLE);
    await seedLocalizedRows(harness, window);
    await waitForTimelineLayout(window);

    const transcript = window.getByTestId("transcript");
    const toolRow = transcript.locator(".timeline-tool");
    await expect(toolRow).toHaveCount(1);
    // Stored rows keep the English the store wrote.
    await expect(toolRow.locator(".timeline-tool__label")).toHaveText(
      english("conversation.timeline.tool.readDetail", { detail: REQUESTED_PATH }),
    );
    await expect(
      transcript.getByText(english("conversation.timeline.activity.resumed")),
    ).toBeVisible();
    await expect(
      transcript.getByText(english("conversation.timeline.summary.explored", { count: 1 })),
    ).toBeVisible();

    await setWindowSize(harness, window, DESKTOP_SIZE);
    await switchLocale(window, "zh-CN");
    await waitForTimelineLayout(window);

    // The same stored rows re-read in Chinese: no restart, no rewritten transcript.
    await expect(toolRow.locator(".timeline-tool__label")).toHaveText(
      chinese("conversation.timeline.tool.readDetail", { detail: REQUESTED_PATH }),
    );
    await expect(
      transcript.getByText(chinese("conversation.timeline.activity.resumed")),
    ).toBeVisible();
    await expect(
      transcript.getByText(chinese("conversation.timeline.summary.explored", { count: 1 })),
    ).toBeVisible();
    await expect(
      transcript.getByText(english("conversation.timeline.activity.resumed")),
    ).toHaveCount(0);
    // The raw tool name and status stay legible beside the localized label.
    await expect(toolRow.locator(".timeline-tool__meta-inline")).toContainText("read");

    await expectNoHorizontalOverflow(window);
    await setWindowSize(harness, window, NARROW_SIZE);
    await waitForTimelineLayout(window);
    await expectNoHorizontalOverflow(window);
    await expect(
      transcript.getByText(chinese("conversation.timeline.summary.explored", { count: 1 })),
    ).toBeVisible();
  } finally {
    await harness.close();
  }
});
