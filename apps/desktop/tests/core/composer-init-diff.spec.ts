import { expect, test } from "@playwright/test";
import { join } from "node:path";
import {
  createNamedThread,
  desktopShortcut,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
} from "../helpers/electron-app";

test("runs /init and /diff from the composer and hides both on the new-thread surface", async () => {
  test.setTimeout(90_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("init-diff-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Init diff session");
    const composer = window.getByTestId("composer");
    const slashMenu = window.getByTestId("slash-menu");

    // /init sends the AGENTS.md scaffold prompt into the thread as a user message.
    await composer.fill("/ini");
    await expect(slashMenu).toContainText("Init");
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
    await expect(window.getByTestId("transcript")).toContainText("Create or update AGENTS.md");

    // The provider is not reachable in this lane; wait for the init turn to settle so the
    // composer's menus are live again.
    await expect
      .poll(
        async () => {
          const state = await getDesktopState(window);
          const workspace = state.workspaces.find(
            (entry) => entry.id === state.selectedWorkspaceId,
          );
          return workspace?.sessions.find((entry) => entry.id === state.selectedSessionId)?.status;
        },
        { timeout: 30_000 },
      )
      .not.toBe("running");

    // /diff opens the workbench review panel instead of sending anything to the runtime.
    await composer.fill("/dif");
    await expect(slashMenu).toContainText("Diff");
    await composer.press("Enter");
    await expect(window.getByTestId("workbench")).toBeVisible();
    await expect(window.getByTestId("workbench-tab-changes")).toBeVisible();
    await expect(composer).toHaveValue("");

    // The new-thread surface has no transcript or checkout, so both commands are hidden.
    await window.keyboard.press(desktopShortcut("N"));
    const newThreadComposer = window.getByTestId("new-thread-composer");
    await expect(newThreadComposer).toBeVisible();
    await newThreadComposer.fill("/ini");
    await expect(
      window.getByTestId("slash-menu").locator(".slash-menu__item", { hasText: "Init" }),
    ).toHaveCount(0);
    await newThreadComposer.fill("/dif");
    await expect(
      window.getByTestId("slash-menu").locator(".slash-menu__item", { hasText: "Diff" }),
    ).toHaveCount(0);
  } finally {
    await harness.close();
  }
});

test("/copy copies the thread Markdown to the clipboard", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("copy-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Copy session");
    const composer = window.getByTestId("composer");

    await composer.fill("/status");
    await composer.press("Enter");
    await expect(window.getByTestId("transcript")).toContainText(/Model |No session overrides set/);

    await composer.fill("/cop");
    await expect(window.getByTestId("slash-menu")).toContainText("Copy thread");
    await composer.press("Enter");
    await expect(composer).toHaveValue("");

    // The app-side copy path answers with whether it found a thread to copy. The OS
    // clipboard write itself is a native surface (tests/native), and a sandboxed host
    // may deny spawned clipboard writes without failing the request.
    const copied = await window.evaluate(async () => {
      const api = (globalThis as { piApp?: { copyTranscript: () => Promise<boolean> } }).piApp;
      return api ? api.copyTranscript() : false;
    });
    expect(copied).toBe(true);
  } finally {
    await harness.close();
  }
});
