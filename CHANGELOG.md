# 变更日志

本项目的所有重要变更都记录在此文件中。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 计划中

- 繁体中文（`zh-Hant`）语言包；
- 将 i18n 改动拆分回馈上游；
- 补全 e2e 对双语界面的兼容策略；
- 跟随上游版本节奏同步新增界面词条。

## [1.0.1] - 2026-11-10

首个独立发布的简体中文版本，基于上游 pi-gui 1.0.1。

### 新增

- 全界面简体中文本地化：侧边栏、新建对话、会话时间线、命令面板、分支树、模型/思考深度选择器、上下文用量、文件浏览器、差异审查、集成终端、技能与扩展、定时任务、设置、启动/故障恢复页，以及原生对话框与系统通知；
- 主进程 locale 通道：`getLocale` / `setLocale` / `localeChanged` 三条窄 IPC 与 `LocaleManager`，偏好持久化于 `ui-state.json`；
- 语言即时切换：Settings → Appearance → Language，多窗口同步，并跟随系统语言自动选择；
- 翻译防回退门禁：`renderer-copy.spec.ts` 以 TypeScript AST 扫描已翻译界面的 JSX，残留硬编码英文即失败；
- 简体中文 README、50 秒全中文宣传片与界面截图；
- 开源社区健康文件：贡献指南、行为准则、安全策略、支持文档、Issue/PR 模板与变更日志。

### 变更

- e2e 测试固定 `--lang=en-US`，与上游 CI 环境保持一致；
- 原生菜单（macOS）、更新对话框和系统通知跟随当前语言重建或刷新。

### 修复

- 命令面板动作使用当前语言，而不是启动时的语言；
- 移除早期的运行时中文字符串补丁，全部文案统一走上游 locale catalog。

[Unreleased]: https://github.com/ilovemajiaqi/pi-gui-cn/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/ilovemajiaqi/pi-gui-cn/releases/tag/v1.0.1
