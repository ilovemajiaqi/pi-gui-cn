# Contributing to pi-gui-zh

Thanks for your interest in improving pi-gui-zh. This guide covers local setup,
the test lanes, and what "done" means for a change. Contributions and reviews are
welcome in English or Chinese.

By participating, you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md).
For security issues, use the private process in [SECURITY.md](./SECURITY.md) rather
than a public issue.

## Prerequisites

- Node 20+
- [pnpm](https://pnpm.io), managed through `corepack`; `pnpm-lock.yaml` is the
  authoritative lockfile

```bash
corepack enable
pnpm install
```

## Development loop

```bash
pnpm dev         # run the desktop app (electron-vite, hot reload)
pnpm typecheck   # type-check all workspaces
pnpm lint        # lint all workspaces
pnpm build       # build all workspaces
```

`pnpm dev` rebuilds the shared workspace packages up front and keeps them in watch
mode, so Node-side package changes are picked up without a manual rebuild.

## Testing

Desktop end-to-end tests run against a real Electron build using a Playwright +
Electron harness, split into lanes:

- `core` — the default lane, runs on `pnpm test`.
- `live` — exercises live agent runs; needs working `pi` provider auth locally.
- `native` — foreground/OS-integration behaviors (open folder, paste, attachments).

```bash
pnpm test                                        # each workspace's tests (desktop: core lane)
pnpm --filter @pi-gui/desktop run test:e2e:all   # core + live + native
```

macOS is the source of truth for desktop UI verification. Linux is supported for
packaging and manual validation. See [`apps/desktop/README.md`](./apps/desktop/README.md)
for the full lane list and platform-specific packaging notes.

## Expectations for a change

- **Verify on the real surface.** Desktop changes should be confirmed on the actual
  Electron app, not only via unit tests. Transcript/timeline behavior, session
  correctness, and Codex-style UX are treated as product features.
- **Keep the renderer/main/preload boundary tight.** Don't widen the renderer's Node
  access; route through the typed IPC surface.
- **Keep `pi-sdk-driver` thin.** Prefer adapting upstream `pi` behavior over forking
  or reimplementing it.
- **Make focused commits.** One logical change per commit so the diff is easy to
  review.

Repo-wide conventions live in [`AGENTS.md`](./AGENTS.md) (the root `CLAUDE.md` is a
symlink to it). Path-scoped guidance lives in nested `AGENTS.md` files.

## Translating the UI

English is the key source and the fallback locale; Simplified Chinese lives in
`apps/desktop/src/i18n/messages/zh-CN.ts`.

- Add or update the English copy in `messages/en.ts` first.
- Translate the new keys in `messages/zh-CN.ts` (`Partial<Messages>`, so partial
  translations are valid and fall back to English).
- Run `pnpm i18n:check zh-CN` to list missing entries and untranslated strings. It is
  a report and always exits 0; `pnpm i18n:check:strict` is the gate that `pnpm check`
  runs, and it fails on a missing key or on a value that still reads English unless
  `apps/desktop/src/i18n/allowlist.json` excuses that key with a reason.
- Keep product terms consistent with the glossary in the README and existing
  translations (会话 / 工作树 / 审查 / 上下文窗口 / 思考深度). Keep Git and
  technical proper nouns in their conventional form.
- Write Chinese copy with full-width punctuation (`，。：；！？（）`、`“”`、`…`) and
  keep half-width punctuation inside code, paths, URLs, shortcuts and versions.
- `renderer-copy.spec.ts` walks every `.tsx` under each translated surface, nested
  directories included, and fails on hardcoded English in JSX text or in a
  copy-bearing attribute (`title`, `alt`, `aria-label`, `summary`, …), so new UI copy
  must go through the catalog rather than inline strings.
- Dynamic copy (times, durations, counts) is formatted at render time with the active
  locale's `Intl`; never call `toLocaleString()` without a locale and never hardcode
  `"en-US"`.

## Pull requests

- Fill in the pull request template: what changed, why, and how it was verified.
- Make sure `pnpm typecheck`, `pnpm lint`, and the relevant test lane pass.
- UI changes need a screenshot or recording and a manual check on the real
  Electron surface.
- Keep unrelated changes out of the PR.
- Update [`CHANGELOG.md`](./CHANGELOG.md) when the change is user-visible.

## Releases

Windows releases are built and published from this repository; see
[`docs/releasing.md`](./docs/releasing.md) for the versioning, packaging, update
channel, and signing-secret notes. In particular, keep `publish.owner`/`publish.repo`
and the update checker pointed at `ilovemajiaqi/pi-gui-cn`.

## Community guidelines

- Be respectful and assume good intent; see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
- Search existing issues and discussions before opening a new one.
- Report vulnerabilities privately via [SECURITY.md](./SECURITY.md).
- Questions about upstream behavior belong in the
  [upstream issue tracker](https://github.com/minghinmatthewlam/pi-gui/issues);
  mention whether the problem also occurs in the English build.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
