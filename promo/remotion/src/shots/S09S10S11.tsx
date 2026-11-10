// S09 · 技术底座 —— 三块 mono 数字（DigitRoll）+ 标签依次落定：
// 770 词条 · 100% 覆盖 · 0 残留硬编码（防回退门禁的语义）
// S10 · 收场 lockup —— S01 版式回归 + CTA（logo-shrink 的收束节奏：先图形后字）
// S11 · 上游致谢 mono 行 + 淡出
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { EASE, ramp, bezier, Vignette, Grain } from "../lib/Polish";
import { Easing } from "remotion";
import { alpha, Words, Kicker } from "../lib/graphics";
import { DigitRoll } from "./CTitle";
import { FONT, T } from "../theme";

export const S09_DURATION = 105;

const landPop = bezier(0.34, 1.3, 0.64, 1);

interface Stat {
  readonly value: string;
  readonly label: string;
  readonly delay: number;
}
const STATS: Stat[] = [
  { value: "770", label: "界面词条", delay: 14 },
  { value: "100%", label: "覆盖率", delay: 34 },
  { value: "0", label: "残留硬编码", delay: 54 },
];

const StatBlock: React.FC<{ stat: Stat }> = ({ stat }) => {
  const frame = useCurrentFrame();
  const t = ramp(frame, stat.delay, 20, EASE.out);
  const pop = landPop(t);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        opacity: t,
        transform: `translateY(${((1 - Easing.out(Easing.cubic)(t)) * 26).toFixed(2)}px) scale(${(0.96 + 0.04 * pop).toFixed(4)})`,
      }}
    >
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 128,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: T.ink,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            overflow: "hidden",
            height: 128,
            verticalAlign: "bottom",
          }}
        >
          <S09Roll value={stat.value} delay={stat.delay + 4} />
        </span>
      </div>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 32,
          letterSpacing: "0.14em",
          color: T.mutedSoft,
          textAlign: "center",
        }}
      >
        {stat.label}
      </div>
    </div>
  );
};

