import crossSpawn from "cross-spawn";

/**
 * Spawn a child process the way the dev launcher needs on every platform.
 *
 * `cross-spawn` resolves Windows `.cmd`/`.exe` shims (such as `pnpm`) so
 * commands launch without `spawn ENOENT`, and it forwards argv verbatim. Unlike
 * `spawn(cmd, args, { shell: true })` it does NOT route through a shell, so
 * arguments are never re-split/re-interpreted and Node's `DEP0190` deprecation
 * warning (spawn with `{ shell: true }` and an args array) is never emitted.
 *
 * @param {string} command
 * @param {readonly string[]} args
 * @param {import("node:child_process").SpawnOptions} [options]
 * @returns {import("node:child_process").ChildProcess}
 */
export function spawnProcess(command, args, options) {
  return crossSpawn(command, args, options);
}

/**
 * The environment an Electron process must launch with.
 *
 * `ELECTRON_RUN_AS_NODE=1` turns the Electron binary into a plain Node runtime
 * and ignores every Chromium switch, so a launcher that inherits it starts
 * `electron.exe --remote-debugging-port=0` as Node and dies with
 * `bad option: --remote-debugging-port=0`. Tools that embed Electron as a
 * runtime (Playwright, electron-vite, IDE task runners) export it, and it then
 * leaks into our own `electron` invocations. Drop it so the launcher always
 * starts the real application.
 *
 * @param {NodeJS.ProcessEnv} [base]
 * @returns {NodeJS.ProcessEnv}
 */
export function electronLaunchEnv(base = process.env) {
  const env = { ...base };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/**
 * Run a command to completion, rejecting on a non-zero exit.
 *
 * @param {string} command
 * @param {readonly string[]} args
 * @param {string} cwd
 * @returns {Promise<void>}
 */
export function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with ${signal ?? code}`));
    });
  });
}

/**
 * Start a long-lived command, returning the child process.
 *
 * @param {string} command
 * @param {readonly string[]} args
 * @param {string} cwd
 * @returns {import("node:child_process").ChildProcess}
 */
export function start(command, args, cwd, env = process.env) {
  return spawnProcess(command, args, {
    cwd,
    stdio: "inherit",
    env,
  });
}
