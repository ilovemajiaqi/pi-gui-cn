import { expect, test } from "@playwright/test";
import { AGENTS_MD_INIT_PROMPT } from "../../contracts/agent-instructions";
import {
  parseCopyComposerCommand,
  parseDiffComposerCommand,
  parseInitComposerCommand,
} from "../../src/features/conversation/composer-commands";

test("the init prompt asks for a concise AGENTS.md and covers the shared sections", () => {
  expect(AGENTS_MD_INIT_PROMPT).toContain("AGENTS.md");
  for (const section of [
    "Overview:",
    "Setup:",
    "Build, test and lint:",
    "Code style:",
    "Workflows:",
  ]) {
    expect(AGENTS_MD_INIT_PROMPT).toContain(section);
  }
  // The prompt must tell the agent to refine an existing file rather than replace it.
  expect(AGENTS_MD_INIT_PROMPT).toContain("If AGENTS.md already exists, refine it");
});

test("/init, /diff and /copy parse only in their exact forms", () => {
  expect(parseInitComposerCommand("/init")).toEqual({ type: "init" });
  expect(parseInitComposerCommand("  /init  ")).toEqual({ type: "init" });
  expect(parseInitComposerCommand("/init now")).toMatchObject({ type: "error" });
  expect(parseInitComposerCommand("/initiate")).toBeUndefined();
  expect(parseInitComposerCommand("hello")).toBeUndefined();

  expect(parseDiffComposerCommand("/diff")).toEqual({ type: "diff" });
  expect(parseDiffComposerCommand(" /diff ")).toEqual({ type: "diff" });
  expect(parseDiffComposerCommand("/diff --stat")).toMatchObject({ type: "error" });
  expect(parseDiffComposerCommand("/diffused")).toBeUndefined();
  expect(parseDiffComposerCommand("diff")).toBeUndefined();

  expect(parseCopyComposerCommand("/copy")).toEqual({ type: "copy" });
  expect(parseCopyComposerCommand(" /copy ")).toEqual({ type: "copy" });
  expect(parseCopyComposerCommand("/copy now")).toMatchObject({ type: "error" });
  expect(parseCopyComposerCommand("/copycat")).toBeUndefined();
  expect(parseCopyComposerCommand("copy")).toBeUndefined();
});
