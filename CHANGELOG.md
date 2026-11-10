# 变更日志

本项目的所有重要变更都记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复

- Windows 上已删除/新增文件的行级 diff 永远为空：`git-review.ts` 用 `os.devNull`（Windows 为 `\\.\nul`）当“文件缺失”哨兵传给 `git diff --no-index`，git 无法访问该路径并以状态码 1 结束，而错误处理只拦截大于 1 的退出码，空输出被当作成功返回。改用平台正确的空设备名，并把“无输出但有错误”也判为失败；
- Windows 上 `ui-state.json` 的并发读取会在原子替换瞬间失败：`atomic-file-write.ts` 先删除目标再重命名，中间存在 `ENOENT` 窗口。改为有界重试重命名，读取端对瞬时锁错误同样重试；
- `@pi-gui/catalogs` 的原子写入在 Windows 上并发时必然 `EPERM`：补上与桌面端一致的有界重试；
- 切换语言时若偏好写盘失败，主进程会整段跳过广播，导致界面已切换而菜单、对话框、通知仍停在旧语言。现在先广播再把失败抛回调用方；
- 两个扩展示例的假 `gh` 通过 shebang 执行，Windows 上会落到真实 `gh` CLI 并因未登录而失败。改为显式用当前 Node 启动同一个脚本；
- `verify-linux-release.test.mjs` 假设 `bash` 在 PATH 上，Git for Windows 的 bash 位于 `Git\bin`，测试必然 `ENOENT`。改为能力探针，真正找到时照常执行。

### 变更

- 相对时间与时间线时刻改由 `Intl` 按当前语言格式化：侧栏此前在中文界面显示 `5m`，时间线显示 12 小时制；
- 标点门禁补上句号；渲染层文案扫描不再漏掉 `main.tsx`、i18n 运行时与 `ui/` 下的 8 个文件；
- macOS 菜单从 `main.ts` 抽成纯模板 + 薄安装器，非 macOS 平台显式 `setApplicationMenu(null)`；
- `app-store.ts` 的 17 个模块级纯函数迁至 `app-store-free-functions.ts` 并补齐单测；
- 全部 GitHub Actions 钉到 40 位 commit SHA 并附版本注释，守卫反过来强制校验；各工作流权限收敛到最小集；
- Dependabot 覆盖 pnpm workspace 与 `promo/remotion`，并忽略 `electron` 与 `pi-coding-agent` 的大版本（会改变打包产物的 ABI）；
- `.gitattributes` 统一 `eol=lf`，`*.ps1`/`*.cmd`/`*.bat` 例外。

### 新增

- `windows-guards` CI 任务：在 `windows-latest` 上跑完整守卫与单元测试。此前没有任何 Windows runner 执行过它们；
- `desktop-locale` CI 任务：独立跑三条语言相关 e2e，并新增对主进程重建的菜单与系统通知的覆盖；
- CodeQL 工作流（`javascript-typescript`，`security-extended`）；
- `apps/desktop/tests/helpers/platform-capabilities.ts`：符号链接、NTFS 保留字符、可执行位的能力探针。

## [1.0.1] - 2026-11-10

首个独立发布的简体中文版本，基于上游 pi-gui 1.0.1。

### 新增

- 全界面简体中文本地化：侧边栏、新建对话、会话时间线、命令面板、分支树、模型/思考深度选择器、上下文用量、文件浏览器、差异审查、集成终端、技能与扩展、定时任务、设置、启动/故障恢复页，以及原生对话框与系统通知；
- 主进程 locale 通道：`getLocale` / `setLocale` / `localeChanged` 三条窄 IPC 与 `LocaleManager`，偏好持久化于 `ui-state.json`；
- 语言即时切换：Settings → Appearance → Language，多窗口同步，并跟随系统语言自动选择；
- 翻译防回退门禁：`renderer-copy.spec.ts` 以 TypeScript AST 递归扫描已翻译界面的 JSX（含嵌套目录）与 `title`/`alt`/`aria-*`/`summary` 等承载文案的属性，残留硬编码英文即失败；`i18n:check:strict` 进一步在 `pnpm check` 中拦下缺失词条与仍为英文的值（可用 `allowlist.json` 附原因豁免）；
- 简体中文 README、50 秒全中文宣传片与界面截图；
- 开源社区健康文件：贡献指南、行为准则、安全策略、支持文档、Issue/PR 模板与变更日志。

### 变更

- 自动更新检查、发布配置与安装包元数据全部指向本仓库，避免中文版被上游英文版更新覆盖；
- e2e 测试固定 `--lang=en-US`，与上游 CI 环境保持一致；
- 原生菜单（macOS）、更新对话框和系统通知跟随当前语言重建或刷新。

### 修复

- 命令面板动作使用当前语言，而不是启动时的语言；
- 移除早期的运行时中文字符串补丁，全部文案统一走上游 locale catalog。

[Unreleased]: https://github.com/ilovemajiaqi/pi-gui-cn/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/ilovemajiaqi/pi-gui-cn/releases/tag/v1.0.1
