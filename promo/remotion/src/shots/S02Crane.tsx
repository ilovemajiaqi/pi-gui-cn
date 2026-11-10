// S02 · 定场 crane-rise —— 相机从输入框特写拉升到整页中文界面（真实纹理）
// 参数真相：demos/opening/crane-rise-reveal（HOLD 24 / 拉升 102f / bezier(0.2,0,0.25,1) /
// 快段 CameraMotionBlur / 越线洗光 / 尾段缓推）。世界 = 真实 zh-CN new-thread 截图。
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { EASE, ramp, mix, bezier, Vignette, Grain } from "../lib/Polish";
import { PAGE, T } from "../theme";
import { alpha } from "../lib/graphics";

export const S02_DURATION = 160;

const HOLD = 24;
const MOVE_END = 102;
const BLUR_END = 64; // 速度降到峰值 ~35% 以下即撤运动模糊
const crane = bezier(0.2, 0, 0.25, 1);

// ───────── 相机（终帧 = 世界 1:1）─────────
const S0 = 2.4;
const BREATH = 0.015;
// 特写对准点：composer 输入框（new-thread 布局，CSS 坐标来自 layout.json 与 preview 实测）
const F0X = 1078; // 时间线头部：用户气泡 + 工具行（信息最密的一格）
const F0Y = 260;
const F1 = { x: 960, y: 541 };
const camAt = (frame: number) => {
  const breath = ramp(frame, 0, HOLD, EASE.smooth);
  const e = crane(Math.min(1, Math.max(0, (frame - HOLD) / (MOVE_END - HOLD))));
  const s0 = S0 * (1 + BREATH * breath);
  const s = mix(s0, 1, e);
  const fx = mix(F0X, F1.x, e);
  const fy = mix(F0Y, F1.y, e);
  return { s, tx: 960 - fx * s, ty: 540 - fy * s };
};
// 尾段极缓推近 ~2%（对齐 demo 判例：落定后 1.5–2%）
const tailPush = (frame: number) => {
  const base = camAt(frame);
  const pushT = ramp(frame, MOVE_END, S02_DURATION - MOVE_END, EASE.smooth);
  return { ...base, s: base.s * (1 + 0.02 * pushT) };
};

// ───────── 越线洗光（真实 UI 区块）─────────
const BLOCKS = [
  { name: "topbar", x: 236, y: 0, w: 1684, h: 48 },
  { name: "sidebar-head", x: 0, y: 48, w: 236, h: 200 },
  { name: "threads", x: 0, y: 248, w: 236, h: 260 },
  { name: "transcript", x: 620, y: 60, w: 940, h: 470 },
  { name: "bubble", x: 694, y: 96, w: 768, h: 150 },
];
const VIS_TOP = (frame: number) => {
  const { s, ty } = camAt(frame);
  return -ty / s;
};
const trigOf = (blockTop: number) => {
  for (let f = HOLD; f <= MOVE_END; f++) {
    if (VIS_TOP(f) <= blockTop + 2) return f;
  }
  return MOVE_END;
};
const TRIGS = BLOCKS.map((b) => ({ ...b, trig: trigOf(b.y) }));

const Page: React.FC = () => {
  const frame = useCurrentFrame();
  const { s, tx, ty } = tailPush(frame);
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: T.window }}>
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: PAGE.h,
          transformOrigin: "0 0",
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`,
        }}
      >
        <Img
          src={staticFile("textures/zh-CN/new-thread.png")}
          style={{ position: "absolute", width: 1920, height: PAGE.h }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const S02Crane: React.FC = () => {
  const frame = useCurrentFrame();
  const fast = frame > HOLD + 1 && frame < BLUR_END;
  const vig = 1 - ramp(frame, HOLD, 70, EASE.swift);
  return (
    <AbsoluteFill style={{ background: T.window, overflow: "hidden" }}>
      {fast ? (
        <CameraMotionBlur shutterAngle={150} samples={10}>
          <Page />
        </CameraMotionBlur>
      ) : (
        <Page />
      )}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: vig,
          background: `radial-gradient(ellipse 70% 66% at 50% 76%, ${alpha("#000000", 0)} 52%, ${alpha("#000000", 0.28)} 100%)`,
        }}
      />
      <Grain opacity={0.04} blend="soft-light" />
    </AbsoluteFill>
  );
};
