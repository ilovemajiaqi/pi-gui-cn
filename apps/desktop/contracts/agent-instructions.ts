/**
 * The prompt `/init` submits. pi reads `AGENTS.md` (and `AGENTS.override.md`) with the
 * same discovery precedence Codex documents: the user-level folder first, then the
 * project root down to the working directory. So the file this prompt scaffolds is
 * consumed by both agents unchanged, and the command never touches the runtime itself.
 */
export const AGENTS_MD_INIT_PROMPT = `Create or update AGENTS.md at the workspace root.

Survey the repository first: build, test and lint commands, the package manager, code style, architecture and contributor workflows. Then write the file with short, concrete sections:

- Overview: what the project is and the main technologies
- Setup: how to install dependencies
- Build, test and lint: the exact commands to run, including how to run a single test
- Code style: only rules a new contributor could not infer from the code
- Workflows: branching, review and release steps the repository actually uses

If AGENTS.md already exists, refine it: keep guidance that is still true, remove stale or obvious lines, and add what is missing. Prefer concrete commands and paths over general advice, and keep the file short enough to stay useful in an agent's context.

When you are done, summarize the changes.`;
