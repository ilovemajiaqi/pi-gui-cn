# pi-gui-zh 宣传片 · 设计 spec（自主自由创作）

> 模式：自主自由创作（用户已选）。阶段 0–3 决策由 Agent 自主定案并在此记录；
> 阶段 4–7 按本 spec 连续执行。30fps · 1920×1080 · 工程 `promo/remotion/`。

## 0. 产品简报

- **产品**：pi-gui-zh —— pi coding agent 桌面客户端（Electron，Codex 风格）的完整简体中文本地化版。
- **一句话卖点**：全界面、真切换的简体中文本地化——不是补丁，不是挂件，是语言本身。
- **受众**：中文开发者（用 coding agent 的工程师）。
- **用途**：README 主视觉 + 发布宣传；后续可发社交平台。
- **画幅/语言**：16:9 1920×1080，字幕与界面全 zh-CN（少量 mono 英文术语保留，与产品一致）。
- **时长**：约 52s（1540f）。
- **音频**：BGM 用户未指定 → 阶段 6 由 Agent 选型（`assets/audio/bgm/` 备选之一，做节奏分析后把镜头边界微调对拍）；SFX 从 Freesound 采集（CC0 优先）。交付带 BGM + 无 BGM 两版。
- **核心叙事**（能量弧按 `sequences/promo-energy-arc.md` 填空，有意识偏离已标记）：
  1. 【低开 · 品牌】pi-gui 是什么：pi coding agent 的桌面客户端，今天开始说中文。
  2. 【中 · 定场】真实中文界面整个立起来（crane-rise），"每一处界面都是中文"。
  3. 【中高⇄低 · 功能爬升】广度墙 → 并行会话 → 命令面板 → 变更审查 → 终端/定时任务。
  4. 【峰值 · HERO】语言切换即时生效——本片唯一的"单主角完整动作弧"（偏离说明：发布会合影式收场换成"切换瞬间"作峰值，因本产品的原子单位是"语言"而非功能列表；outro 仍保持 sign-off hold ≥1s）。
  5. 【收 · 底座+定妆】770 词条/100% 覆盖/防回退门禁的技术底气 → 字标 lockup 收场。

## 1. 需求到执行决策表

| 决策点 | 定案 | 依据 |
|---|---|---|
| 数据口径 | 全部演示数据**虚构**（demo workspace「星尘笔记」，会话/线程/diff 内容皆为编造）；不采集用户 `~/.pi` 真实会话；无密钥、无个人信息入镜 | 安全铁律 |
| 系统通知 | Windows 通知无法在无头采集稳定入镜 → 不实拍，用界内字卡交代"通知同样跟随" | 素材风险 |
| 原生菜单 | Windows 平台无 macOS 原生菜单 → 不展示，卖点字卡只提跨进程机制 | 同上 |
| 语言切换素材 | 同一会话页在真实 app 内切语言前后各截一次（同布局双态），在 Remotion 内做同帧翻转——比实拍录屏可控且确定 | 卖点即机制 |
| 打字/搜索演示 | Remotion 内以真实截图状态帧切换 + 光标层实现（避免重放真实 UI 的抖动） | type-and-filter 卡要求真实 UI |
| BGM 卡拍 | 选曲后做节奏分析；分镜边界与 major hit 微调对拍（±6f 内不打断分镜结构） | pipeline 阶段 3/6 |
| 手持 shake | 全片不加 | pipeline 判例：产品宣传片默认不加 |

## 2. 视觉方向与 tokens

**选定方向：终端微光 × 切换瞬间**（底座取①，叙事主轴取②；③ Startup Punch 弃——与开发者工具调性不符）。

### 设计 tokens（提取自 `apps/desktop/contracts/theme.ts` Default Dark + `tokens.css`）

| token | 值 | 用途 |
|---|---|---|
| window · bg | `#151514`（radial 中心亮至 `#1b1b1a`） | 全片底 |
| main / panel | `#1d1d1c` / elevated `#232322` | 截图、卡片 |
| ink / text / muted | `#eeeeea` / `#e4e3df` / `#b3b1ac`（soft `#9d9b95`） | 文字 |
| line / lineStrong | `#2c2c2a` / `#383732`；发丝线 `0 0 0 .5px ink13%` | 描边、elevation |
| accent | `#9aaed8`（单点亮光，禁群发 glint） | 强调、光 |
| success / error / warning | `#40c977` / `#e05467` / `#d97706` | diff、状态 |
| 字体 | UI：`Segoe UI Variable Display` → `Segoe UI` → `Microsoft YaHei`；mono：`Cascadia Code` → `Consolas` | 标题/正文/字卡；全部系统字体（渲染机确定性） |
| 字阶 | 11/12/14/16/20/28（产品内），标题字卡自用 28→120/225 | 排版层级 |
| 圆角 | 产品 4–18px；字卡 999/16 | |
| 光感 | 暗场单点 accent 光 + hairline；径向 vignette；无泛光群 | |
| 网格 | 4px 基；截图元素坐标来自 layout.json | |

