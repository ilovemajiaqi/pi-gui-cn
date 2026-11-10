// S05 · 命令面板 —— Ctrl+K 浮层弹入 + 打字过滤（type-and-filter 参数真相：
// 打字 3f/字符、光标常亮→8f 周期闪烁、聚焦环、真实双态切换掩护打字）
// 素材：palette-empty（空态）与 palette（query 重构·已过滤态），输入行/结果行坐标实测。
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  Easing,
  spring,
  useVideoConfig,
} from "remotion";
import { ramp, Vignette, Grain } from "../lib/Polish";
import { alpha } from "../lib/graphics";
import { T, PAGE } from "../theme";

export const S05_DURATION = 105;

const QUERY = "重构";
const TYPE_START = 26; // 每字 3f → 32f 打完
const SWAP = 46; // 空态 → 结果态（同帧硬切 + 3f 提亮掩护）
const CLICK = 66;
const SETTLE = 96;

// 实测坐标（CSS px）
const TEXT_START = { x: 688, y: 128 }; // 输入行文本左缘
const PATCH = { x: 684, y: 134, w: 210, h: 28 }; // 占位文本遮补丁（面板输入行同色）
const RESULT_ROW = { x: 650, y: 246, w: 628, h: 44 }; // 结果行（重构建）
const CLICK_AT = { x: 700, y: 268 };

export const S05Palette: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typedCount =
    frame < TYPE_START ? 0 : Math.min(QUERY.length, Math.floor((frame - TYPE_START) / 3) + 1);
  const caretOn =
    frame >= 20 &&
    frame <= SWAP - 6 &&
    (frame <= TYPE_START + 24 || Math.floor((frame - (TYPE_START + 24)) / 8) % 2 === 0);
  const focus = interpolate(frame, [18, 24, SWAP, SWAP + 8], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pop = spring({ frame: frame - 2, fps, config: { damping: 15, stiffness: 140, mass: 0.8 } });
  const bgSink = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rippleT = interpolate(frame, [CLICK, CLICK + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: T.window, overflow: "hidden" }}>
      {/* 背景：时间线页，浮层弹出后压暗失焦 */}
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: PAGE.h,
          transform: `translateY(${(bgSink * 10).toFixed(2)}px)`,
          filter: bgSink > 0.02 ? `blur(${(bgSink * 3).toFixed(2)}px)` : undefined,
          opacity: 1 - bgSink * 0.25,
        }}
      >
        <Img
          src={staticFile("textures/zh-CN/timeline.png")}
          style={{ position: "absolute", width: 1920, height: PAGE.h }}
        />
      </div>
      <div
        style={{ position: "absolute", inset: 0, background: alpha("#000000", 0.35 * bgSink) }}
      />

      {/* 浮层页（空态 → 结果态 硬切） */}
      <div
        style={{
          position: "absolute",
          width: 1920,
          height: PAGE.h,
          transform: `translateY(${((1 - pop) * 44).toFixed(2)}px)`,
          opacity: pop,
        }}
      >
        <Img
          src={staticFile("textures/zh-CN/palette-empty.png")}
          style={{ position: "absolute", width: 1920, height: PAGE.h }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: frame >= SWAP ? 1 : 0,
            filter: frame >= SWAP && frame < SWAP + 3 ? "brightness(1.3)" : undefined,
          }}
        >
          <Img
            src={staticFile("textures/zh-CN/palette.png")}
            style={{ position: "absolute", width: 1920, height: PAGE.h }}
          />
        </div>

        {/* —— 打字覆盖层（SWAP 后全隐：真实态已带同样文本）—— */}
        {frame < SWAP ? (
          <>
            {/* 占位文本遮补丁 */}
            <div
              style={{
                position: "absolute",
                left: PATCH.x,
                top: PATCH.y,
                width: PATCH.w,
                height: PATCH.h,
                backgroundColor: T.main,
              }}
            />
            {/* typed text + caret */}
            <div
              style={{
                position: "absolute",
                left: TEXT_START.x,
                top: TEXT_START.y,
                display: "flex",
                alignItems: "center",
                fontFamily: '"Segoe UI","Microsoft YaHei",sans-serif',
                fontSize: 16,
                color: T.ink,
                pointerEvents: "none",
              }}
            >
              <span>{QUERY.slice(0, typedCount)}</span>
              {caretOn ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 1.5,
                    height: 18,
                    marginLeft: 2,
                    borderRadius: 1,
                    background: T.accent,
                  }}
                />
              ) : null}
            </div>
            {/* 输入行聚焦环 */}
            {focus > 0.01 ? (
              <div
                style={{
                  position: "absolute",
                  left: PATCH.x - 8,
                  top: PATCH.y - 5,
                  width: 596,
                  height: PATCH.h + 10,
                  borderRadius: 10,
                  border: `1px solid ${alpha(T.accent, 0.55 * focus)}`,
                  boxShadow: `0 0 0 3px ${alpha(T.accent, 0.14 * focus)}`,
                  opacity: focus,
                }}
              />
            ) : null}
          </>
        ) : null}

        {/* —— 点击：双环涟漪 + 结果行描边 —— */}
        {frame >= CLICK && frame <= CLICK + 10
          ? [0, 1].map((r) => {
              const start = CLICK + r * 3;
              if (frame < start || frame > start + 10) return null;
              const t = interpolate(frame, [start, start + 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              });
              const rad = interpolate(t, [0, 1], [12, r === 0 ? 50 : 74]);
              return (
                <div
                  key={r}
                  style={{
                    position: "absolute",
                    left: CLICK_AT.x - rad,
                    top: CLICK_AT.y - rad,
                    width: rad * 2,
                    height: rad * 2,
                    borderRadius: "50%",
                    border: `${r === 0 ? 2 : 1.5}px solid ${T.accent}`,
                    background:
                      r === 0
                        ? `radial-gradient(circle, ${alpha(T.accent, 0)} 55%, ${alpha(T.accent, 0.1)} 100%)`
                        : undefined,
                    opacity: (1 - t) * 0.9,
                    zIndex: 5,
                  }}
                />
              );
            })
          : null}
        {frame >= CLICK + 2 ? (
          <div
            style={{
              position: "absolute",
              left: RESULT_ROW.x - 6,
              top: RESULT_ROW.y - 6,
              width: RESULT_ROW.w + 12,
              height: RESULT_ROW.h + 12,
              borderRadius: 16,
              border: `2.5px solid ${alpha(T.accent, 0.95)}`,
              boxShadow: `0 0 0 4px ${alpha(T.accent, 0.11)}, 0 8px 34px -6px ${alpha(T.accent, 0.4)}`,
              opacity: interpolate(frame, [CLICK + 2, CLICK + 5], [0.55, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `scale(${interpolate(frame, [CLICK + 2, CLICK + 8], [1.02, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }).toFixed(4)})`,
              pointerEvents: "none",
              zIndex: 4,
            }}
          />
        ) : null}
      </div>

      <Vignette strength={0.22} color="#000000" inner={0.55} />
      <Grain opacity={0.045} blend="soft-light" />
    </AbsoluteFill>
  );
};
