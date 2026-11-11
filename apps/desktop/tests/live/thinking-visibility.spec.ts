import { expect, test } from "@playwright/test";
import {
  getDesktopState,
  getRealAuthConfig,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  selectSession,
} from "../helpers/electron-app";

const THINKING_PROMPT =
  "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. " +
  "Work through the arithmetic carefully, then reply with just the price of the ball.";

async function useEnglishUi(page: Parameters<typeof getDesktopState>[0]): Promise<void> {
  // Deterministic selector language regardless of the host OS language.
  await page.evaluate(() => window.localStorage.setItem("pi-gui:locale", "en"));
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
}

async function runThreadToIdle(window: Parameters<typeof getDesktopState>[0]): Promise<void> {
  await window
    .getByRole("complementary")
    .getByRole("button", { name: "New thread", exact: true })
    .click();
  await window.getByLabel("New thread prompt").fill(THINKING_PROMPT);
  await window.getByRole("button", { name: "Start thread" }).click();
  await expect
    .poll(async () => (await getDesktopState(window)).workspaces[0]?.sessions[0]?.status ?? "", {
      timeout: 150_000,
    })
    .toBe("idle");
}

test("assistant reasoning streams, collapses, expands and replays after a restart", async () => {
  test.setTimeout(420_000);
  const realAuth = getRealAuthConfig();
  test.skip(!realAuth.enabled, realAuth.skipReason);

  const userDataDir = await makeUserDataDir();
  const workspacePath = await makeWorkspace("thinking-visibility");
  const launchOptions = {
    initialWorkspaces: [workspacePath],
    testMode: "background" as const,
    realAuthSourceDir: realAuth.sourceDir,
  };

  const harness = await launchDesktop(userDataDir, launchOptions);
  let sessionTitle: string | undefined;
  try {
    const window = await harness.firstWindow();
    await useEnglishUi(window);
    await runThreadToIdle(window);

    const thinking = window
      .locator(".timeline-item--assistant [data-testid='timeline-thinking']")
      .last();
    await expect(thinking).toHaveCount(1);

    // Collapsed by default: the toggle announces its state and no body renders.
    const toggle = thinking.locator(".timeline-thinking__toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(thinking.locator(".timeline-thinking__body")).toHaveCount(0);
    await expect(thinking.locator(".timeline-thinking__label")).toBeVisible();

    // Expanding reveals the model's reasoning text; collapsing hides it again.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const body = thinking.locator(".timeline-thinking__body");
    await expect(body).toBeVisible();
    const reasoning = (await body.textContent()) ?? "";
    expect(reasoning.trim().length).toBeGreaterThan(0);
    await toggle.click();
    await expect(thinking.locator(".timeline-thinking__body")).toHaveCount(0);

    sessionTitle = (await getDesktopState(window)).workspaces[0]?.sessions[0]?.title;
    expect(sessionTitle).toBeTruthy();
  } finally {
    await harness.close();
  }

  // A second process on the same profile must replay the reasoning from the
  // persisted transcript, still collapsed by default and expandable.
  const relaunched = await launchDesktop(userDataDir, launchOptions);
  try {
    const window = await relaunched.firstWindow();
    await useEnglishUi(window);
    const alreadyVisible = (await window.locator(".chat-header__title").count()) > 0;
    if (alreadyVisible) {
      await expect(window.locator(".chat-header__title")).toHaveText(sessionTitle!);
    } else {
      await selectSession(window, sessionTitle!);
    }

    const thinking = window
      .locator(".timeline-item--assistant [data-testid='timeline-thinking']")
      .last();
    await expect(thinking).toHaveCount(1);
    const toggle = thinking.locator(".timeline-thinking__toggle");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    const body = thinking.locator(".timeline-thinking__body");
    await expect(body).toBeVisible();
    expect(((await body.textContent()) ?? "").trim().length).toBeGreaterThan(0);
  } finally {
    await relaunched.close();
  }
});
