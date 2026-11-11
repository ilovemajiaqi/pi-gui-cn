import { expect, test } from "@playwright/test";
import { shouldAdoptComposerSnapshot } from "../../src/features/conversation/hooks/use-composer-draft-sync";

test("adopts every snapshot when no local edit is pending", () => {
  expect(shouldAdoptComposerSnapshot("persist", false)).toBe(true);
  expect(shouldAdoptComposerSnapshot("state", false)).toBe(true);
  expect(shouldAdoptComposerSnapshot("command", false)).toBe(true);
  expect(shouldAdoptComposerSnapshot("extension-editor-text", false)).toBe(true);
  expect(shouldAdoptComposerSnapshot("queued-message-edit", false)).toBe(true);
  expect(shouldAdoptComposerSnapshot("selection", false)).toBe(true);
});

test("keeps a newer local edit over persist, state, command and selection restores", () => {
  expect(shouldAdoptComposerSnapshot("persist", true)).toBe(false);
  expect(shouldAdoptComposerSnapshot("state", true)).toBe(false);
  expect(shouldAdoptComposerSnapshot("command", true)).toBe(false);
  // Re-selecting the already-selected session re-sends its last persisted draft, which may
  // predate the edit being typed; a real switch is hydrated by the session-key branch.
  expect(shouldAdoptComposerSnapshot("selection", true)).toBe(false);
});

test("still applies explicit replacements while a local edit is pending", () => {
  expect(shouldAdoptComposerSnapshot("extension-editor-text", true)).toBe(true);
  expect(shouldAdoptComposerSnapshot("queued-message-edit", true)).toBe(true);
});