// 数字轮（复用 C01 的 DigitRoll，但字号大：本地重实现列滚动）
const S09Roll: React.FC<{ value: string; delay: number }> = ({ value, delay }) => {
  return (
    <span
      style={{ display: "inline-flex", overflow: "hidden", height: 128, verticalAlign: "bottom" }}
    >
      {value.split("").map((c, i) => (
        <BigDigit key={i} ch={c} delay={delay + i * 3} />
      ))}
    </span>
  );
};
const BIG = "0123456789";
const BigDigit: React.FC<{ ch: string; delay: number }> = ({ ch, delay }) => {
  const frame = useCurrentFrame();
  if (ch < "0" || ch > "9")
    return <span style={{ fontSize: 128, lineHeight: "128px", color: T.ink }}>{ch}</span>;
  const target = BIG.indexOf(ch);
  const t = interpolate(frame, [delay, delay + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.8, 0.25, 1),
  });
  const offset = (10 + target) * t * 128;
  return (
    <span style={{ display: "inline-block", height: 128 }}>
      <span style={{ display: "block", transform: `translateY(${-offset}px)` }}>
        {(BIG + BIG).split("").map((d, j) => (
          <span
            key={j}
            style={{
              display: "block",
              fontSize: 140,
              lineHeight: "128px",
              color: T.ink,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
};

export const S09Foundation: React.FC = () => {
  const frame = useCurrentFrame();
  const kickerP = ramp(frame, 2, 16, EASE.out);
  const dividerP = ramp(frame, 66, 16, EASE.snappy);
  return (
    <AbsoluteFill style={{ backgroundColor: T.window, justifyContent: "center" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 55% 60% at 50% 30%, ${alpha(T.accent, 0.06)}, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 300,
          textAlign: "center",
          fontFamily: FONT.mono,
          fontSize: 20,
          letterSpacing: "0.4em",
          color: T.accent,
          opacity: kickerP,
        }}
      >
        BUILT ON A STRICT LOCALIZATION CONTRACT
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 420,
          display: "flex",
          justifyContent: "center",
          gap: 150,
        }}
      >
        {STATS.map((stat) => (
          <StatBlock key={stat.label} stat={stat} />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 740,
          textAlign: "center",
          fontFamily: FONT.sans,
          fontSize: 32,
          color: T.text,
          opacity: ramp(frame, 74, 18, EASE.out),
        }}
      >
        词条永不漂移——<b style={{ color: T.ink }}>翻译防回退门禁</b>把守每一行界面
      </div>
      <div
        style={{
          position: "absolute",
          left: 660,
          right: 660,
          top: 820,
          height: 1,
          background: alpha(T.ink, 0.14 * dividerP),
          transform: `scaleX(${dividerP})`,
        }}
      />
      <Vignette strength={0.3} color="#000000" inner={0.5} />
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};

// ───────── S10 · lockup ─────────
export const S10_DURATION = 130;

export const S10Lockup: React.FC = () => {
  const frame = useCurrentFrame();
  const push = 1 + 0.025 * ramp(frame, 70, S10_DURATION - 70, EASE.smooth);
  const wordIn = ramp(frame, 8, 22, EASE.out);
  const badgeT = ramp(frame, 34, 22, EASE.out);
  const badgeScale = 0.9 + 0.1 * landPop(badgeT);
  const wordP = ramp(frame, 20, 20, EASE.out);
  const ctaP = ramp(frame, 60, 20, EASE.out);
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: `radial-gradient(1200px 800px at 50% 40%, ${T.windowCenter} 0%, ${T.window} 68%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 55% 60% at 50% 22%, ${alpha(T.accent, 0.08)}, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${push.toFixed(4)})`,
          transformOrigin: "50% 44%",
        }}
      >
        {/* 字标（比 S01 略收敛；从下 16px 浮入） */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 380,
            textAlign: "center",
            fontFamily: FONT.display,
            fontSize: 190,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: T.ink,
            opacity: wordIn,
            transform: `translateY(${((1 - wordIn) * 16).toFixed(2)}px)`,
            lineHeight: 1,
          }}
        >
          pi<span style={{ color: T.accent }}>-</span>gui
          <span
            style={{
              fontSize: 34,
              letterSpacing: "0.06em",
              color: T.mutedSoft,
              marginLeft: 36,
              fontWeight: 600,
              verticalAlign: "48px",
            }}
          >
            简体中文版
          </span>
        </div>
        {/* tagline 逐词 */}
        <Words
          words={[
            { text: "全界面中文", start: 24, dur: 20 },
            { text: "·", start: 26, dur: 18, style: { color: T.accent } },
            { text: "随时切换", start: 28, dur: 20 },
            { text: "·", start: 30, dur: 18, style: { color: T.accent } },
            { text: "即刻可用", start: 32, dur: 20 },
          ]}
          dy={22}
          blur={8}
          gap="0.32em"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 636,
            justifyContent: "center",
            fontFamily: FONT.sans,
            fontSize: 40,
            fontWeight: 400,
            color: T.text,
          }}
        />
        {/* CTA pill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 742,
            display: "flex",
            justifyContent: "center",
            opacity: wordP,
          }}
        >
          <div
            style={{
              transform: `scale(${badgeScale.toFixed(4)})`,
              padding: "16px 44px",
              borderRadius: 999,
              background: alpha(T.accent, 0.14),
              boxShadow: `${T.hairline}, 0 20px 50px -20px ${alpha(T.accent, 0.5)}`,
              fontFamily: FONT.sans,
              fontSize: 34,
              fontWeight: 600,
              color: T.ink,
              letterSpacing: "0.05em",
            }}
          >
            Releases 立即下载
            <span style={{ color: T.accent, marginLeft: 18, fontFamily: FONT.mono, fontSize: 24 }}>
              →
            </span>
          </div>
        </div>
        {/* mono 小字：安装即跟随系统语言 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 866,
            textAlign: "center",
            fontFamily: FONT.mono,
            fontSize: 32,
            letterSpacing: "0.14em",
            color: T.mutedSubtle,
            opacity: ctaP,
          }}
        >
          MIT · WINDOWS / MACOS / LINUX · 会话数据与上游完全兼容
        </div>
      </div>
      <Vignette strength={0.34} color="#000000" inner={0.5} />
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};

// ───────── S11 · 上游致谢 + 淡出 ─────────
export const S11_DURATION = 87;

export const S11Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const lineP = ramp(frame, 8, 20, EASE.out);
  const fadeAll = interpolate(frame, [S11_DURATION - 26, S11_DURATION - 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: T.window, opacity: fadeAll }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 50% 55% at 50% 45%, ${alpha(T.accent, 0.05)}, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 470,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 34,
            letterSpacing: "0.22em",
            color: T.mutedSoft,
            opacity: lineP,
          }}
        >
          based on pi-gui · powered by pi coding agent
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 18,
            letterSpacing: "0.18em",
            color: T.mutedSubtle,
            opacity: ramp(frame, 20, 20, EASE.out),
          }}
        >
          MIT license · upstream minghinmatthewlam/pi-gui · earendil-works/pi
        </div>
      </div>
      <Vignette strength={0.4} color="#000000" inner={0.45} />
    </AbsoluteFill>
  );
};
