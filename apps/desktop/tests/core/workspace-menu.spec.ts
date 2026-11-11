import { basename } from "node:path";
import { expect, test } from "@playwright/test";
import {
  assertExists,
  getDesktopState,
  launchDesktop,
  makeUserDataDir,
  makeWorkspace,
  waitForWorkspaceByPath,
} from "../helpers/electron-app";

test("supports workspace rename and remove from the sidebar menu", async () => {
  test.setTimeout(60_000);
  const userDataDir = await makeUserDataDir();
  const workspaceA = await makeWorkspace("workspace-menu-a");
  const workspaceB = await makeWorkspace("workspace-menu-b");
  const harness = await launchDesktop(userDataDir, {
    initialWorkspaces: [workspaceA, workspaceB],
    testMode: "background",
  });

  try {
    const window = await harness.firstWindow();
    await waitForWorkspaceByPath(window, workspaceA);
    await waitForWorkspaceByPath(window, workspaceB);

    const state = await getDesktopState(window);
    const workspace = state.workspaces.find((entry) => entry.path === workspaceA);
    assertExists(workspace, "Expected first workspace");

    await window
      .getByRole("button", { name: `Workspace actions for ${basename(workspaceA)}` })
      .click();
    const workspaceMenu = window.locator(".workspace-menu").last();
    await expect(workspaceMenu.getByRole("button", { name: "Open folder" })).toBeVisible();
    await expect(workspaceMenu.getByRole("button", { name: "Edit name" })).toBeVisible();
    await expect(workspaceMenu.getByRole("button", { name: "Remove" })).toBeVisible();

    await workspaceMenu.getByRole("button", { name: "Edit name" }).click();
    const renameInput = window.getByLabel(`Rename ${basename(workspaceA)}`);
    await renameInput.fill("Renamed workspace");
    await window.getByRole("button", { name: "Save" }).click();

    await expect
      .poll(async () => {
        const latest = await getDesktopState(window);
        return latest.workspaces.find((entry) => entry.id === workspace.id)?.name;
      })
      .toBe("Renamed workspace");

    // Removing a workspace asks in an in-app dialog, so the confirmation is addressable copy.
    await window.getByRole("button", { name: "Workspace actions for Renamed workspace" }).click();
    await window.getByRole("button", { name: "Remove" }).click();
    const removeDialog = window.getByTestId("workspace-remove-dialog");
    await expect(removeDialog).toBeVisible();
    await removeDialog.getByTestId("workspace-remove-dialog-confirm").click();
    await expect(removeDialog).toHaveCount(0);

    await expect
      .poll(async () => {
        const latest = await getDesktopState(window);
        return latest.workspaces.some((entry) => entry.id === workspace.id);
      })
      .toBe(false);
  } finally {
    await harness.close();
  }
});
