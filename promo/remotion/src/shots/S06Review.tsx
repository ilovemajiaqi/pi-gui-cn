// S06 · 变更审查 —— diff 行 row-embed 逐行嵌入（row-embed 参数真相：
// cue 12/22/31/39/46 递减间隔、飞行 12f、bezier(0.5,0,0.8,0.75) 加速砸入、
// rotateX 16° 收平、scale 略过冲、落位 press 回弹、底边强调色缝中心展开、
// 槽位接触影近实远虚、相机缓慢下摇）。
// 世界 = 真实 review-diff 纹理；行 = diff 面板的 5 个待落位块（坐标按新采集实测，见 DIFF_ROWS）。
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing } from "remotion";
import { alpha } from "../lib/graphics";
import { Vignette, Grain } from "../lib/Polish";
import { T, PAGE } from "../theme";

export const S06_DURATION = 101;

// 相机：整个审查工作树面板（page 空间坐标），起 cy 500 → 落 760/zoom 微推（demo 同型）
const KEY = [
  { frame: 0, cx: 1560, cy: 300, zoom: 2.0 },
  { frame: S06_DURATION, cx: 1310, cy: 520, zoom: 1.5 },
];
const CAM_EASE = Easing.bezier(0.33, 0, 0.15, 1);
const camAt = (frame: number) => {
  let a = KEY[0];
  let b = KEY[KEY.length - 1];
  const t = interpolate(frame, [a.frame, b.frame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: CAM_EASE,
  });
  return {
    zoom: a.zoom + (b.zoom - a.zoom) * t,
    cx: a.cx + (b.cx - a.cx) * t,
    cy: a.cy + (b.cy - a.cy) * t,
  };
};

// src/export.ts 的 diff 块（review-diff 纹理内的面板空间坐标，采集后按 layout 校准；
// 5 块 = 未提交头 + 筛选输入 + export.ts 行 + diff +5/−13 行组 ×3）
const DIFF_ROWS = [
  { x: 1491, y: 56, w: 430, h: 40 }, // 未提交 +11 −13 头
  { x: 1491, y: 112, w: 430, h: 36 }, // src/export.ts +3 −5 行
  { x: 1741, y: 112, w: 180, h: 34 }, // 筛选文件 输入列
  { x: 1491, y: 160, w: 245, h: 250 }, // diff 行块（+绿 −红）
];
const CUES = [12, 22, 31, 39];

const FLY = 12;
const FLY_EASE = Easing.bezier(0.5, 0, 0.8, 0.75);
const SRC = "textures/zh-CN/review-diff.png";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const PAGE_BG = "#222221"; // 采样自 review 面板真实底色

const airOf = (frame: number, cue: number) =>
  1 - interpolate(frame, [cue, cue + FLY], [0, 1], { ...clamp, easing: FLY_EASE });

