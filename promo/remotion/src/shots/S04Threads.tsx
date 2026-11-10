// S04 · 并行会话 —— PageCam 推近侧栏线程列表 + 线程卡片逐项 reveal（list-reveal 参数真相：
// 每项 24f、错峰 10f、scale 0.82→1、blur 8→0、软 back ~1.5% 过冲；容器匀速漂移 96px）
// 世界 = 真实 timeline 纹理；线程行位置来自 layout.json（sidebar）。
import React from "react";
import { AbsoluteFill, useCurrentFrame, Easing, spring, useVideoConfig } from "remotion";
import { Img, staticFile } from "remotion";
import { bezier, mix, ramp, Vignette, Grain } from "../lib/Polish";
import { T, PAGE } from "../theme";
import { alpha } from "../lib/graphics";

export const S04_DURATION = 116;

const softBack = bezier(0.3, 1.18, 0.5, 1); // 软过冲 ~1.5%（demo 同款）

// 真实线程行（CSS 坐标；sidebar (0,0,236,1082)，四条线程在 y 400..640 区间，来自截图实测）
const THREADS = [
  { x: 6, y: 356, w: 214, h: 53 }, // 重构导出模块（当前）
  { x: 6, y: 407, w: 214, h: 53 }, // 整理每日清单模板
  { x: 6, y: 458, w: 214, h: 53 }, // 撰写 1.2.0 发版说明
  { x: 6, y: 509, w: 214, h: 53 }, // 修复深色模式闪烁
];

// 相机：0–36f 从默认视图推近侧栏线程区；36f 后 hold + 呼吸
const START = { cx: 144, cy: 240, zoom: 1.35 };
const END = { cx: 118, cy: 430, zoom: 1.9 };
const CAM_EASE = bezier(0.33, 0, 0.15, 1);
const camAt = (frame: number) => {
  const e = CAM_EASE(ramp(frame, 2, 34, (t) => t));
  const breath = 1 + 0.006 * ramp(frame, 70, 50, (t) => t);
  return {
    zoom: mix(START.zoom, END.zoom, e) * breath,
    cx: mix(START.cx, END.cx, e),
    cy: mix(START.cy, END.cy, e),
  };
};

// 逐项入场；容器整体漂移（两层不相干运动）
const DRIFT = 46; // 向上漂移总量

export const S04Threads: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { zoom, cx, cy } = camAt(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: T.window, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1200,
          perspectiveOrigin: "960px 540px",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 1920,
            height: PAGE.h,
            zoom,
            transform: `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px)`,
            transformOrigin: `${cx}px ${cy}px`,
            filter: "none",
          }}
        >
          <Img
            src={staticFile("textures/zh-CN/timeline.png")}
            style={{ position: "absolute", width: 1920, height: PAGE.h }}
          />
          {/* 线程行 reveal：真实截图上覆高亮片（内容已在页内，显形而非移位） */}
          {THREADS.map((r, i) => {
            const t0 = 12 + i * 10;
            const lin = ramp(frame, t0, 24, (t) => t);
            const p = softBack(lin);
            const blur = (1 - Easing.out(Easing.cubic)(lin)) * 8;
            const active = i === 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: r.x - 4,
                  top: r.y,
                  width: r.w + 8,
                  height: r.h,
                  borderRadius: 10,
                  opacity: Math.min(1, lin * 2.2),
                  filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined,
                  transform: `scale(${(0.965 + 0.035 * p).toFixed(4)})`,
                  transformOrigin: "22% 50%",
                  boxShadow: active
                    ? `inset 0 0 0 1px ${alpha(T.accent, 0.34)}, 0 6px 22px -10px ${alpha(T.accent, 0.4)}`
                    : `inset 0 0 0 1px ${alpha(T.ink, 0.09)}`,
                  background: active
                    ? `linear-gradient(90deg, ${alpha(T.accent, 0.14)}, ${alpha(T.accent, 0.04)})`
                    : `linear-gradient(90deg, ${alpha(T.ink, 0.03)}, ${alpha(T.ink, 0.01)})`,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 右侧标题：列表铺到一半才进（demo 节奏 46–80） */}
      <div style={{ position: "absolute", left: 1236, top: 236, width: 660 }}>
        {(() => {
          const kickP = Easing.out(Easing.cubic)(Math.min(1, Math.max(0, (frame - 46) / 16)));
          const line1P = Easing.out(Easing.cubic)(Math.min(1, Math.max(0, (frame - 52) / 20)));
          const subP = Easing.out(Easing.cubic)(Math.min(1, Math.max(0, (frame - 64) / 18)));
          return (
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontFamily: FONT_MONO,
                  fontSize: 20,
                  letterSpacing: "0.3em",
                  color: T.accent,
                  opacity: kickP,
                }}
              >
                PARALLEL THREADS
              </div>
              <div
                style={{
                  marginTop: 26,
                  fontFamily: FONT_SANS,
                  fontSize: 76,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  color: T.ink,
                  opacity: line1P,
                  transform: `translateY(${((1 - line1P) * 18).toFixed(2)}px)`,
                }}
              >
                多线程同时推进
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: FONT_SANS,
                  fontSize: 34,
                  color: T.muted,
                  opacity: subP,
                  transform: `translateY(${((1 - subP) * 12).toFixed(2)}px)`,
                }}
              >
                每个会话一个 git 工作树，
                <br />
                互不踩脚，随时切换。
              </div>
            </div>
          );
        })()}
      </div>
      <Vignette strength={0.24} color="#000000" inner={0.55} />
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};

const FONT_MONO = '"Cascadia Code","Consolas",ui-monospace,monospace';
const FONT_SANS = '"Segoe UI","Microsoft YaHei",sans-serif';