### 动效性格 tokens（品牌→动效推导；能量轴：中低 · 调性轴：严肃偏工程）

| token | 值 | 出处 |
|---|---|---|
| 主时长（入场） | 18–24f | 专业信赖预设 ~21f |
| 入场 easing | `cubic-bezier(0, 0, 0.2, 1)`（app 的 `--ease-out`） | tokens.css |
| 落地弹（仅切换/归位） | `cubic-bezier(0.34, 1.3, 0.64, 1)`，过冲 ≤1.04，squash 0 | 判例：落地 y1>1 |
| hold 预算 | 品牌字标落定 ≥45f · 功能镜落定 ≥30f · 字卡 15–20f 自有呼吸 | R1/R3 |
| 相机 | 正视为默认；侧斜 orbit ≤2 处；缓推 ≤1.5%/s | 模板判例 |
| 大 slam | 全片 ≤3：S02 定场落定、S08 切换帧、S10 lockup 落定 | R4 |
| 文字入场 | 逐词 blur-slide（同产品 ease-out）一种嗓音；打字机只给 mono 命令/URL | 同质化控制 |

## 3. 功能到镜头映射

功能清单（P4，来自 README/源码）：整页中文界面、并行会话线程+工作树隔离、命令面板、变更审查 diff、内置终端、定时任务、技能/扩展、设置语言切换、跨进程一致（菜单/通知）、770 词条与防回退门禁。

| # | 功能 | 镜头卡（变体） | demo 源码定位（阶段 5 前精读） | 参考样片 |
|---|---|---|---|---|
| S01 | 品牌字标 | `typography/blur-slide`（字标段）+ 自写 SF1 版式 | shots/.../blur-slide 对应 demos/；assets/lib/Caption | gallery/ |
| S02 | 整页定场 | `opening/crane-rise-reveal` | demos/…/crane-rise-reveal | gallery/ |
| S03 | 界面广度 | `ui-entrance/page-waterfall-wall`（3 列后仰墙） | demos + assets/lib/（VerticalTicker 可参考） | gallery/ |
| S04 | 并行会话 | `ui-entrance/list-reveal` + PageCam 推近 | demos + assets/lib/PageCam | gallery/ |
| S05 | 命令面板 | `interaction/type-and-filter` | demos | gallery/ |
| S06 | 变更审查 | `ui-entrance/row-embed` | demos | gallery/ |
| S07 | 终端·定时任务 | `camera/terminal-3d`（取两站压缩版） | demos + PageCam | gallery/ |
| S08 | 语言切换 HERO | `interaction/segmented-thumb-hero`（thumb 微交互语法）+ 同帧双态翻转蒙太奇（自写，SF3 语法） | demos + assets/lib/FlashCut 参考 | gallery/ |
| S09 | 技术底座 | 自写：DigitRoll 数字 + mono 标签 | assets/lib/DigitRoll | — |
| S10 | 收场 lockup | 自写（SF1 版式回归；参考 `outro/logo-shrink-wordmark-lockup` 的收束节奏） | demos 参考 | gallery/ |
| 呼吸字卡 ×2 | 章节引导 | `typography/paper-title-card` | demos | gallery/ |

同质化检查：逐词文字入场 1 次（S01）、飞入类 S06 行级 1 次、墙级 S03 1 次、threed 站点 S07 1 次、微交互特写 S08 1 次——一种手法只当一次主角 ✅

## 4. 分镜表（1540f ≈ 51.3s @30fps）