export const S06Review: React.FC = () => {
  const frame = useCurrentFrame();
  const { zoom, cx, cy } = camAt(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: T.window, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1400 * zoom,
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
          }}
        >
          <Img
            src={staticFile(SRC)}
            style={{ position: "absolute", width: 1920, height: PAGE.h }}
          />
          {DIFF_ROWS.map((r, i) => {
            const cue = CUES[i];
            const land = cue + FLY;
            const patchOpacity = interpolate(frame, [land, land + 2], [1, 0], clamp);
            const slotHint = interpolate(frame, [cue - 6, cue + 4], [0.55, 1], clamp);
            let flyer: React.ReactNode = null;
            let contact: React.ReactNode = null;
            if (frame >= cue && frame < land + 4) {
              const air = airOf(frame, cue);
              const p = 1 - air;
              const appear = interpolate(frame, [cue, cue + 3], [0, 1], clamp);
              const scale =
                frame < land
                  ? 1.06 - 0.065 * p
                  : interpolate(frame, [land, land + 4], [0.995, 1], {
                      ...clamp,
                      easing: Easing.out(Easing.quad),
                    });
              const vy = 120 * (airOf(frame - 0.5, cue) - airOf(frame + 0.5, cue));
              const mb = frame < land ? Math.min(3.2, vy * 0.22) : 0;
              flyer = (
                <div
                  key={`row-${i}`}
                  style={{
                    position: "absolute",
                    left: r.x,
                    top: r.y,
                    width: r.w,
                    height: r.h,
                    opacity: appear,
                    zIndex: 3,
                    pointerEvents: "none",
                    transform: `perspective(900px) translateY(${(-90 * air).toFixed(2)}px) rotateX(${(14 * air).toFixed(3)}deg) scale(${scale.toFixed(4)})`,
                    filter: mb > 0.25 ? `blur(0 ${mb.toFixed(2)}px)` : undefined,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 6,
                      overflow: "hidden",
                      backgroundColor: T.elevated,
                      backgroundImage: `url(${staticFile(SRC)})`,
                      backgroundSize: `1920px ${PAGE.h}px`,
                      backgroundPosition: `-${r.x}px -${r.y}px`,
                      boxShadow:
                        `inset 0 1px 0 ${alpha("#ffffff", 0.08 * air)}, ` +
                        `0 0 0 1px ${alpha("#000000", 0.28 * air)}, ` +
                        `0 ${(30 * air).toFixed(1)}px ${(56 * air).toFixed(1)}px -${(10 * air).toFixed(1)}px rgba(0,0,0,${(0.4 * air).toFixed(3)}), ` +
                        `0 ${(5 * air).toFixed(1)}px ${(12 * air).toFixed(1)}px rgba(0,0,0,${(0.16 * air).toFixed(3)})`,
                    }}
                  />
                </div>
              );
              const near = interpolate(air, [0, 0.5], [1, 0], clamp);
              const contactOp =
                frame < land ? near * 0.5 : interpolate(frame, [land, land + 3], [0.5, 0], clamp);
              contact = (
                <div
                  key={`contact-${i}`}
                  style={{
                    position: "absolute",
                    left: r.x + 8,
                    top: r.y + 5,
                    width: r.w - 16,
                    height: r.h - 5,
                    borderRadius: 8,
                    boxShadow: `0 ${(2 + 5 * air).toFixed(1)}px ${(6 + 15 * air).toFixed(1)}px rgba(0,0,0,${(0.3 * contactOp).toFixed(3)})`,
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
              );
            }
            let seam: React.ReactNode = null;
            if (frame >= land && frame < land + 8) {
              const spread = interpolate(frame, [land, land + 5], [0, 1], {
                ...clamp,
                easing: Easing.out(Easing.cubic),
              });
              const seamOpacity = interpolate(frame, [land, land + 2, land + 8], [1, 1, 0], clamp);
              const seamW = r.w * spread;
              seam = (
                <div
                  key={`seam-${i}`}
                  style={{
                    position: "absolute",
                    left: r.x + (r.w - seamW) / 2,
                    top: r.y + r.h - 2,
                    width: seamW,
                    height: 2,
                    borderRadius: 1,
                    background: `linear-gradient(90deg, ${alpha(T.accent, 0)} 0%, ${alpha(T.accent, 0.95)} 18%, ${alpha(T.accent, 1)} 50%, ${alpha(T.accent, 0.95)} 82%, ${alpha(T.accent, 0)} 100%)`,
                    boxShadow: `0 0 7px ${alpha(T.accent, 0.4)}`,
                    opacity: seamOpacity,
                    zIndex: 4,
                    pointerEvents: "none",
                  }}
                />
              );
            }
            return (
              <React.Fragment key={i}>
                {patchOpacity > 0 ? (
                  <div
                    key={`patch-${i}`}
                    style={{
                      position: "absolute",
                      left: r.x - 6,
                      top: r.y - 3,
                      width: r.w + 20,
                      height: r.h + 6,
                      background: PAGE_BG,
                      opacity: patchOpacity,
                      zIndex: 1,
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 6,
                        top: 8,
                        width: r.w,
                        height: r.h - 12,
                        borderRadius: 6,
                        border: `1px dashed ${alpha("#eeeeea", 0.14)}`,
                        boxSizing: "border-box",
                        opacity: slotHint,
                        background: alpha("#eeeeea", 0.015),
                      }}
                    />
                  </div>
                ) : null}
                {contact}
                {flyer}
                {seam}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <Vignette strength={0.18} color="#000000" inner={0.6} />
      <Grain opacity={0.04} blend="soft-light" />
    </AbsoluteFill>
  );
};
