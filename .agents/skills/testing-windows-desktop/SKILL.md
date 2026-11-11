---
name: testing-windows-desktop
description: End-to-end test the pi-gui Electron desktop app on Windows. Use when verifying Windows compatibility (dev launcher, PATH, folder picker, integrated terminal / node-pty) or any apps/desktop change on Windows.
---

# Testing the pi-gui desktop app on Windows

## Setup

- Ensure pnpm is available: `corepack enable` then `corepack prepare pnpm@<version from package.json> --activate`.
- Install: `pnpm install` (repo root).
- Launch the app for GUI testing: `pnpm --filter @pi-gui/desktop dev`. Optionally set `PI_APP_USER_DATA_DIR` to an isolated temp dir.
- A working launch prints `starting electron app...` and the renderer dev server (`http://localhost:5173`) and must NOT print `spawn pnpm ENOENT`.

## Low integrity label breaks every child tool — check this first

A Windows process can only write to objects whose integrity level is not higher than its own. When the
checkout tree carries a `Low Mandatory Level` label, every tool that runs from inside it (`esbuild.exe`,
`electron.exe`, bundled `node.exe`) inherits Low and is silently denied writes anywhere below Medium,
including `%TEMP%`. The symptoms look like unrelated broken tooling, so identify the label before
debugging any of them:

| Symptom                                                                | Real cause                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `Failed to write to output file … Access is denied.` from esbuild/vite | esbuild.exe is Low, the output dir is Medium            |
| `[vite:esbuild-transpile] remove …esbuild-<hash>: Access is denied.`   | same — the temp file it just wrote is Medium            |
| `electron.exe: bad option: --remote-debugging-port=0`                  | low integrity also breaks the Chromium sandbox helper   |
| Chromium exits `2147483651` (0x80000003) before a window appears       | the sandbox cannot initialise under the restricted tree |
| `Lock file can not be created! Error code: 5`                          | the profile dir inherits the label                      |

Diagnose:

```powershell
icacls . | Select-String 'Mandatory Label'
foreach ($p in @('apps','node_modules','node_modules\@esbuild\win32-x64\esbuild.exe')) {
  "$p => $((icacls $p | Select-String 'Mandatory Label').Line.Trim())"
}
```

`Mandatory Label\Low Mandatory Level:(OI)(CI)(NW)` on the root means the whole tree is Low. Confirm the
mechanism by copying `esbuild.exe` outside the checkout (the copy loses the label) and running it against
`%TEMP%`: if the copy succeeds, the label — not the ACL on the output dir — is the cause.

Repair, from the repo root (propagation is immediate, no `-Recurse` needed):

```powershell
icacls . /setintegritylevel "(OI)(CI)Medium"
```

Then verify with `icacls node_modules\@esbuild\win32-x64\esbuild.exe` (expect `Medium:(I)(NW)`) and run a
build. Reverting is the same command with `"(OI)(CI)Low"`.

The repair is idempotent and safe to repeat. Re-check it whenever builds that used to work suddenly fail
with the symptoms above: the label can come back after the surrounding tooling restarts, and a tree that
was already repaired once will silently revert. Re-running the command on an already-Medium tree is a
no-op. The current state is one command:

```powershell
(icacls . | Select-String 'Mandatory Label').Line.Trim()
```

Do NOT chase this with per-tool workarounds — a repo-local `TEMP`, `subst`, copied binaries, or
`esbuild`'s `write: false` all mask it while leaving the label in place. Those workarounds also put build
scratch inside the checkout, where `format:check`, `lint` and the typed-lint guards then trip over it.

## `ELECTRON_RUN_AS_NODE` from the surrounding tooling

Tools that embed Electron as a runtime (Playwright's Electron support, `electron-vite`, some IDE task
runners) export `ELECTRON_RUN_AS_NODE=1` into their children. An inherited value turns `electron.exe`
into plain Node, so a launch with `--remote-debugging-port=0` dies with
`bad option: --remote-debugging-port=0` and exit code 9. `pnpm exec electron --version` printing the
Node version (e.g. `v22.21.1`) instead of the Electron version confirms it.

`apps/desktop/scripts/launcher.mjs` exports `electronLaunchEnv()`, which strips the variable, and the
dev launcher and `apps/desktop/tests/helpers/electron-app.ts` both launch through it. If a new entry
point spawns Electron, route it through the same helper instead of clearing the variable by hand.

## What renders where

- Empty state: sidebar (New thread / Threads / Skills / Extensions / Settings) + "Open a folder to start".
- Navigation (Settings / Skills / Threads) is a good cheap proof the renderer is interactive.

## Integrated terminal (node-pty / ConPTY) — IMPORTANT gotcha

- The Terminal item in the Open side panel menu is disabled until there is an **active session**: `terminalAvailable={Boolean(selectedSessionKey)}` in `apps/desktop/src/app/App.tsx`.
- Creating a session through the live UI requires a **connected provider/model**. Without provider credentials you CANNOT reach the terminal via the GUI ("No models available" blocks send).
- Workaround that needs no credentials: run a **headless Playwright spec in background test mode**. Use helpers from `apps/desktop/tests/helpers/electron-app.ts`: `launchDesktop(userDataDir, { initialWorkspaces, testMode: "background" })` -> `createNamedThread(window, ...)` -> open Terminal from the Open side panel menu (or press Ctrl+J) -> type a command -> assert `.xterm-rows` text.
- Use a **cross-platform command**: `echo <marker>` works in both `cmd.exe` (Windows default shell via `defaultShellForPlatform()`) and POSIX shells. The existing `tests/core/integrated-terminal.spec.ts` uses `printf`/`pwd`, which do NOT exist in `cmd.exe` — that lane runs on Linux and macOS CI only, so don't expect it to pass as-is on Windows.
- Run a single spec: `pnpm --filter @pi-gui/desktop run test:e2e:runner -- apps/desktop/tests/core/<spec>.spec.ts`. Delete any temporary spec you add after the run.

## Native Windows folder picker

- "Open first folder" opens the real Windows folder dialog (itself a Windows-compat proof).
- Computer-use `type` action may DROP uppercase letters and `:` in the dialog's path field (e.g. `C:\Users\Administrator` becomes `\sers\dministrator`). Workaround: put the path on the clipboard (`Set-Clipboard -Value "<path>"`) and `Ctrl+V` into the Folder field, then Select Folder.

## Cosmetic (not functional) macOS-centric labels on Windows

- Settings shortcut hints may show `Cmd+…` on macOS-focused copy. The terminal shell placeholder is platform-aware (cmd.exe on Windows) since the Codex-style select rework.

## Reporting

- Record GUI interactions with annotations (setup / test_start / assertion). Do not record shell-only runs.
- Mark the live-UI terminal test `untested` (not failed) when blocked by missing provider credentials, and note the headless spec result separately.

## Devin Secrets Needed

- None required for launch / navigation / folder picker / headless terminal test.
- A provider API key (e.g. an LLM provider configured under Settings > Providers) is required only to create a session through the **live UI** and thus exercise the terminal through the GUI.