| # | 时间 | 镜头 | 关键动效 |
|---|---|---|---|
| S01 | 0–120f | 开场字标 | kicker mono 打字浮现 → `pi-gui` 逐词 blur-slide → 徽章弹入（微过冲 ≤1.04）→ tagline → 全帧 hold 24f |
| S02 | 120–285f | 定场·整页 | 从输入框一行特写 crane-rise 拉升，整页中文 app 落定 + 轻缓推；落定为 slam① |
| T(S01→S02) | 内含 | shot-transitions | 推进流白（字标推近穿入特写） |
| S03 | 285–435f | 广度·瀑布墙 | 3 列真实中文界面截图 3D 后仰差速滚动；中列前景、缓推；「01 · 全界面」字卡 282–340f 前插 |
| T(S02→S03) | 内含 | shot-transitions | whip-pan 甩镜急刹 |
| S04 | 435–555f | 并行会话 | 侧栏线程列表逐项 reveal + PageCam 推近线程项特写 → 落定 |
| S05 | 555–660f | 命令面板 | Ctrl+K 浮层弹入 → 光标打字 → 结果态切换 → Enter 选中 |
| S06 | 660–760f | 变更审查 | diff 行 row-embed 逐行嵌入（底边亮缝）；PageCam 特写 added/removed 色条 |
| S07 | 760–890f | 终端·定时任务 | terminal-3d 两站：命令敲击→结果逐行滑出 → 定时任务卡片位 |
| S08 | 890–1100f | HERO·切换 | 「02 · 一键切换」字卡 887–945f 前插 → 设置页真实控件 → 光标点击「简体中文」（thumb 8f 滑动）→ 全界面同帧翻转（新对话页/时间线页/设置页双态蒙太奇 ×3 波）→ 通知字卡交代；切换帧 slam② |
| S09 | 1100–1205f | 技术底座 | 770 词条 DigitRoll 打点 + `100%` + `0 硬编码` mono 标签依次落定 |
| S10 | 1205–1340f | 收场 lockup | 底座暗去 → SF1 版式回归（字标+徽章+tagline）→ CTA「Releases 下载」；落定 slam③，hold ≥45f |
| 尾标 | 1340–1420f | 上游/致谢 | mono 小字：上游 pi-gui · pi · MIT；全帧淡出到黑 |
| 合计 | 1420f ≈ 47.3s | | （字卡含在段落帧内，上表已并入边界） |

帧级时间轴（源文件见阶段 5 `SHOTS` 表；hold 已按预算预扣）。BGM 选型后做 ±6f 内的边界对拍微调，不动结构。

## 5. 素材采集清单（阶段 4 输入）

| 素材 | 采集态 | 用途 |
|---|---|---|
| 主界面 · 新对话（空） | zh + en 同布局双态 | S02 定场 / S08 翻转第 1 波 |
| 会话时间线（虚构会话，含工具调用） | zh + en 双态 | S08 翻转第 2 波 / 墙 |
| 设置 · 外观 · 语言段 | zh（简体中文选中）+ en（English 选中） | S08 hero 控件与结果态 |
| 侧栏多线程 · 工作树 | zh | S04 / 墙 |
| 命令面板（空态 + 结果态） | zh | S05 |
| diff 审查页（虚构改动） | zh | S06 / 墙 |
| 内置终端（跑过命令的输出） | zh | S07 / 墙 |
| 定时任务列表 + 编辑器 | zh | S07 / 墙 |
| 技能页 · 扩展页 · 模型选择器· 上下文面板 · 文件浏览器 | zh | S03 墙列 |
| 以上全部 | 2x 截图 + per-element cutout + layout.json | PageCam / 贴图 |

演示数据冻结（采集前造好）：虚构 workspace「星尘笔记」（stardust-notes）：README.md + notes/ 三个文件 + git 历史；虚构会话「重构导出模块」：用户消息 → 读文件 → 编辑 → 回复；3–4 条虚构线程（含分支派生）。

## 6. 实施记录与偏离（阶段 5–7 审计链）

