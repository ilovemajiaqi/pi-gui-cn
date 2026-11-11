import { expect, test } from "@playwright/test";
import {
  createNamedThread,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  sweepArchivedSessions,
} from "../helpers/electron-app";

/** Archives a thread through the row action, which is the only user-facing archive path. */
async function archiveThread(
  window: Awaited<ReturnType<Awaited<ReturnType<typeof launchDesktop>>["firstWindow"]>>,
  title: string,
) {
  const row = window.locator(".session-list > .session-row").filter({ hasText: title }).first();
  await row.hover();
  await row.getByLabel(`Archive ${title}`).click();
  await expect
    .poll(async () => {
      const state = await getDesktopState(window);
      return (
        state.workspaces[0]?.sessions.find((session) => session.title === title)?.archivedAt ?? ""
      );
    })
    .not.toBe("");
}

test("archived threads have a management page that restores and deletes", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir("pi-app-user-data-");
  const workspacePath = await makeWorkspace("archive-manager-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Archive one");
    await createNamedThread(window, "Archive two");
    await archiveThread(window, "Archive one");
    await archiveThread(window, "Archive two");
    await expect(window.locator(".archived-thread-group")).toBeVisible();

    // The sidebar links to the archive page instead of offering deletion inline.
    await window.getByTestId("archived-manage").click();
    await expect(window.getByTestId("settings-surface")).toBeVisible();
    await expect(window.locator(".view-header__title")).toHaveText("Archived threads");

    const list = window.getByTestId("archive-list");
    await expect(list.locator(".archive-row")).toHaveCount(2);
    await expect(list).toContainText("Archive one");
    await expect(list).toContainText("Archive two");

    // Restoring one leaves the other archived.
    const firstRow = list.locator(".archive-row").filter({ hasText: "Archive one" });
    await firstRow.getByLabel("Restore Archive one").click();
    await expect(list.locator(".archive-row")).toHaveCount(1);
    await expect
      .poll(async () => {
        const state = await getDesktopState(window);
        return (
          state.workspaces[0]?.sessions.find((session) => session.title === "Archive one")
            ?.archivedAt ?? ""
        );
      })
      .toBe("");

    // Deleting the last one empties the page, which is the only way to purge a thread.
    await list
      .locator(".archive-row")
      .filter({ hasText: "Archive two" })
      .getByLabel("Delete Archive two permanently")
      .click();
    const dialog = window.getByTestId("archive-delete-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("archive-delete-dialog-confirm").click();
    await expect(dialog).toHaveCount(0);
    await expect(list.locator(".archive-row")).toHaveCount(0);
    await expect(window.getByTestId("settings-surface")).toContainText("Nothing archived");

    await expect
      .poll(async () => {
        const state = await getDesktopState(window);
        return state.workspaces[0]?.sessions.map((session) => session.title) ?? [];
      })
      .toEqual(["Archive one"]);
  } finally {
    await harness.close();
  }
});

test("the archive retention setting purges expired threads and keeps fresh ones", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir("pi-app-user-data-");
  const workspacePath = await makeWorkspace("archive-retention-workspace");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspacePath],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await createNamedThread(window, "Old archive");
    await createNamedThread(window, "Fresh archive");
    await archiveThread(window, "Old archive");
    await archiveThread(window, "Fresh archive");

    await window.getByTestId("archived-manage").click();
    await expect(window.getByTestId("archive-list").locator(".archive-row")).toHaveCount(2);

    // Keeping archived threads forever is the default, so the sweep removes nothing.
    const retention = window.getByLabel("Archived thread retention");
    await expect(retention).toHaveAttribute("data-value", "0");
    await expect(retention).toContainText("Never");
    await sweepArchivedSessions(harness);
    await expect(window.getByTestId("archive-list").locator(".archive-row")).toHaveCount(2);

    // A 30-day window ages both threads past it when the sweep runs a year later.
    await retention.click();
    await window.getByRole("option", { name: "30 days" }).click();
    await expect.poll(async () => (await getDesktopState(window)).archiveRetentionDays).toBe(30);
    await expect(window.getByTestId("archive-list").locator(".archive-row")).toHaveCount(2);

    await sweepArchivedSessions(harness, "2027-01-01T00:00:00.000Z");
    await expect(window.getByTestId("archive-list").locator(".archive-row")).toHaveCount(0);
    await expect
      .poll(async () => {
        const state = await getDesktopState(window);
        return state.workspaces[0]?.sessions.map((session) => session.title) ?? [];
      })
      .toEqual([]);
  } finally {
    await harness.close();
  }
});
