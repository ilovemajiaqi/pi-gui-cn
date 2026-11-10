# Releasing pi-gui-zh

This fork publishes its own Windows builds from
[ilovemajiaqi/pi-gui-cn](https://github.com/ilovemajiaqi/pi-gui-cn/releases). The
upstream release automation is kept in the tree for reference, but it is disabled
in this repository because it depends on upstream signing and Homebrew secrets.

## Versioning

- Keep `apps/desktop/package.json` in sync with the upstream desktop version.
- Tag releases as `vX.Y.Z`.
- Add the user-visible changes to [`CHANGELOG.md`](../CHANGELOG.md).

## Windows release (current process)

1. Install from the lockfile:

   ```sh
   corepack enable
   pnpm install --frozen-lockfile
   ```

2. Build the app and installers:

   ```sh
   pnpm package:win
   ```

   Products land in `apps/desktop/release/`:
   - `pi-gui-<version>-x64-setup.exe` (NSIS)
   - `pi-gui-<version>-x64-portable.exe`
   - `latest.yml` and the setup blockmap

   Windows notes:
   - Build from an ASCII-only path. electron-builder's module collector calls
     `cmd` with the project path and fails when it contains non-ASCII characters.
     `git archive` to a short path such as `C:\pi-gui-build-src` works.
   - If `winCodeSign` extraction fails on symlink permissions, add
     `-c.toolsets.winCodeSign=1.1.0`; if the runner cannot create symlinks at all,
     an unsigned build can skip exe editing with
     `-c.win.signAndEditExecutable=false`.

3. Smoke-test the packaged app by launching
   `apps/desktop/release/win-unpacked/pi-gui.exe` and confirming the Chinese UI
   renders. Check `resources/app-update.yml` points at `ilovemajiaqi/pi-gui-cn`.

4. Publish the release and assets:

   ```sh
   sha256sum pi-gui-*-x64-setup.exe pi-gui-*-x64-portable.exe \
     pi-gui-*-x64-setup.exe.blockmap latest.yml > SHA256SUMS.txt
   gh release create vX.Y.Z --repo ilovemajiaqi/pi-gui-cn \
     --title "pi-gui-zh vX.Y.Z" --notes-file notes.md --target main \
     pi-gui-*-x64-setup.exe pi-gui-*-x64-portable.exe \
     pi-gui-*-x64-setup.exe.blockmap latest.yml SHA256SUMS.txt
   ```

5. Do not push the upstream tags that may be present in a local clone; they point
   at upstream commits. Only the fork's release tags belong in this repository.

## Automated release workflow

`.github/workflows/release.yml` is the upstream pipeline. It validates a tag,
builds and notarizes macOS, packages Linux and Windows, publishes a validated
draft, and syncs `minghinmatthewlam/homebrew-tap`. Those jobs need macOS signing
secrets (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`,
`APPLE_API_ISSUER`) and `HOMEBREW_TAP_TOKEN`. The Homebrew target is upstream's
tap, so update or remove that job before enabling the workflow in this fork.

The workflow is disabled in GitHub Actions for now. Use the manual Windows
process above, or reconfigure the secrets and Homebrew step first.

## Update channel

Two files define where the app looks for updates:

- `apps/desktop/electron/platform/update-checker.ts` — the GitHub API and release
  page used by the in-app update check;
- `apps/desktop/electron-builder.yml` — `publish.owner` / `publish.repo`, which
  feed `resources/app-update.yml`.

Both must point at `ilovemajiaqi/pi-gui-cn`. Pointing them at upstream would offer
the English build as an update and overwrite the Chinese localization.
