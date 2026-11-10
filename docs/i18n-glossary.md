# 简体中文术语与文案规范

`apps/desktop/src/i18n/messages/zh-CN.ts` 的所有中文值都遵循本页。新增或修改词条时先查术语表，再按标点规则润色。机器可检的部分由 `node scripts/check-zh-copy.mjs`（`pnpm check:architecture` 的一部分）把关，其余靠评审。

## 术语表

| 英文                              | 统一译法                      | 备注                                       |
| --------------------------------- | ----------------------------- | ------------------------------------------ |
| thread                            | 会话                          | 不用「对话」「线程」；新建用「新建会话」   |
| workspace                         | 工作区                        | 不用「工作空间」                           |
| worktree                          | 工作树                        | 保留 Git 概念                              |
| review                            | 审查                          | 不用「审核」                               |
| provider                          | 提供方                        | 全文统一                                   |
| endpoint                          | 端点                          | 不用「接口」                               |
| context window                    | 上下文窗口                    | 不用「上下文长度」                         |
| thinking level / reasoning effort | 思考深度                      | 不用「推理强度」                           |
| agent                             | 智能体                        | 产品名、代码路径（`~/.pi/agent/`）除外     |
| extension                         | 扩展                          |                                            |
| skill                             | 技能                          |                                            |
| scheduled task                    | 定时任务                      |                                            |
| fork                              | 派生                          | 动词与名词同形，如「派生会话」             |
| composer                          | 输入框                        | 不译作「编辑器」「撰写器」                 |
| command palette                   | 命令面板                      |                                            |
| side panel                        | 侧面板                        |                                            |
| shell                             | Shell                         | 产品名与技术名保留原文                     |
| OAuth                             | OAuth                         | 协议名保留原文                             |
| token                             | Token（上下文）/ 令牌（认证） | 按语境区分：上下文用量用 Token，凭据用令牌 |
| workbench / file browser          | 工作台 / 文件浏览器           |                                            |
| MCP server                        | MCP 服务                      | 指进程时用「MCP 服务」而非「MCP 服务器」   |

保留原文的还有：命令、路径、URL、模型 id、键盘快捷键、版本号，以及 `[bash]` 这类工具名。

## 标点规则

- 中文散文使用全角 `，。：；！？（）` 与 `“”`，省略号统一 `…`；不用 `, . : ; ! ? ( ) " "` 或 `...`。
- 中文与标点之间不加空格；中英文之间按需留一个半角空格（如「使用 Ollama 运行时」）。
- 括号里是中文时用全角括号，例如「已发布（当前 {current}）」「（可选）」；括号内容为纯技术串时保留半角，例如 `(en)`、`(v1)`。
- 冒号引导整句用全角冒号，例如「错误：」「用户：{preview}」。
- 组合占位符的句子要整句可译：不要在 catalog 里拆出「Include the 」「 suffix.」这类片段，改为一条消息加 `{placeholder}`，由 `interpolateNodes()` 注入 `<code>` 等标记。

## Key 命名

- 扁平的「面.区域.意图」三段式：`settings.notifications.access.description`、`conversation.timeline.tool.read`。
- 不用整句 camelCase（如 `ui.addOpenAICompatibleEndpointsOllamaVLLM…`），也不用 `Value1`/`Value2` 这类编号 key。
- key 不超过 60 字符，单段不超过 40 字符，`scripts/check-i18n-keys.mjs` 会拦下越界项。
- 词条值首尾不留空格，占位槽位的间距由各语言自己的词条承担（目前只有 `threads.inContext` 例外，且在脚本里列了原因）。

## 复数

- 英文给平 key 加 `_one` / `_other`。
- 中文语法只有单一类别，只写平 key，`count` 会复用同一条。

## 动态文案

- 时间、日期、时长、数量在渲染层用当前语言的 `Intl` 格式化（`useTranslation()` 的 `locale`），不要在主进程拼好英文串存进 transcript。
- 不要调用无 locale 的 `toLocaleString()` / `toLocaleDateString()`，也不要写死 `"en-US"`；仅解析用途（如校验时区、稳定读取 weekday）例外，并在代码里注明。
- 第三方扩展、工具 stdout、运行时错误原文保留不动，只翻译应用给它们套的外壳。

## 需要改词条时

1. 只改 `messages/zh-CN.ts` 的值，不动 key；新增 key 先加到 `messages/en.ts`。
2. 跑 `pnpm i18n:check zh-CN` 看是否还有缺失或仍为英文的值。
3. 跑 `pnpm i18n:check:strict` 与 `node scripts/check-zh-copy.mjs`，两者都必须干净。
4. 确属技术专名、必须与英文完全一致的值，写进 `apps/desktop/src/i18n/allowlist.json` 并附理由。
