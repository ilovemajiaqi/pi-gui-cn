import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { readFile, stat } from "node:fs/promises";
import {
  createNamedThread,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  seedAgentDir,
  stubNextSaveDialogPath,
} from "../helpers/electron-app";

test("recalls sent prompts with ArrowUp and returns to the empty draft with ArrowDown", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("recall-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Recall session");
    const composer = window.getByTestId("composer");

    // Two submitted commands build the session's prompt history without a provider:
    // a runtime command, then a host rename whose completion shows in the header.
    await composer.fill("/status");
    await composer.press("Enter");
    await expect(window.getByTestId("transcript")).toContainText(/Model |No session overrides set/);
    await composer.fill("/name Renamed thread");
    await composer.press("Enter");
    await expect(window.locator(".chat-header__title")).toHaveText("Renamed thread");
    await expect(composer).toHaveValue("");

    await composer.press("ArrowUp");
    await expect(composer).toHaveValue("/name Renamed thread");
    await composer.press("ArrowUp");
    await expect(composer).toHaveValue("/status");
    // Recalling the oldest entry again leaves it in place.
    await composer.press("ArrowUp");
    await expect(composer).toHaveValue("/status");

    await composer.press("ArrowDown");
    await expect(composer).toHaveValue("/name Renamed thread");
    await composer.press("ArrowDown");
    await expect(composer).toHaveValue("");
    // With recall exhausted, ArrowDown does nothing further.
    await composer.press("ArrowDown");
    await expect(composer).toHaveValue("");
  } finally {
    await harness.close();
  }
});

test("edited recall detaches, and a typed draft keeps its caret movement", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("recall-edit-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Recall edit session");
    const composer = window.getByTestId("composer");

    await composer.fill("/status");
    await composer.press("Enter");
    await expect(window.getByTestId("transcript")).toContainText(/Model |No session overrides set/);

    // A recalled entry that the user edits detaches from history navigation: ArrowUp no
    // longer moves while the edited draft is in the composer, because it is not empty.
    await composer.press("ArrowUp");
    await expect(composer).toHaveValue("/status");
    await composer.press("End");
    await composer.type(" --edited");
    await expect(composer).toHaveValue("/status --edited");
    await composer.press("ArrowUp");
    await expect(composer).toHaveValue("/status --edited");
  } finally {
    await harness.close();
  }
});

test("two Escapes on an empty composer open the session tree", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("recall-tree-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Recall tree session");
    const composer = window.getByTestId("composer");

    // A single Escape does not open anything.
    await composer.press("Escape");
    await expect(window.getByTestId("tree-modal")).toHaveCount(0);

    await composer.press("Escape");
    const treeModal = window.getByTestId("tree-modal");
    await expect(treeModal).toBeVisible();
    await expect(window.getByTestId("tree-modal-search")).toBeFocused();

    // Closing the tree and recalling the shortcut opens it again. The close's Escape also
    // counts as the first press of a new pair, so wait out the 600 ms window first.
    await composer.press("Escape");
    await expect(treeModal).toHaveCount(0);
    await composer.evaluate((element) => element.focus());
    await window.waitForTimeout(700);
    await composer.press("Escape");
    await expect(treeModal).toHaveCount(0);
    await composer.press("Escape");
    await expect(window.getByTestId("tree-modal")).toBeVisible();
  } finally {
    await harness.close();
  }
});

test("/export saves the transcript as Markdown through the save dialog", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const agentDir = join(userDataDir, "agent");
  const workspacePath = await makeWorkspace("export-workspace");
  await seedAgentDir(agentDir);
  const harness = await launchDesktop(userDataDir, {
    agentDir,
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Export session");
    const composer = window.getByTestId("composer");
    await composer.fill("/status");
    await composer.press("Enter");
    await expect(window.getByTestId("transcript")).toContainText(/Model |No session overrides set/);

    const savePath = join(userDataDir, "exported-thread.md");
    await stubNextSaveDialogPath(harness, savePath);

    const slashMenu = window.getByTestId("slash-menu");
    await composer.fill("/expor");
    await expect(slashMenu).toContainText("Export");
    await composer.press("Enter");
    await expect(composer).toHaveValue("");

    await expect
      .poll(async () => {
        try {
          return (await stat(savePath)).size;
        } catch {
          return -1;
        }
      })
      .toBeGreaterThan(0);

    const markdown = await readFile(savePath, "utf8");
    expect(markdown).toContain("# Export session");
    expect(markdown).toContain("_Exported ");
    // The /status row's session details are part of the saved transcript.
    expect(markdown).toContain("Model openai:gpt-5");

    // A canceled save writes nothing and leaves the app idle.
    const canceledPath = join(userDataDir, "canceled-thread.md");
    await stubNextSaveDialogPath(harness, null);
    await composer.fill("/export");
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
    await expect(stat(canceledPath)).rejects.toThrow();
  } finally {
    await harness.close();
  }
});
