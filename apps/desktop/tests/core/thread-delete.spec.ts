import { stat } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
} from "../helpers/electron-app";
import { sessionFilePathFromCatalog } from "../helpers/session-file";

test("deletes a thread from the row action only after confirmation", async () => {
  const userDataDir = await makeUserDataDir("pi-app-user-data-");
  const workspacePath = await makeWorkspace("thread-delete-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Keep me");
    await createNamedThread(window, "Delete me");
    await expect(window.locator(".chat-header__title")).toHaveText("Delete me");

    // Resolve the transcript path up front so the assertions prove the file is gone
    // rather than only that the row disappeared.
    let target: { workspaceId: string; sessionId: string } | undefined;
    await expect
      .poll(async () => {
        const state = await getDesktopState(window);
        const workspace = state.workspaces[0];
        const session = workspace?.sessions.find((entry) => entry.title === "Delete me");
        target =
          workspace && session ? { workspaceId: workspace.id, sessionId: session.id } : undefined;
        return Boolean(target);
      })
      .toBe(true);
    const sessionFilePath = await sessionFilePathFromCatalog(userDataDir, target!);

    const row = window
      .locator(".session-list > .session-row")
      .filter({ hasText: "Delete me" })
      .first();
    await row.hover();

    // Cancelling leaves both the thread and its file alone.
    await row.getByTestId("session-row-delete").click();
    const dialog = window.getByTestId("thread-delete-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Delete me");
    await dialog.getByTestId("thread-delete-dialog-cancel").click();
    await expect(dialog).toHaveCount(0);
    await expect(window.locator(".session-list > .session-row")).toHaveCount(2);
    expect((await stat(sessionFilePath)).isFile()).toBe(true);

    // Confirming deletes it and moves the selection to the remaining thread.
    await row.hover();
    await row.getByTestId("session-row-delete").click();
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("thread-delete-dialog-confirm").click();
    await expect(dialog).toHaveCount(0);
    await expect(window.locator(".session-list > .session-row")).toHaveCount(1);
    await expect(window.locator(".chat-header__title")).toHaveText("Keep me");

    await expect
      .poll(async () => {
        const state = await getDesktopState(window);
        return state.workspaces[0]?.sessions.map((session) => session.title) ?? [];
      })
      .toEqual(["Keep me"]);

    // The transcript file is gone too, so a reload cannot bring the thread back.
    await expect.poll(async () => stat(sessionFilePath).catch(() => null)).toBeNull();
  } finally {
    await harness.close();
  }
});

test("keeps the transcript when deleting is cancelled from the thread menu", async () => {
  const userDataDir = await makeUserDataDir("pi-app-user-data-");
  const workspacePath = await makeWorkspace("thread-delete-menu-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Menu thread");

    const row = window.locator(".session-list > .session-row").filter({ hasText: "Menu thread" });
    await row.click({ button: "right" });
    const deleteItem = window.locator("[data-thread-action='delete-thread']");
    await expect(deleteItem).toBeVisible();
    await expect(deleteItem).toHaveClass(/workspace-menu__item--danger/);
    await deleteItem.click();

    const dialog = window.getByTestId("thread-delete-dialog");
    await expect(dialog).toBeVisible();
    // Focus lands on the safe button, and Escape aborts without deleting.
    await expect(dialog.getByTestId("thread-delete-dialog-cancel")).toBeFocused();
    await window.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toHaveCount(1);
  } finally {
    await harness.close();
  }
});
