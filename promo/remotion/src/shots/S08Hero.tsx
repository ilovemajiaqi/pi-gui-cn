// S08 · HERO 语言切换 —— 本片峰值：设置页真实双态 + thumb 微交互语法
// （segmented-thumb-hero：光标 24f 画外滑入、press 压缩 3f、8f ease-out 位移、
// 1.5% 过冲回弹、涟漪强调色细环）+ 全界面同帧翻转蒙太奇 ×3 波（真实 en/zh 双态）。
// 波次：① 时间线同帧翻转（全屏 slam②）→ ② 设置语言行翻转 → ③ 通知/设置字卡交代跨进程。
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing, spring, useVideoConfig } from "remotion";
import { alpha } from "../lib/graphics";
import { Vignette, Grain } from "../lib/Polish";
import { T, PAGE } from "../theme";

export const S08_DURATION = 203;

// 波次时间轴（local）
// 0–40    设置语言行特写（光标滑入 → 点击 → row 翻转即 settings en→zh 同帧切换）
// 40–52   白闪 slam（全片 slam②）
// 52–118  波①：时间线页 en → zh 同帧翻转（先 en 20f → 翻转 → zh hold）
// 118–170 波②：设置外观页 en → zh 翻转（行选中块过冲 1.5%）
// 170–210 波③：跨进程交代：mono 字卡行（原生通知/菜单跟随）+ 收束帧（zh 设置语言行 hold）
const FLIP_1 = 87;
const FLIP_2 = 145;
const ARROW_IN = 10;
const CLICK = 44;

// 页面空间坐标（settings-appearance 纹理内）：语言行（Layout 下拉行，实测 preview）
const LANG_ROW = { x: 697, y: 182, w: 753, h: 70 }; // 语言卡片行（en 纹理实测）
const SWITCH_AT = { x: 1372, y: 210 }; // 语言控件「Follow system / 简体中文」中心

