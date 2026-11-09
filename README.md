<div align="center">

# pi-gui-zh

**[pi coding agent](https://github.com/earendil-works/pi) 桌面客户端 pi-gui 的完整简体中文版**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Upstream](https://img.shields.io/badge/upstream-pi--gui-0969da)](https://github.com/minghinmatthewlam/pi-gui)
[![简体中文](https://img.shields.io/badge/语言-简体中文-c01d2f)](#-功能特性)
![平台](https://img.shields.io/badge/平台-Windows%20%7C%20macOS%20%7C%20Linux-bfc7d7)

*基于上游 [minghinmatthewlam/pi-gui](https://github.com/minghinmatthewlam/pi-gui) · 英文说明见上游 README*

</div>

---

## 📖 简介

pi-gui 是 pi 编码代理(Codex 风格)的桌面图形客户端。本仓库在上游架构内完成了**全界面、真切换**的简体中文本地化:

- **不是运行时补丁，也不是机器翻译挂件**——全部文案走上游自研的 locale catalog（`apps/desktop/src/i18n/`），源码级接入，约 770 条词条，覆盖率 100%。
- **随时切换**：Settings → Appearance → Language（外观 → 语言）在中英文之间即时切换，所有界面立即生效，缺失词条自动回退英文。
- **跨进程一致**：除渲染进程界面外，原生菜单（macOS）、更新对话框、系统通知也通过 locale IPC 通道跟随当前语言。

## 🎬 宣传片

[![pi-gui-zh 宣传片](./promo/assets/readme/shot-brand.jpg)](./promo/remotion/out/promo.mp4)

50 秒全中文界面实录：并行会话、命令面板、变更审查、内置终端与定时任务，以及全片高潮——**语言切换即时生效**。

- [带 BGM 版](./promo/remotion/out/promo.mp4) · [无 BGM 版（保留音效，方便自配音乐）](./promo/remotion/out/promo-nobgm.mp4)
- 画面全部来自真实运行的桌面 app；演示项目「星尘笔记」为虚构数据，不含任何真实会话。
- 工程在 [`promo/remotion`](./promo/remotion)（Remotion + [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft)），从产品检查、分镜、BGM 卡拍到终检的全过程记录在 [`promo/DESIGN-SPEC.md`](./promo/DESIGN-SPEC.md)。

## 🖼️ 界面预览

| 会话时间线（并行线程） | 变更审查（行级 diff） |
| --- | --- |
| ![会话时间线](./promo/assets/readme/shot-threads.jpg) | ![变更审查](./promo/assets/readme/shot-review.jpg) |
| **命令面板（Ctrl+K）** | **语言切换即时生效** |
| ![命令面板](./promo/assets/readme/shot-palette.jpg) | ![语言切换](./promo/assets/readme/shot-hero.jpg) |

## 📚 目录

- [🎬 宣传片](#-宣传片)
- [🖼️ 界面预览](#️-界面预览)
- [✨ 功能特性](#-功能特性)
- [📦 安装](#-安装)
- [🚀 使用](#-使用)
- [🔧 实现要点](#-实现要点)
- [🗺️ 路线图](#️-路线图)
- [🤝 参与贡献](#-参与贡献)
- [🙏 致谢](#-致谢)
- [📄 许可证](#-许可证)

## ✨ 功能特性

pi-gui 本体功能（并行会话线程、git worktree 隔离、变更审查、内置终端、定时任务、技能/扩展管理等）见[上游 README](https://github.com/minghinmatthewlam/pi-gui#readme)。本仓库新增：

- **全界面中文**——侧边栏、新建对话页、会话时间线、命令面板（Cmd/Ctrl+K）、分支树与派生、模型/思考深度选择器、上下文用量面板、文件浏览器、差异审查、集成终端、技能与扩展、定时任务编辑器、设置全部分区、启动/故障恢复页，以及 MCP 登录等原生对话框与后台完成/失败系统通知。
- **语言切换真实生效**——切换后整个应用（含主进程对话框与通知）即时变更；多窗口同步；跟随系统语言自动选择。
- **翻译防回退门禁**——`renderer-copy.spec.ts` 以 TypeScript AST 检查全部已翻译界面的 JSX，硬编码英文一律构建失败，词条永不漂移。
- **翻译质量**——按桌面应用语境统一术语（会话/工作树/审查/上下文窗口/思考深度…），保留 Git 与技术专名。

## 📦 安装

### 方式一：下载安装包（推荐）

前往 [Releases](../../releases) 下载对应平台安装包：

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows x64 | `pi-gui-x-x64-setup.exe` | NSIS 安装器（推荐） |
| Windows x64 | `pi-gui-x-x64-portable.exe` | 免安装便携版 |
| macOS / Linux | 见上游 Releases | 本分支发布流水线沿用上游配置 |

> 安装包未做代码签名，首次运行如遇 SmartScreen 提示，选择“更多信息 → 仍要运行”。

### 方式二：从源码构建

依赖：Node.js 20+ 与 pnpm（corepack 管理）。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm package:win      # Windows，产物在 apps/desktop/release/
```

其他平台命令见上游 README（`package` / `package:linux` 等）。

> 🇨🇳 国内网络建议为 electron-builder 配置镜像，并处理两个已知构建坑：
>
> ```sh
> export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
> ```
> 若 winCodeSign 因符号链接权限失败，以 `-c.toolsets.winCodeSign=1.1.0` 走新版工具集。

## 🚀 使用

1. 安装后首次启动，若系统语言为简体中文则自动进入中文界面；也可手动切换：**Settings（设置）→ Appearance（外观）→ Language（语言）→ 简体中文**。
2. 语言偏好即时生效并跨窗口同步；更新对话框与系统通知同样跟随。
3. 会话数据与上游/官方版完全兼容（存储于 `~/.pi`），可放心交替使用。

## 🔧 实现要点

| 机制 | 说明 |
| --- | --- |
| locale catalog | 英文 `messages/en.ts` 为键源与回退，其他语言是 `Partial<Messages>`；插值、CLDR 复数、RTL 一应俱全（详见 `apps/desktop/src/i18n/AGENTS.md`） |
| 防回退门禁 | `tests/unit/renderer-copy.spec.ts` 用 TS AST 扫描 8 个已翻译界面的 JSX，残留硬编码英文即失败 |
| main 进程通道 | `getLocale` / `setLocale` / `localeChanged` 三条窄 IPC + `LocaleManager`（仿 theme-manager），偏好持久化于 `ui-state.json`（schema v20），macOS 菜单随语言整体重建 |
| e2e 稳定性 | 测试启动固定 `--lang=en-US`，断言英文界面，与上游 CI 环境一致，不受开发机系统语言影响 |

## 🗺️ 路线图

- [ ] 将三个 i18n 提交拆分回馈上游（`threads/app` → `其余 renderer 面` → `main locale 通道`）
- [ ] 繁体中文（`zh-Hant`）语言包（catalog 已支持 script 级匹配）
- [ ] 补全 e2e 对双语界面的兼容策略
- [ ] 跟随上游版本节奏同步新增界面词条

## 🤝 参与贡献

欢迎纠错与补充翻译！

1. 查看 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 与上游贡献规范；
2. 词条位于 `apps/desktop/src/i18n/messages/en.ts`（键源）与 `messages/zh-CN.ts`（中文）；
3. 检查工具：`pnpm i18n:check zh-CN` 列出缺失或仍为英文的词条；
4. 提交前请通过 `pnpm check`（格式化、lint、架构守卫、类型、单元测试）。

## 🙏 致谢

- [Matthew Lam（minghinmatthewlam）](https://github.com/minghinmatthewlam) 与 pi-gui 的全体贡献者——本仓库的全部价值都建立在这个优秀的项目之上，上游内置的 i18n 框架为中文版铺平了道路；
- [pi coding agent](https://github.com/earendil-works/pi) 及 [pi-mono](https://github.com/badlogic/pi-mono) 生态；
- 一并感谢上游为剩余界面国际化预留的设计与文档。

## 📄 许可证

[MIT](./LICENSE) © Matthew Lam 及上游贡献者 · 本仓库的翻译与本地化改动在同等 MIT 协议下提供。
