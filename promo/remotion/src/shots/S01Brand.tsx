// S01 · 品牌字标 —— blur-slide 语法（三通道同缓动）+ 徽章 landPop + 尾段极缓推近
// 参数真相：demos/typography/blur-slide（dy/blur/gap/hold）+ SF1 版式
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { EASE, ramp, mix, bezier, Vignette, Grain } from "../lib/Polish";
import { Words, Kicker, alpha } from "../lib/graphics";
import { FONT, T } from "../theme";

export const S01_DURATION = 116;

const HOLD_SETTLE = 46; // 字标+徽章落定帧
// 落地弹（spec 动效 token：cubic-bezier(0.34, 1.3, 0.64, 1)，过冲 ≤1.04）
const landPop = bezier(0.34, 1.3, 0.64, 1);

export const S01Brand: React.FC = () => {
  const frame = useCurrentFrame();
  const push = 1 + 0.03 * ramp(frame, 60, S01_DURATION - 60, EASE.smooth);

  const badgeT = ramp(frame, HOLD_SETTLE - 22, 22, EASE.out);
  const badgeScale = mix(0.9, 1, landPop(badgeT));
  const lightH = ramp(frame, 58, 18, EASE.snappy);
  const taglineWords: { text: string; start: number; dur: number }[] = [
    { text: "你的编码代理，", start: 64, dur: 20 },
    { text: "今天开始", start: 67, dur: 20 },
    { text: "说中文", start: 70, dur: 24 },
    { text: "。", start: 74, dur: 18 },
  ];

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: `radial-gradient(1200px 800px at 50% 38%, ${T.windowCenter} 0%, ${T.window} 68%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 62% 70% at 50% 20%, ${alpha(T.accent, 0.07)} 0%, ${alpha(T.accent, 0)} 70%), radial-gradient(ellipse 62% 70% at 50% 40%, ${alpha("#ffffff", 0.045)} 0%, ${alpha("#ffffff", 0)} 72%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${push.toFixed(4)})`,
          transformOrigin: "50% 46%",
        }}
      >
        <Kicker
          text="pi coding agent · desktop client"
          start={6}
          style={{ position: "absolute", left: 0, right: 0, top: 268, textAlign: "center" }}
        />

        {/* 字标：逐词从虚焦浮出；连字符是唯一强调点 */}
        <Words
          words={[
            { text: "pi", start: 14, dur: 22 },
            { text: "-", start: 16, dur: 22, style: { color: T.accent } },
            { text: "gui", start: 18, dur: 22 },
          ]}
          dy={72}
          blur={20}
          gap="0.06em"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 356,
            justifyContent: "center",
            fontFamily: FONT.display,
            fontSize: 225,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            color: T.ink,
          }}
        />

        {/* 徽章：完整简体中文版 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 642,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              transform: `scale(${badgeScale.toFixed(4)})`,
              transformOrigin: "50% 100%",
              opacity: badgeT,
              padding: "12px 28px",
              borderRadius: 999,
              fontFamily: FONT.sans,
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: T.ink,
              background: alpha(T.accent, 0.09),
              boxShadow: `${T.hairline}, 0 18px 44px -18px rgba(0,0,0,0.7)`,
            }}
          >
            完整<span style={{ color: T.accent }}>简体中文</span>版
          </div>
        </div>

        {/* 单点极细光柱：徽章下方，唯一光效 */}
        <div
          style={{
            position: "absolute",
            left: 959,
            top: 712,
            width: 2,
            height: 86,
            transformOrigin: "50% 0",
            transform: `scaleY(${lightH.toFixed(4)})`,
            background: `linear-gradient(to bottom, ${alpha(T.accent, 0.85)}, ${alpha(T.accent, 0)})`,
          }}
        />

        {/* tagline */}
        <Words
          words={taglineWords}
          dy={26}
          blur={9}
          gap="0.02em"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 836,
            justifyContent: "center",
            fontFamily: FONT.sans,
            fontSize: 42,
            fontWeight: 400,
            letterSpacing: "0.02em",
            color: T.text,
          }}
        />
      </div>

      <Vignette strength={0.3} color="#000000" inner={0.5} />
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};
export const S01_settleFrame = HOLD_SETTLE;
