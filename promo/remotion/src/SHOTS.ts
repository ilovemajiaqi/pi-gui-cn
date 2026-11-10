// SHOTS —— 全片时间轴唯一事实源。边界锚在 BGM 拍号上（beatF），内部动效保留局部帧表。
// 音乐分析：analysis/beat_data.json（bgm-tech-house，BPM 124.00，t0=9.458492s，T=0.4838524s，
// 网格验收 1x 胜出：match 1.0 / mean 2.9ms / 漂移 <0.1ms —— 机器鼓点）。
// 视频起点 = 源音乐拍 8（t=13.3289s，裁剪 BGM 从此处开始）。
export const FPS = 30;
export const SOURCE_BEAT0 = 9.458492;
export const BEAT_SECONDS = 0.4838524;
export const OUTPUT_AUDIO_OFFSET_SEC = 0; // 渲后回测若有编码偏移再填实测
export const BGM_START_BEAT = 8; // 视频第 0 帧 ↔ 源音乐拍 8
export const BGM_START_TIME =
  SOURCE_BEAT0 + BGM_START_BEAT * BEAT_SECONDS + OUTPUT_AUDIO_OFFSET_SEC; // 13.3289s

const beatT = (n: number) => SOURCE_BEAT0 + OUTPUT_AUDIO_OFFSET_SEC + n * BEAT_SECONDS;
export const beatF = (n: number) => Math.round(beatT(n) * FPS);
const B0 = beatF(BGM_START_BEAT);

export interface ShotSpec {
  readonly id: string;
  readonly from: number;
  readonly duration: number;
  readonly title: string;
  readonly endBeat: number; // 下一镜边界（审计用）
}

// [id, 起始拍, 结束拍, 标题] —— 全部整数拍
const PLAN: readonly [string, number, number, string][] = [
  ["S01", 8, 16, "品牌字标（blur-slide 语法 + 徽章 + tagline）"],
  ["S02", 16, 27, "定场 crane-rise（时间线特写→整页）"],
  ["C01", 27, 31, "字卡 01 · 全界面中文"],
  ["S03", 31, 41, "广度瀑布墙"],
  ["S04", 41, 49, "并行会话（线程逐项 reveal）"],
  ["S05", 49, 56, "命令面板（Ctrl+K 打字过滤）"],
  ["S06", 56, 63, "变更审查（diff 行 row-embed）"],
  ["S07", 63, 72, "终端（打字+输出揭示）→ 定时任务"],
  ["C02", 72, 76, "字卡 02 · 一键切换"],
  ["S08", 76, 90, "HERO 语言切换（双态翻转蒙太奇 ×2 波）"],
  ["S09", 90, 97, "技术底座（770/100%/0 DigitRoll）"],
  ["S10", 97, 106, "收场 lockup + CTA"],
  ["S11", 106, 112, "上游致谢 + 淡出"],
];

// 尾段（安静区）稀疏重音按真实瞬态钉：渲后回测实测 42.859s / 47.693s（music-beat-sync §4）
const PINS: Record<string, number> = { S10: 1286, S11: 1431 };

export const SHOTS: readonly ShotSpec[] = PLAN.map(([id, b0, b1, title], index) => ({
  id,
  from: PINS[id] ?? beatF(b0) - B0,
  duration: (PINS[PLAN[index + 1]?.[0]] ?? beatF(b1) - B0) - (PINS[id] ?? beatF(b0) - B0),
  title,
  endBeat: b1,
}));

export const TOTAL_FRAMES = SHOTS.reduce((acc, cur) => Math.max(acc, cur.from + cur.duration), 0);

// 段内拍（供钉帧）：shot 起点拍号 + 局部拍 → 全片帧
export const beatIn = (shotId: string, localBeat: number): number => {
  const shot = SHOTS.find((x) => x.id === shotId)!;
  const startBeat = PLAN.find((p) => p[0] === shotId)![1];
  return beatF(startBeat + localBeat) - B0;
};
