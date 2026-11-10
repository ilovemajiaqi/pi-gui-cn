// SFX 中央钉帧表 —— 唯一事实源（sound-design §5）
// from 用 beatIn（拍号锚定）；每条注释动作；素材按"素材内能量峰"对齐（不按文件头）。
// 测量来自 public/audio/sfx/audio-manifest.json（CC0，见 FREESOUND-CREDITS.md）。
import { beatIn } from "./SHOTS";

export interface SfxCue {
  readonly from: number; // 全片帧
  readonly src: string; // staticFile 路径
  readonly volume: number;
  readonly startFrom?: number; // 文件内起始秒（默认 0）
  readonly note: string;
}

export const WAVE = "audio/sfx/fs-179780.mp3"; // wipe 1.51s 峰@0.455 起始活动 0.06
export const SWOOSH_D = "audio/sfx/fs-786514.mp3"; // 下降短 swoosh 0.3s 峰@0.185
export const SWOOSH_AIR = "audio/sfx/fs-427823.mp3"; // Whoosh#1 0.8s 峰@0.215
export const IMPACT_A = "audio/sfx/fs-812750.mp3"; // impact 084 峰@0.175
export const IMPACT_B = "audio/sfx/fs-645898.mp3"; // impact 027 峰@0.135
export const POP = "audio/sfx/fs-220208.mp3"; // click pop 双段 峰@0.005
export const KEY = "audio/sfx/fs-570754.mp3"; // 键盘 press 峰@0.105

// 大 wipe 的上升段要给运镜：cue 起点提前 13f（0.395s），峰值正好落目标拍
const wipeLead = 13;
export const SFX_CUES: readonly SfxCue[] = [
  // S01 · 徽章弹入
  { from: beatIn("S01", 3), src: POP, volume: 0.5, note: "徽章 landPop 落定" },
  // S02 · crane 拉升（whoosh 上升段起拍 1）+ 定场 impact（slam①，beat 7+）
  { from: beatIn("S02", 1), src: SWOOSH_AIR, volume: 0.6, note: "拉升运镜上升气流" },
  {
    from: beatIn("S02", 7) + 1,
    src: IMPACT_A,
    volume: 0.7,
    startFrom: 0.175,
    note: "整页落定 slam①",
  },
  // C01 · 字卡进入
  { from: beatIn("C01", 0) - 4, src: SWOOSH_D, volume: 0.45, note: "字卡轻扫入" },
  // S03 · 换章 whip-pan
  { from: beatIn("S03", 0), src: SWOOSH_D, volume: 0.7, note: "瀑布墙切入" },
  // S04 · 线程逐项 reveal（音量递减、贴动画间隔）
  { from: beatIn("S04", 0) + 12, src: POP, volume: 0.34, note: "线程行1" },
  { from: beatIn("S04", 0) + 22, src: POP, volume: 0.3, note: "线程行2" },
  { from: beatIn("S04", 0) + 31, src: POP, volume: 0.26, note: "线程行3" },
  { from: beatIn("S04", 0) + 39, src: POP, volume: 0.24, note: "线程行4" },
  // S05 · 面板弹出 / 打字 / 过滤切换 / 点击
  { from: beatIn("S05", 0) + 2, src: POP, volume: 0.5, note: "Ctrl+K 面板弹入" },
  { from: beatIn("S05", 0) + 26, src: KEY, volume: 0.55, startFrom: 0.1, note: "打字·重" },
  { from: beatIn("S05", 0) + 29, src: KEY, volume: 0.45, startFrom: 0.1, note: "打字·轻" },
  { from: beatIn("S05", 3), src: SWOOSH_D, volume: 0.5, note: "过滤态切换" },
  { from: beatIn("S05", 4), src: POP, volume: 0.6, note: "点击选择 + 涟漪" },
  // S06 · diff 行逐块嵌入
  { from: beatIn("S06", 0) + 24, src: POP, volume: 0.35, note: "行1 嵌入" },
  { from: beatIn("S06", 0) + 34, src: SWOOSH_D, volume: 0.5, note: "行2 归位" },
  { from: beatIn("S06", 0) + 43, src: POP, volume: 0.3, note: "行3 嵌入" },
  {
    from: beatIn("S06", 0) + 51,
    src: IMPACT_B,
    volume: 0.45,
    startFrom: 0.135,
    note: "diff 主块落位",
  },
  // S07 · 终端打字（1f/字符，3 声随打字窗）/ 输出揭示 / 换站 / 创建按钮光环
  { from: beatIn("S07", 0) + 10, src: KEY, volume: 0.4, startFrom: 0.1, note: "终端打字1" },
  { from: beatIn("S07", 0) + 18, src: KEY, volume: 0.34, startFrom: 0.1, note: "终端打字2" },
  { from: beatIn("S07", 0) + 26, src: KEY, volume: 0.38, startFrom: 0.1, note: "终端打字3" },
  { from: beatIn("S07", 0) + 46, src: POP, volume: 0.35, note: "输出行1 揭示" },
  { from: beatIn("S07", 0) + 50, src: POP, volume: 0.3, note: "输出行2 揭示" },
  { from: beatIn("S07", 0) + 62, src: SWOOSH_D, volume: 0.5, note: "换站飞行" },
  { from: beatIn("S07", 0) + 96, src: SWOOSH_AIR, volume: 0.5, note: "创建按钮光环亮起" },
  // S08 · HERO：光标滑入 / 点击 / slam② 白闪 / 波②换页 / 交代行
  { from: beatIn("S08", 0) + 20, src: SWOOSH_AIR, volume: 0.6, note: "光标滑入" },
  { from: beatIn("S08", 1.5), src: POP, volume: 0.55, note: "点击语言行" },
  {
    from: beatIn("S08", 3),
    src: IMPACT_A,
    volume: 0.8,
    startFrom: 0.175,
    note: "波①全界面翻转 slam②",
  },
  { from: beatIn("S08", 10) - 11, src: WAVE, volume: 0.7, note: "波②设置页翻转（wipe 峰拍对齐）" },
  { from: beatIn("S08", 12), src: POP, volume: 0.4, note: "跨进程交代行落定" },
  // S09 · 数字滚轮三连 + 分隔线
  { from: beatIn("S09", 1), src: POP, volume: 0.5, note: "770 滚轮" },
  { from: beatIn("S09", 3), src: POP, volume: 0.55, note: "100% 滚轮" },
  { from: beatIn("S09", 4), src: POP, volume: 0.5, note: "0 滚轮" },
  { from: beatIn("S09", 5), src: SWOOSH_D, volume: 0.5, note: "分隔线扫出" },
  // S10 · 字标浮入 / CTA
  { from: beatIn("S10", 0) + 8, src: SWOOSH_AIR, volume: 0.5, note: "字标浮入" },
  { from: beatIn("S10", 1), src: POP, volume: 0.55, note: "tagline 收" },
  { from: beatIn("S10", 2), src: POP, volume: 0.6, note: "CTA pill 落定" },
];
