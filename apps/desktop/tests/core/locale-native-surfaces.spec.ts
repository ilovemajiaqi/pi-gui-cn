import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  desktopShortcut,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";
import {
  emitCompletedEvent,
  emitRunningEvent,
  readOptionalLog,
} from "../helpers/notification-events";
import {
  createThread,
  selectSessionByTitle,
  setSessionVisibilityOverride,
} from "../helpers/session-event-test-helpers";

/**
 * The renderer re-renders itself when the language changes, but two native
 * surfaces are rebuilt by the main process instead: the application menu and
 * the OS notification. Both used to stay English in a Chinese window, and
 * neither was covered by the timeline or settings specs.
 */

const CHINESE_FINISHED = "智能体已完成回复";

async function switchLocale(window: Page, locale: string): Promise<void> {
  await window.keyboard.press(desktopShortcut(","));
  const surface = window.getByTestId("settings-surface");
  await expect(surface).toBeVisible();
  await surface.getByRole("button", { name: /^(Appearance|外观)$/ }).click();
  await window.getByRole("combobox", { name: /^(Language|语言)$/ }).selectOption(locale);
  await expect(window.locator("html")).toHaveAttribute("lang", locale);
  await window.getByRole("button", { name: /^(Back to app|返回应用)$/ }).click();
  await expect(surface).toBeHidden();
}

test("the native menu follows the window language instead of the process language", async () => {
  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("locale-menu");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const labels = () =>
      harness.electronApp.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        return menu ? menu.items.map((item) => item.label) : [];
      });

    // macOS is the only platform that gets an application menu. Everywhere else
    // the menu must stay absent: Electron's default English menu is what leaks
    // when nothing installs one.
    if (process.platform === "darwin") {
      await expect.poll(labels).toContain("File");
      await switchLocale(window, "zh-CN");
      await expect.poll(labels).toContain("文件");
      await expect.poll(labels).toContain("视图");
      await expect.poll(labels).not.toContain("File");
    } else {
      expect(await labels()).toEqual([]);
      await switchLocale(window, "zh-CN");
      expect(await labels()).toEqual([]);
    }
  } finally {
    await harness.close();
  }
});

test("an OS notification is written in the language the window is showing", async () => {
  test.setTimeout(90_000);
  const userDataDir = await makeUserDataDir();
  const notificationLogPath = join(userDataDir, "notifications-zh.jsonl");
  const workspacePath = await makeWorkspace("locale-notification");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    notificationLogPath,
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    const sessionA = await createThread(window, "Locale Session A");
    await createThread(window, "Locale Session B");
    await setSessionVisibilityOverride(harness, "active");
    await selectSessionByTitle(window, "Locale Session A");
    await selectSessionByTitle(window, "Locale Session B");

    await switchLocale(window, "zh-CN");

    const runId = await emitRunningEvent(harness, sessionA, "Locale");
    await emitCompletedEvent(harness, sessionA, "Locale", runId);

    // The body is the part that used to stay English: the title is user data,
    // the body is main-process copy.
    await expect
      .poll(() => readOptionalLog(notificationLogPath), { timeout: 30_000 })
      .toContain(CHINESE_FINISHED);
    await expect
      .poll(() => readOptionalLog(notificationLogPath), { timeout: 30_000 })
      .not.toContain("Agent finished responding");

    // Switching back reads the English table again, without a restart.
    await switchLocale(window, "en");
    const secondRun = await emitRunningEvent(harness, sessionA, "Locale back");
    await emitCompletedEvent(harness, sessionA, "Locale back", secondRun);
    await expect
      .poll(() => readOptionalLog(notificationLogPath), { timeout: 30_000 })
      .toContain("Agent finished responding");
  } finally {
    await harness.close();
  }
});