export const S08Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 光标（画外滑入 → 按下）
  const curT = interpolate(frame, [ARROW_IN, ARROW_IN + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const curX = interpolate(curT, [0, 1], [2020, SWITCH_AT.x - 40]);
  const curY = interpolate(curT, [0, 1], [1160, SWITCH_AT.y + 4]);
  const press = interpolate(frame, [CLICK, CLICK + 3, CLICK + 7], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pointerScale = 1.1 * (1 - press * 0.12);

  // 白闪（slam②：全片唯一全画面拍击）
  const flash = frame >= FLIP_1 - 2 && frame < FLIP_1 + 6;
  const flashO = flash ? interpolate(frame, [FLIP_1 - 2, FLIP_1, FLIP_1 + 6], [0, 0.9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;

  // 语言行选中块过冲 1.5%（点击后）
  const rowPop = spring({ frame: frame - (CLICK + 2), fps, config: { damping: 12, stiffness: 200 } });
  const rowScale = frame >= CLICK + 2 ? 0.985 + 0.015 * rowPop : 1;

  // 波①时间线 en→zh；波②设置 en→zh
  const wave1T = frame >= FLIP_1;
  const wave2T = frame >= FLIP_2;

  return (
    <AbsoluteFill style={{ backgroundColor: T.window, overflow: "hidden" }}>
      {/* —— 段 A（0–52）：设置语言行特写（PageCam zoom 2.6 on LANG_ROW）—— */}
      <div style={{ position: "absolute", inset: 0, opacity: frame < FLIP_1 - 6 ? 1 : interpolate(frame, [FLIP_1 - 6, FLIP_1 - 2], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ position: "absolute", inset: 0, perspective: 1400, perspectiveOrigin: "960px 540px" }}>
          <div
            style={{
              position: "absolute",
              width: 1920,
              height: PAGE.h,
              zoom: 1.9,
              transform: `translate(${960 / 1.9 - (LANG_ROW.x + LANG_ROW.w / 2)}px, ${540 / 1.9 - (LANG_ROW.y + LANG_ROW.h / 2)}px)`,
              transformOrigin: `${LANG_ROW.x + LANG_ROW.w / 2}px ${LANG_ROW.y + LANG_ROW.h / 2}px`,
            }}
          >
            <Img src={staticFile("textures/en/settings-appearance.png")} style={{ position: "absolute", width: 1920, height: PAGE.h }} />
            {/* row 选中块（点击后高亮 + 过冲） */}
            {frame >= CLICK + 2 ? (
              <div
                style={{
                  position: "absolute",
                  left: LANG_ROW.x - 6,
                  top: LANG_ROW.y - 4,
                  width: LANG_ROW.w + 12,
                  height: LANG_ROW.h + 8,
                  borderRadius: 12,
                  border: `1.5px solid ${alpha(T.accent, 0.75)}`,
                  boxShadow: `0 0 0 3px ${alpha(T.accent, 0.1)}, 0 8px 28px -10px ${alpha(T.accent, 0.28)}`,
                  transform: `scale(${rowScale.toFixed(4)})`,
                  opacity: rowPop > 0 ? 1 : 0,
                }}
              />
            ) : null}
            {/* 涟漪 */}
            {frame >= CLICK && frame <= CLICK + 10
              ? (() => {
                  const t = interpolate(frame, [CLICK, CLICK + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
                  const rad = interpolate(t, [0, 1], [16, 64]);
                  return (
                    <div
                      style={{
                        position: "absolute",
                        left: SWITCH_AT.x - rad,
                        top: SWITCH_AT.y - rad,
                        width: rad * 2,
                        height: rad * 2,
                        borderRadius: "50%",
                        border: "2.5px solid " + T.accent,
                        background: `radial-gradient(circle, ${alpha(T.accent, 0)} 52%, ${alpha(T.accent, 0.12)} 100%)`,
                        opacity: (1 - t) * 0.9,
                        zIndex: 5,
                      }}
                    />
                  );
                })()
              : null}
            {/* 光标 */}
            <svg
              width={30}
              height={34}
              viewBox="0 0 26 30"
              style={{
                position: "absolute",
                left: curX,
                top: curY,
                zIndex: 6,
                opacity: curT > 0.02 && frame < FLIP_1 - 30 ? 1 : 0,
                transform: `scale(${pointerScale})`,
                transformOrigin: "12% 8%",
                filter: `drop-shadow(0 ${2 - press}px ${3 - press}px rgba(0,0,0,0.4)) drop-shadow(0 ${10 - press * 5}px ${16 - press * 5}px rgba(0,0,0,0.35))`,
              }}
            >
              <path d="M4 2 L4 24 L9.5 18.5 L13 27 L16.8 25.4 L13.3 17 L21 17 Z" fill="#efece4" stroke="#151514" strokeWidth={1.4} strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* —— 波①（52–118）：时间线同帧翻转 en → zh —— */}
      {/*
        en 前态 → 翻转帧（FLIP_1+2）→ zh。翻转 = 硬切（同帧）+ 2f 提亮（slam 与白闪配合）。
      */}
      <div style={{ position: "absolute", inset: 0, opacity: frame >= FLIP_1 - 6 && frame < FLIP_2 ? 1 : 0 }}>
        <div style={{ position: "absolute", inset: 0 }}>
          <Img src={staticFile("textures/en/timeline.png")} style={{ position: "absolute", width: 1920, height: PAGE.h, opacity: frame < FLIP_1 + 2 ? 1 : 0 }} />
          <div style={{ position: "absolute", inset: 0, opacity: frame >= FLIP_1 + 2 ? 1 : 0, filter: frame < FLIP_1 + 6 ? "brightness(1.35)" : undefined }}>
            <Img src={staticFile("textures/zh-CN/timeline.png")} style={{ position: "absolute", width: 1920, height: PAGE.h }} />
          </div>
        </div>
      </div>

      {/* —— 波②（170–210）：设置 en → zh —— */}
      <div style={{ position: "absolute", inset: 0, opacity: frame >= FLIP_2 ? 1 : 0 }}>
        <Img src={staticFile("textures/en/settings-appearance.png")} style={{ position: "absolute", width: 1920, height: PAGE.h, opacity: frame < FLIP_2 + 2 ? 1 : 0 }} />
        <div style={{ position: "absolute", inset: 0, opacity: frame >= FLIP_2 + 2 ? 1 : 0, filter: frame < FLIP_2 + 6 ? "brightness(1.3)" : undefined }}>
          <Img src={staticFile("textures/zh-CN/settings-appearance.png")} style={{ position: "absolute", width: 1920, height: PAGE.h }} />
        </div>
        {/* 底部交代行（跨进程一致）+ 收束 caption */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 108,
            display: "flex",
            justifyContent: "center",
            opacity: interpolate(frame, [FLIP_2 + 16, FLIP_2 + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <div
            style={{
              fontFamily: '"Cascadia Code","Consolas",monospace',
              fontSize: 34,
              letterSpacing: "0.18em",
              color: T.muted,
              padding: "14px 30px",
              borderRadius: 999,
              background: alpha(T.elevated, 0.8),
              boxShadow: T.hairline,
            }}
          >
            原生菜单 · 系统通知 · 多窗口 —— 同步跟随
          </div>
        </div>
      </div>

      {/* 白闪 */}
      <AbsoluteFill style={{ background: "#f5f4f0", opacity: flashO, pointerEvents: "none" }} />
      <Vignette strength={0.22} color="#000000" inner={0.55} />
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};
