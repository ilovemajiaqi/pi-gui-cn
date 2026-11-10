/*
 * promo-capture.mts — pi-gui-zh 宣传片素材采集
 *
 * 在隔离的 userData + agentDir 里启动真实 Electron app（--force-device-scale-factor=2
 * 直出 3840×2160 物理纹理，CSS 布局 1920×1080），用 SessionManager 伪造的虚构演示
 * 会话 + 一个虚构 demo workspace 驱动界面，逐状态采 zh/en 双态三件套：
 * 全页截图 / 元素切片 / layout.json。输出到 promo/remotion/public/textures/。
 *
 * 运行：cd apps/desktop && npx jiti ./scripts/promo-capture.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, type Page } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(desktopDir, "..", "..");
const outRoot = path.join(
  repoRoot,
  "promo",
  "remotion",
  "public",
  process.env.PROMO_TEXTURES_DIR ?? "textures",
);

const hold = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- PNG 尺寸读取
function pngSize(file: string): { w: number; h: number } {
  const buf = readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------------------------------------------------------------- demo workspace
const DEMO_FILES: readonly [string, string][] = [
  [
    "README.md",
    `# 星尘笔记\n\n> 一个本地优先的 Markdown 笔记应用（演示项目）。\n\n## 能力\n\n- 离线优先，数据存本地\n- 双向链接与标签\n- 导出为静态站点\n\n## 开发\n\n\`\`\`sh\npnpm install\npnpm dev\n\`\`\`\n`,
  ],
  [
    "src/export.ts",
    `export function exportNote(note: Note): string {\n  return note.body;\n}\n\nexport function exportAll(notes: Note[]): string {\n  return notes.map(exportNote).join("\\n---\\n");\n}\n\nexport function legacyShim(): void {\n  // deprecated\n  console.log("legacy");\n}\n\ninterface Note {\n  id: string;\n  title: string;\n  body: string;\n}\n`,
  ],
  [
    "notes/双向链接.md",
    `# 双向链接\n\n链接到 [[标签系统]] 与 [[导出规划]]。\n\n反链在底部面板列出。\n`,
  ],
  ["notes/标签系统.md", `# 标签系统\n\n标签支持嵌套：#工作/周会。\n`],
  ["notes/导出规划.md", `# 导出规划\n\n目标：单文件夹静态导出，保留目录结构。\n`],
  ["package.json", `{ "name": "stardust-notes", "version": "1.2.0", "private": true }\n`],
];

const DIFF_FILES: readonly [string, string][] = [
  [
    "src/export.ts",
    `export function exportNote(note: Note): string {\n  return renderMarkdown(note.body);\n}\n\nexport function exportAll(notes: Note[]): string {\n  return notes.map(exportNote).join("\\n---\\n");\n}\n\nexport * from "./export";\n\ninterface Note {\n  id: string;\n  title: string;\n  body: string;\n  tags?: string[];\n}\n`,
  ],
  [
    "README.md",
    `# 星尘笔记\n\n> 一个本地优先的 Markdown 笔记应用（演示项目）。\n\n## 能力\n\n- 离线优先，数据存本地\n- 双向链接与标签\n- 一键导出为静态站点\n- 标签嵌套与过滤\n`,
  ],
];

async function makeDemoWorkspace(parent: string): Promise<string> {
  const ws = path.join(parent, "stardust-notes");
  for (const [rel, content] of DEMO_FILES) {
    const p = path.join(ws, rel);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content, "utf8");
  }
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "星尘演示",
    GIT_COMMITTER_NAME: "星尘演示",
    GIT_AUTHOR_EMAIL: "demo@stardust.local",
    GIT_COMMITTER_EMAIL: "demo@stardust.local",
  };
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: ws, encoding: "utf8", env: gitEnv, stdio: "pipe" } as never);
  git(["init", "-b", "main"]);
  await writeFile(path.join(ws, "notes", "清单模板.md"), "## 今日\n- [ ] 整理标签\n", "utf8");
  git(["add", "."]);
  git(["commit", "-m", "初始化星尘笔记"]);
  await writeFile(
    path.join(ws, "notes", "清单模板.md"),
    "## 今日\n- [ ] 整理标签\n- [x] 复习双向链接\n",
    "utf8",
  );
  git(["add", "."]);
  git(["commit", "-m", "添加清单模板"]);
  // 留下未提交改动，供变更审查页展示真实 diff
  for (const [rel, content] of DIFF_FILES) await writeFile(path.join(ws, rel), content, "utf8");
  await writeFile(
    path.join(ws, "notes", "路线图.md"),
    "# 路线图\n\n- [x] 标签系统\n- [ ] 同步引擎\n- [ ] 移动端\n",
    "utf8",
  );
  await mkdir(path.join(ws, "src", "legacy"), { recursive: true });
  await writeFile(path.join(ws, "src", "legacy", "old.ts"), "// deprecated shim\n", "utf8");
  return ws;
}

// ---------------------------------------------------------------- agentDir + 会话
async function seedAgentDir(agentDir: string): Promise<void> {
  await mkdir(agentDir, { recursive: true });
  await writeFile(
    path.join(agentDir, "auth.json"),
    JSON.stringify({ openai: { type: "api_key", key: "demo-not-a-real-key" } }, null, 2),
    "utf8",
  );
  await writeFile(
    path.join(agentDir, "settings.json"),
    JSON.stringify(
      {
        defaultProvider: "openai",
        defaultModel: "gpt-5.4",
        defaultThinkingLevel: "high",
        enabledModels: ["openai/gpt-5.4", "openai/gpt-4o"],
      },
      null,
      2,
    ),
    "utf8",
  );
}

interface SM {
  create(cwd: string): {
    appendMessage(m: Record<string, unknown>): string;
    appendModelChange(provider: string, modelId: string): void;
    appendThinkingLevelChange(level: string): void;
    appendSessionInfo(name: string): void;
    branch(entryId: string): void;
    getSessionId(): string;
  };
}

const BASE_USAGE = {
  input: 4_820,
  output: 812,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 5_632,
  cost: { input: 0.0145, output: 0.0081, cacheRead: 0, cacheWrite: 0, total: 0.0226 },
};

const meta = (): Record<string, unknown> => ({
  api: "openai-responses",
  provider: "openai",
  model: "gpt-5.4",
  usage: BASE_USAGE,
});

async function seedSessions(agentDir: string, wsPath: string): Promise<void> {
  const mod = (await import("@earendil-works/pi-coding-agent")) as unknown as {
    SessionManager: SM;
  };
  const { SessionManager } = mod;
  const prev = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;
  try {
    let t = Date.now() - 42 * 60_000;
    const tick = () => (t += 24_000);

    // 最旧：修复深色模式闪烁（含分支派生）
    {
      const sm = SessionManager.create(wsPath);
      sm.appendModelChange("openai", "gpt-5.4");
      sm.appendThinkingLevelChange("high");
      sm.appendMessage({
        role: "user",
        content: "深色模式切换时首屏会闪一下白底，帮我定位。",
        timestamp: tick(),
      });
      const root = sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "先看主题变量注入与首帧 paint 的顺序。我怀疑是 active-theme 写入 ui-state 与渲染时序的竞争。",
          },
        ],
        ...meta(),
        stopReason: "stop",
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "user",
        content: "怀疑是内联恢复脚本没跑在首帧之前。",
        timestamp: tick(),
      });
      sm.branch(root);
      sm.appendMessage({
        role: "user",
        content: "换个方向：把主题脚本内联进 index.html 首段。",
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "方案 A 可行：内联一次性主题脚本，避免二级 paint。需要把 fallback 色也写进去。",
          },
        ],
        ...meta(),
        stopReason: "stop",
        timestamp: tick(),
      });
      sm.appendSessionInfo("修复深色模式闪烁");
    }

    // 撰写 1.2.0 发版说明
    {
      const sm = SessionManager.create(wsPath);
      sm.appendMessage({
        role: "user",
        content: "整理 1.2.0 的发版说明，突出导出的改进。",
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "三部分：导出重构、新的标签过滤、以及若干修复。导出部分放在最前，附前后对比。",
          },
        ],
        ...meta(),
        stopReason: "stop",
        timestamp: tick(),
      });
      sm.appendSessionInfo("撰写 1.2.0 发版说明");
    }

    // 整理待办
    {
      const sm = SessionManager.create(wsPath);
      sm.appendMessage({
        role: "user",
        content: "把 notes/清单模板.md 整理成每日模板，加一段「复习区」。",
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "text",
            text: "已加「复习区」三个条目：术语、反链、昨日摘要。",
          },
        ],
        ...meta(),
        stopReason: "stop",
        timestamp: tick(),
      });
      sm.appendSessionInfo("整理每日清单模板");
    }

    // 最新：重构导出模块（完整工具时间线）
    {
      const sm = SessionManager.create(wsPath);
      sm.appendModelChange("openai", "gpt-5.4");
      sm.appendThinkingLevelChange("high");
      sm.appendMessage({
        role: "user",
        content:
          "src/export.ts 太散了：把公共 API 按功能分组，补一份顶层索引导出，顺便跑一下测试确认没回归。",
        timestamp: tick(),
      });
      const readCall = "call-read-export";
      sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: readCall,
            name: "read",
            arguments: { path: "src/export.ts", offset: 1, limit: 30 },
          },
        ],
        ...meta(),
        stopReason: "toolUse",
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "toolResult",
        toolCallId: readCall,
        toolName: "read",
        content: [
          {
            type: "text",
            text: "export function exportNote(note: Note): string {\n  return note.body;\n}\n\nexport function legacyShim(): void { … }\n\ninterface Note { … }",
          },
        ],
        isError: false,
        timestamp: tick(),
      });
      const editCall = "call-edit-export";
      sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: editCall,
            name: "edit",
            arguments: {
              path: "src/export.ts",
              old_string:
                'export function legacyShim(): void {\n  // deprecated\n  console.log("legacy");\n}',
              new_string:
                'export * from "./export";\n\nexport function renderMarkdown(body: string): string {\n  return body.replace(/^## /, "h2");\n}',
            },
          },
        ],
        ...meta(),
        stopReason: "toolUse",
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "toolResult",
        toolCallId: editCall,
        toolName: "edit",
        content: [{ type: "text", text: "Edited src/export.ts" }],
        isError: false,
        timestamp: tick(),
      });
      const bashCall = "call-bash-test";
      sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: bashCall,
            name: "bash",
            arguments: { command: "pnpm vitest run export --reporter=dot" },
          },
        ],
        ...meta(),
        stopReason: "toolUse",
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "toolResult",
        toolCallId: bashCall,
        toolName: "bash",
        content: [
          {
            type: "text",
            text: "PASS  src/export.test.ts\nTests  12 passed (12)\nDuration  2.41s",
          },
        ],
        isError: false,
        timestamp: tick(),
      });
      sm.appendMessage({
        role: "assistant",
        content: [
          {
            type: "text",
            text: '重构完成：\n\n1. `exportNote` 现在走 `renderMarkdown`，正文渲染与新导出能力打通；\n2. 移除了 `legacyShim`，顶层补了 `export * from "./export"` 索引；\n3. `vitest` 12 项全绿，无回归。\n\n后续可以把 `renderMarkdown` 的正则替换换成编译器插件，风险更低。',
          },
        ],
        ...meta(),
        usage: { ...BASE_USAGE, output: 1_238, totalTokens: BASE_USAGE.input + 1_238 },
        stopReason: "stop",
        timestamp: tick(),
      });
      sm.appendSessionInfo("重构导出模块");
    }
  } finally {
    if (prev === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = prev;
  }
}

// ---------------------------------------------------------------- 采集驱动
type Locale = "en" | "zh-CN";

const cutTimeout = (what: string): Promise<never> =>
  new Promise((_, reject) => setTimeout(() => reject(new Error(`cut timeout: ${what}`)), 20_000));

interface CutSpec {
  readonly name: string;
  readonly selector: string;
}

const COMMON_CUTS: readonly CutSpec[] = [
  { name: "sidebar", selector: ".sidebar" },
  { name: "topbar", selector: '[data-testid="topbar"]' },
  { name: "composer", selector: '[data-testid="composer"]' },
  { name: "transcript", selector: '[data-testid="transcript"]' },
];

function pngOf(locale: Locale, stateName: string): string {
  return path.join(outRoot, locale, `${stateName}.png`);
}

async function captureState(
  page: Page,
  locale: Locale,
  stateName: string,
  extraCuts: readonly CutSpec[] = [],
): Promise<void> {
  console.log(`  -> ${locale}/${stateName}`);
  await page.evaluate(() => document.fonts.ready);
  await hold(700);
  await mkdir(path.join(outRoot, locale), { recursive: true });
  const full = pngOf(locale, stateName);
  // 看门狗：截图挂死就抛错走人，不冻结整个流程
  const shotOp = page.screenshot({ path: full, animations: "disabled" }).catch((error) => {
    throw new Error(`screenshot failed: ${String(error).slice(0, 160)}`);
  });
  const watchdog = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("screenshot watchdog (30s)")), 30_000),
  );
  await Promise.race([shotOp, watchdog]);
  const size = pngSize(full);

  const elements: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const cuts: readonly CutSpec[] = [...COMMON_CUTS, ...extraCuts];
  for (const cut of cuts) {
    const el = page.locator(cut.selector).first();
    try {
      if (!(await Promise.race([el.isVisible(), cutTimeout(cut.name)]))) continue;
      const box = await Promise.race([el.boundingBox(), cutTimeout(cut.name)]);
      if (!box) continue;
      elements[cut.name] = {
        x: Math.round(box.x),
        y: Math.round(box.y),
        w: Math.round(box.width),
        h: Math.round(box.height),
      };
      await Promise.race([
        el.screenshot({
          path: path.join(outRoot, locale, `${stateName}--${cut.name}.png`),
          animations: "disabled",
        }),
        cutTimeout(`${stateName}--${cut.name}`),
      ]);
    } catch {
      // 该状态没有这个元素很正常
    }
  }
  await writeFile(
    path.join(outRoot, locale, `${stateName}.layout.json`),
    JSON.stringify({ pageW: size.w / 2, pageH: size.h / 2, elements }, null, 2),
    "utf8",
  );
  console.log(
    `  [${locale}] ${stateName} -> ${size.w}x${size.h} (${Object.keys(elements).length} cuts)`,
  );
}

async function main(): Promise<void> {
  // 输出目录是本脚本专属产物：启动时无条件清空重建，天然幂等；Windows 偶发文件锁，重试兜底
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rm(outRoot, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt >= 6) throw error;
      console.warn(`rm busy, retry ${attempt + 1} in 1.2s`);
      await hold(1200);
    }
  }
  await mkdir(outRoot, { recursive: true });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "pi-gui-promo-"));
  const userDataDir = path.join(tempDir, "userdata");
  const agentDir = path.join(tempDir, "userdata", "agent");
  await mkdir(userDataDir, { recursive: true });
  await seedAgentDir(agentDir);
  const workspacePath = await makeDemoWorkspace(path.join(tempDir, "workspaces"));
  await seedSessions(agentDir, workspacePath);
  console.log(`userData: ${userDataDir}\nworkspace: ${workspacePath}`);

  const { createRequire } = (await import("node:module")) as {
    createRequire: (p: string) => NodeRequire;
  };
  const electronCli = createRequire(scriptDir + path.sep)["electron"] as string;

  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  // 剥掉可能让 fixture 发起真实请求的 provider 凭据
  for (const key of Object.keys(env)) {
    if (/_API_KEY$|ANTHROPIC_OAUTH_TOKEN|AWS_|CLOUDFLARE_/.test(key)) delete env[key];
  }
  Object.assign(env, {
    PI_APP_USER_DATA_DIR: userDataDir,
    PI_APP_INITIAL_WORKSPACES: workspacePath,
    PI_APP_TEST_MODE: "foreground",
    PI_CODING_AGENT_DIR: agentDir,
    PI_APP_OPEN_DEVTOOLS: "0",
  });

  const electronApp = await electron.launch({
    args: [
      desktopDir,
      "--lang=en-US",
      "--force-device-scale-factor=2",
      // 窗口挪到屏幕外后 Chromium 会把渲染器当"被遮挡"节流/停帧，截图会卡死——全部禁掉
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ],
    cwd: desktopDir,
    env,
  });

  const page = await electronApp.firstWindow();
  await page.waitForSelector('[data-testid="topbar"]', { timeout: 120_000 });
  // 迭代收敛到精确 1920×1080 CSS 视口（窗口框宽度在 Windows 上不精确，按实测差值补）
  for (let iteration = 0; iteration < 5; iteration += 1) {
    await hold(600);
    const probe = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
    const deltaW = 1920 - probe.w;
    const deltaH = 1080 - probe.h;
    if (Math.abs(deltaW) <= 0 && Math.abs(deltaH) <= 0) break;
    await electronApp.evaluate(
      ({ BrowserWindow }, delta) => {
        const win =
          BrowserWindow.getAllWindows().find(
            (w) => !w.isDestroyed() && w.webContents.getURL().length > 0,
          ) ?? BrowserWindow.getAllWindows()[0];
        // Windows 对不可缩放窗口忽略 resize——必须先解锁再改尺寸
        win.setResizable(true);
        win.setMinimumSize(0, 0);
        const bounds = win.getContentBounds();
        win.setContentSize(bounds.width + delta[0], bounds.height + delta[1]);
        // 每次改尺寸后重新甩到屏幕外，别打扰正在工作的人
        const outer = win.getBounds();
        win.setBounds({ x: -6000, y: 40, width: outer.width, height: outer.height });
        win.blur();
      },
      [deltaW, deltaH],
    );
  }
  await hold(600);

  const vp = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio,
  }));
  console.log(`viewport ${vp.w}x${vp.h} @ ${vp.dpr}x`);
  // PageCam 以每次采集的 layout.json 为坐标系，±24px 的视口差异不构成素材问题，只有 2x 纹理是硬要求
  if (vp.dpr !== 2) throw new Error(`devicePixelRatio is ${vp.dpr}, expected 2`);
  if (vp.w < 1600 || vp.h < 950) throw new Error(`CSS viewport too small: ${vp.w}x${vp.h}`);

  const setThemeDark = async (): Promise<void> => {
    await page.evaluate(async () => {
      const app = (window as unknown as { piApp?: { setThemeMode(m: string): Promise<unknown> } })
        .piApp;
      if (!app) throw new Error("piApp unavailable");
      await app.setThemeMode("dark");
    });
    await hold(1200);
  };

  const setLocale = async (locale: Locale): Promise<void> => {
    await page.evaluate(async (l) => {
      const app = (window as unknown as { piApp?: { setLocale(l: string): Promise<void> } }).piApp;
      if (!app) throw new Error("piApp unavailable");
      await app.setLocale(l);
    }, locale);
    await hold(2000);
  };

  const openPalette = async (): Promise<void> => {
    await page.keyboard.press("Control+k");
    await page.waitForSelector('[data-testid="command-palette"]', { timeout: 15_000 });
    await hold(500);
  };
  const closePalette = async (): Promise<void> => {
    await page.keyboard.press("Escape");
    await hold(500);
  };

  let locale: Locale = "en";
  const shoot = (stateName: string, cuts: readonly CutSpec[] = []) =>
    captureState(page, locale, stateName, cuts);

  const captureAll = async (): Promise<void> => {
    // 1 · 新对话页（默认）
    await shoot("new-thread");

    // 2 · 时间线（选最新会话）
    try {
      await page.evaluate(async () => {
        const app = (
          window as unknown as {
            piApp?: {
              getState(): Promise<{
                workspaces: {
                  id: string;
                  sessions: { id: string; title: string }[];
                }[];
              }>;
              selectSession(a: unknown): Promise<void>;
            };
          }
        ).piApp;
        if (!app) throw new Error("piApp unavailable");
        const st = await app.getState();
        const ws = st.workspaces[0];
        const target = ws.sessions.find((s) => s.title === "重构导出模块") ?? ws.sessions.at(-1);
        if (!target) throw new Error("no session found");
        await app.selectSession({ workspaceId: ws.id, sessionId: target.id });
      });
      await page.waitForSelector('[data-testid="transcript"]', { timeout: 30_000 }).catch(() => {});
      await hold(1800);
      await shoot("timeline");
    } catch (error) {
      console.warn(`  timeline failed: ${String(error).slice(0, 200)}`);
    }
    await closePalette();

    // 3 · 命令面板（时间线页之上，空态 + 输入态各一帧）
    try {
      await openPalette();
      await hold(600);
      await shoot("palette-empty", [
        { name: "palette", selector: '[data-testid="command-palette"]' },
      ]);
      await page.keyboard.insertText(locale === "en" ? "review" : "重构");
      await hold(800);
      await shoot("palette", [{ name: "palette", selector: '[data-testid="command-palette"]' }]);
    } catch (error) {
      console.warn(`  palette failed: ${String(error).slice(0, 200)}`);
    }
    await closePalette();

    // 4 · 变更审查（Ctrl+R；再点开 src/export.ts 的 diff）
    try {
      await page.keyboard.press("Control+r");
      await hold(2400);
      await shoot("review", [
        { name: "file-workbench", selector: '[data-testid="file-workbench"]' },
        { name: "file-explorer", selector: '[data-testid="file-explorer"]' },
      ]);
      // 文件树里的 src/export.ts 行（单选择器，避免严格模式多匹配异常）
      const diffRow = page.getByText(/export.ts/).last();
      if (await diffRow.isVisible().catch(() => false)) {
        await diffRow.click();
        await hold(2400);
        await shoot("review-diff", [
          { name: "file-workbench", selector: '[data-testid="file-workbench"]' },
          { name: "file-explorer", selector: '[data-testid="file-explorer"]' },
        ]);
      } else {
        console.warn("  review-diff row not found");
      }
      await page.keyboard.press("Control+r");
      await hold(1000);
    } catch (error) {
      console.warn(`  review failed: ${String(error).slice(0, 200)}`);
    }

    // 5 · 内置终端（Ctrl+J；先清屏并换短提示符，避免真实用户名/机器名入镜）
    try {
      await page.keyboard.press("Control+j");
      await hold(1600);
      await page.keyboard.insertText('clear && export PS1="$ "');
      await page.keyboard.press("Enter");
      await hold(1200);
      await page.keyboard.insertText('node -v && echo "stardust-notes dev ready"');
      await page.keyboard.press("Enter");
      await hold(2600);
      await shoot("terminal", [
        { name: "terminal", selector: '[data-testid="integrated-terminal"]' },
      ]);
      await page.keyboard.press("Control+j");
      await hold(900);
    } catch (error) {
      console.warn(`  terminal failed: ${String(error).slice(0, 200)}`);
    }

    // 6 · 定时任务
    try {
      await page.locator('[data-testid="sidebar-scheduled"]').first().click();
      await hold(1500);
      await shoot("scheduled-list", [
        { name: "scheduled", selector: '[data-testid="scheduled-tasks-view"]' },
      ]);
      const create = page.locator('[data-testid="scheduled-task-create"]').first();
      if (await create.isVisible().catch(() => false)) {
        await create.click();
        await hold(1300);
        const title = page.locator('[data-testid="scheduled-task-title"]').first();
        if (await title.isVisible().catch(() => false)) {
          await page.keyboard.insertText("每日整理笔记索引");
          const instruction = page.locator('[data-testid="scheduled-task-instruction"]').first();
          await instruction.fill("检查 notes/ 目录，为没有标签的笔记补上默认标签，并更新索引。");
          await hold(500);
          await shoot("scheduled-editor", [
            { name: "scheduled", selector: '[data-testid="scheduled-tasks-view"]' },
          ]);
          await page.keyboard.press("Escape");
          await hold(500);
        }
      }
    } catch (error) {
      console.warn(`  scheduled failed: ${String(error).slice(0, 200)}`);
    }
    // 回到会话视图
    await page
      .locator('[data-testid="sidebar-scheduled"]')
      .first()
      .click()
      .catch(() => {});
    await hold(900);

    // 7 · 技能 & 扩展（侧栏按钮，中英文案不同）
    const sidebarNav = (pattern: RegExp) => page.locator(".sidebar").getByText(pattern).first();
    try {
      const skillsBtn = sidebarNav(locale === "en" ? /^Skills/i : /^技能/);
      if (await skillsBtn.isVisible().catch(() => false)) {
        await skillsBtn.click();
        await hold(1800);
        await shoot("skills", [
          { name: "skills-surface", selector: '[data-testid="skills-surface"]' },
        ]);
      } else {
        console.warn("  skills button not found");
      }
    } catch (error) {
      console.warn(`  skills failed: ${String(error).slice(0, 200)}`);
    }
    try {
      const extBtn = sidebarNav(locale === "en" ? /^Extensions/i : /^扩展/);
      if (await extBtn.isVisible().catch(() => false)) {
        await extBtn.click();
        await hold(1800);
        await shoot("extensions", [
          { name: "extensions-surface", selector: '[data-testid="extensions-surface"]' },
        ]);
      } else {
        console.warn("  extensions button not found");
      }
    } catch (error) {
      console.warn(`  extensions failed: ${String(error).slice(0, 200)}`);
    }

    // 8 · 设置页（外观 → 语言）
    try {
      await page.keyboard.press("Control+,");
      await page.waitForSelector('[data-testid="settings-surface"]', { timeout: 15_000 });
      await hold(1400);
      await shoot("settings-root", [
        { name: "settings", selector: '[data-testid="settings-surface"]' },
      ]);
      const appearanceBtn = page
        .getByRole("button", { name: locale === "en" ? "Appearance" : "外观" })
        .first();
      if (await appearanceBtn.isVisible().catch(() => false)) {
        await appearanceBtn.click();
        await hold(1300);
        await shoot("settings-appearance", [
          { name: "settings", selector: '[data-testid="settings-surface"]' },
        ]);
      }
      await page.keyboard.press("Escape");
      await hold(700);
    } catch (error) {
      console.warn(`  settings failed: ${String(error).slice(0, 200)}`);
    }
  };

  // —— 主题钉深色（设计 spec 的 Codex Dark 底座）——
  await setThemeDark();

  // —— 英文态 ——
  locale = "en";
  await setLocale("en");
  await captureAll();

  // —— 切换到中文（真实 IPC 切换，产品卖点的机制本身）——
  locale = "zh-CN";
  await setLocale("zh-CN");
  await captureAll();

  await electronApp.close();
  console.log(`\nDone. Textures in ${outRoot}`);
  console.log(`(temp session data: ${tempDir} — safe to delete)`);
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  // 不留下孤儿 electron：主流程退出失败时也尝试关掉 app，然后彻底退出进程
  process.exit(1);
});
