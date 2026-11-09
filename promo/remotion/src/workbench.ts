// src/workbench.ts —— 动效工作台拆解清单（结构兼容 workbench/src/cards/manifest.ts）
// 同源原则：from/duration 全部从 src/SHOTS.ts 与 src/SFX.ts import，不手抄第二份。
import React from "react";
import { SHOTS, TOTAL_FRAMES } from "./SHOTS";
import { SFX_CUES } from "./SFX";
import { Promo } from "./promo";
import { S01Brand } from "./shots/S01Brand";
import { S02Crane } from "./shots/S02Crane";
import { S03Wall } from "./shots/S03Wall";
import { C01Card, C02Card } from "./shots/CTitle";
import { S04Threads } from "./shots/S04Threads";
import { S05Palette } from "./shots/S05Palette";
import { S06Review } from "./shots/S06Review";
import { S07Terminal } from "./shots/S07Terminal";
import { S08Hero } from "./shots/S08Hero";
import { S09Foundation, S10Lockup, S11Outro } from "./shots/S09S10S11";

export const WORKBENCH = {
  name: "pi-gui-zh promo",
  fps: 30,
  width: 1920,
  height: 1080,
  total: TOTAL_FRAMES,
  background: "#151514",
  shots: SHOTS.map((shot) => {
    const map: Record<string, { component: React.FC; label: string }> = {
      S01: { component: S01Brand, label: "S1 品牌字标" },
      S02: { component: S02Crane, label: "S2 定场·整页拉升" },
      C01: { component: C01Card, label: "字卡① 全界面中文" },
      S03: { component: S03Wall, label: "S3 界面瀑布墙" },
      S04: { component: S04Threads, label: "S4 并行会话" },
      S05: { component: S05Palette, label: "S5 命令面板" },
      S06: { component: S06Review, label: "S6 变更审查" },
      S07: { component: S07Terminal, label: "S7 终端·定时任务" },
      C02: { component: C02Card, label: "字卡② 一键切换" },
      S08: { component: S08Hero, label: "S8 HERO 语言切换" },
      S09: { component: S09Foundation, label: "S9 技术底座" },
      S10: { component: S10Lockup, label: "S10 收场 Lockup" },
      S11: { component: S11Outro, label: "S11 致谢淡出" },
    };
    return {
      id: shot.id,
      label: map[shot.id].label,
      from: shot.from,
      duration: shot.duration,
      component: map[shot.id].component,
    };
  }),
  transitions: [],
  captions: [],
  overlays: [],
  sfx: SFX_CUES.map((cue) => ({
    from: Math.max(0, cue.from),
    duration: 90,
    src: cue.src,
    volume: cue.volume,
  })),
  bgm: [
    {
      from: 0,
      duration: TOTAL_FRAMES,
      src: "audio/bgm/bgm-cut.mp3",
      volume: 0.72,
    },
  ],
  order: ["transitions", "captions", "overlays"],
  original: Promo,
};