| 项 | 原计划 | 实际 | 理由 |
|---|---|---|---|
| S02 特写对准 | 输入框特写 | 时间线头部（用户气泡+工具行） | 开机即恢复最近会话（无空 new-thread 视图）；时间线信息密度更高 |
| S08 波③ | 系统通知实拍 | mono 字卡交代 | Windows 无头采集无法稳定截系统通知；决策表已记 |
| S03 墙素材 | 含技能/扩展页 | 弃用（9 张不含） | 采集发现 pi 会读取全局 ~/.agents/skills —— 真实用户技能（Goalpro 等）泄露入镜，按数据安全铁律弃用 |
| S07 tab 标签 | 真实 tab 文案 | 同形 chip 遮盖为 "stardust-notes — bash" | 终端 tab 标签含真实机器路径（MSYS /tmp 映射），chip 以产品 tokens 蒙皮 |
| BGM | 阶段 6 选型 | bgm-tech-house.mp3（Mixkit 免署名可商用），BPM 124.00 整、残差 <3ms、漂移 <0.1ms（网格验收 1x 胜出） | 对工程师调性、kick 网格机器稳定易卡拍 |
| 尾段切点 | 全部整数拍 | S10=1286f / S11=1431f 钉真实瞬态 | 渲后回测发现尾段最强瞬态偏离网格 −6.2f/+8.8f，按 music-beat-sync §4 稀疏重音规则微钉，边界在淡入/淡出内 |
| 视口 | 1920×1080 精确 | 1920×1082（收敛循环实测） | Windows 内容尺寸换算 ±2px；layout 坐标系逐采集自洽，不构成素材问题 |

采集轮次：R3（深色+相对路径定稿）→ R4（palette-empty）→ R5/R6（review-diff 选择器修正未中）→ R7（getByText last 中标）。终态纹理 = textures/（zh-CN 30 + en 24）。
SFX 全 CC0（7 素材，FREESOUND-CREDITS.md 随工程）；BGM Mixkit 免署名。

## 7. 终检修复轮（独立审查 fail → 修复 → 终渲）

独立 subagent 依据 final-review.md + aesthetic-rules.md 给出 fail（8 项 must_fix）。修复记录：

| must_fix | 修复 | 复验 |
|---|---|---|
| D1 墙卡终端 tab 泄露真实路径 | wall/card04 重裁（从命令行起，排除 tab 行） | 终帧 f420 无路径 |
| A6 母线削波（max 0.0dBFS、432/318 满刻度样本） | BGM 0.72→0.45、impact 0.8→0.7 / 0.95→0.8；终渲后 alimiter −1dB 母带 | 终版 max −0.7dB（nobgm −1.8dB），volumedetect 复测 |
| F3-1 S07 输出先于打字揭示 | 打字 1f/字符（4–42f），输出 46/50f 揭示 | f812 打字中 / f860 输出后 |
| F3-2 S07 双层 $ 提示符 + 残留块光标 | 命令/输出区补丁常驻，覆盖层单层绘制 | 同上 |
| B2-5 S07 tab 遮片 8px 错位 | 遮片改实测 bbox (panel 16,7,223,26) + 同形底色垫底 | f812/f860 tab 严丝合缝 |
| B2-3 S08 点击语义缺失（光标/涟漪落空、控件截断） | 特写改 zoom 1.9 / 行框 (697,182,753,70)，控件「Follow system」完整入画，光标与涟漪钉控件中心 (1372,210) | f1035 光标压控件 |
| B2-4 S08 波①后空框悬置 | 行高亮光晕收敛（1.5px / 0.28 外发光），框与行卡同 bbox | f1040+ |
| F3-3 命令面板英文动作区（产品 i18n bug） | `use-desktop-commands.ts` 补传 `t` 到 `buildPaletteActions`（默认参数绑的是 en translator）；重建 + 重采 palette 双态 | 新纹理动作全中文 |
| B2-1/B2-2 转场缺口 | promo.tsx 增流白（f112）与黑场 dip（f1427）覆盖层；BGM 尾 1.8s 淡出 | f118 白闪 / f1440 黑 dip |
| Q11 辅助字 <32px | S01 页脚删除（与 S10 重复）、S04 副句 34、S08 交代行 34、S09 标签 32、S10 页脚 32 / CTA 34、S11 34/32 | 静帧逐项复核 |
| A2-1 S07 打字声/扫光错位 | 打字声 3 声随打字窗（10/18/26f）；站 2 强调改指「创建」按钮光环 | — |
| C-1 C02 句号空隙 | 句号并入强调词「即时生效。」 | — |

产品侧附带修复：命令面板动作文案不随语言（本仓库 i18n 缺口，单行修复）。
终版交付：promo.mp4（BGM，mean −17.0dB / max −0.7dB）+ promo-nobgm.mp4（SFX，max −1.8dB），50.3s。
保留的 nice-to-have 项（记录理由，不修）：S08 en/zh 双态时间戳 35m/36m 相差 1 分钟（真实时钟数据，同帧翻转的 1 分钟差读作"稍后"）；S07 底层转写区与终端面板同信息（真实界面布局）。
