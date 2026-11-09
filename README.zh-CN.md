# pi-gui(简体中文)

[English README](README.md) · 上游项目:[minghinmatthewlam/pi-gui](https://github.com/minghinmatthewlam/pi-gui)

本仓库是 [pi coding agent](https://github.com/badlogic/pi-mono) 桌面客户端 pi-gui 的**完整简体中文化分支**:

- **全界面中文**:侧边栏、会话时间线、命令面板、技能与扩展、定时任务、工作台(文件/差异/终端)、设置,以及原生对话框与系统通知。
- **单一 i18n 机制**:全部走上游自研的 locale catalog(`apps/desktop/src/i18n/`),不修改构建产物、无字符串补丁。Settings → Appearance → Language 可在任意界面即时切换中英文,缺失词条自动回退英文。
- **main 进程跟随语言**:原生菜单(macOS)、更新对话框、系统通知通过 `getLocale`/`setLocale`/`localeChanged` IPC 通道与 renderer 保持同步(偏好持久化于 `ui-state.json`,schema v20)。
- **翻译防回退**:`tests/unit/renderer-copy.spec.ts` 以 AST 检查所有已翻译界面的 JSX 硬编码英文,新增界面登记后即受门禁保护。

## 与上游的关系

改动保持在上游架构与贡献规范之内,计划按目录拆分回馈上游:

1. `i18n: translate threads and app surfaces`
2. `i18n: translate conversation, workbench, extensions, scheduled tasks and command palette`
3. `i18n: add a main-process locale channel`

上游合入后,本仓库转为中文社区的加速维护渠道(跟随上游同步 + 及时补全新词条)。

## 构建(Windows)

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm package:win        # 产物在 apps/desktop/release/(setup.exe + portable.exe)
```

> 国内网络建议为 electron-builder 设置镜像:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`、
> `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`。

## 参与翻译

```sh
pnpm i18n:check zh-CN   # 列出缺失或仍为英文的词条(报告工具)
```

词条在 `apps/desktop/src/i18n/messages/en.ts`(英文源)与 `messages/zh-CN.ts`(中文,`Partial<Messages>`,缺失自动回退英文);工作流见 `apps/desktop/src/i18n/AGENTS.md`。欢迎 PR。

## 许可证

MIT(继承上游,版权归 Matthew Lam 及贡献者所有;中文翻译部分同等以 MIT 提供)。
