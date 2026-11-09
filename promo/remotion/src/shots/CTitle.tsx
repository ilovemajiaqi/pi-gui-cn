// C01 / C02 · paper-title-card（呼吸字卡）—— 逐词压印 + 单强调词 + 下划线 + DigitRoll 副行
// 参数真相：demos/typography/paper-title-card（50–55f、词 delay 4f 递增、9f 压印、
// blur 7px、下划线 16–34f 收束、尾 8f 淡出）。深色版把纸感换成产品的 window 底。
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT, T } from "../theme";
import { alpha } from "../lib/graphics";

export const CARD_DURATION = 58;

export interface CardCopy {
  readonly head: string; // 章节号 mono
  readonly words: { text: string; accent?: boolean; br?: boolean }[];
  readonly sub?: string;
}

// 数字滚轮（odometer；demo 同款，双份拼接保证滚感）
const DIGITS = "0123456789";
const DigitColumn: React.FC<{ ch: string; delay: number; lineH: number }> = ({ ch, delay, lineH }) => {
  const frame = useCurrentFrame();
  if (ch < "0" || ch > "9") return <span style={{ fontSize: 24, lineHeight: `${lineH}px`, color: T.mutedSoft }}>{ch}</span>;
  const target = DIGITS.indexOf(ch);
  const t = interpolate(frame, [delay, delay + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.8, 0.25, 1),
  });
  const offset = (10 + target) * t * lineH;
  return (
    <span style={{ display: "inline-block", height: lineH }}>
      <span style={{ display: "block", transform: `translateY(${-offset}px)` }}>
        {(DIGITS + DIGITS).split("").map((d, j) => (
          <span key={j} style={{ display: "block", fontSize: 24, lineHeight: `${lineH}px`, color: T.accent, fontVariantNumeric: "tabular-nums" }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
};

export const DigitRoll: React.FC<{ value: string; delay: number }> = ({ value, delay }) => {
  const lineH = 24 * 1.2;
  return (
    <span style={{ display: "inline-flex", overflow: "hidden", height: lineH, verticalAlign: "bottom" }}>
      {value.split("").map((c, i) => (
        <DigitColumn key={i} ch={c} delay={delay + i * 4} lineH={lineH} />
      ))}
    </span>
  );
};

export const TitleCard: React.FC<{ copy: CardCopy }> = ({ copy }) => {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [CARD_DURATION - 8, CARD_DURATION], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const underline = interpolate(frame, [16, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const subT = interpolate(frame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const headP = ramp(frame, 0, 16);

  function ramp(f: number, s: number, d: number) {
    return interpolate(f, [s, s + d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: T.window,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
        backgroundImage: `radial-gradient(1100px 750px at 50% 42%, ${alpha("#ffffff", 0.05)}, transparent 65%), radial-gradient(ellipse 55% 60% at 50% 20%, ${alpha(T.accent, 0.06)}, transparent 70%)`,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 1500, transform: `translateY(${((1 - subT) * 8).toFixed(2)}px)` }}>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 20,
            letterSpacing: "0.4em",
            color: T.accent,
            opacity: headP,
            marginBottom: 30,
          }}
        >
          {copy.head}
        </div>
        <div
          style={{
            fontFamily: FONT.sans,
            fontSize: 108,
            fontWeight: 700,
            lineHeight: 1.14,
            color: T.ink,
            letterSpacing: "-0.012em",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: "0.26em",
          }}
        >
          {copy.words.map((w, i) => {
            const delay = 4 + i * 4;
            const t = interpolate(frame, [delay, delay + 9], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.2, 0.75, 0.3, 1),
            });
            return (
              <React.Fragment key={i}>
                <span
                  style={{
                    opacity: t,
                    transform: `scale(${1.28 - 0.28 * t})`,
                    filter: `blur(${(1 - t) * 7}px)`,
                    display: "inline-block",
                    color: w.accent ? T.accent : T.ink,
                    fontWeight: w.accent ? 800 : 700,
                  }}
                >
                  {w.text}
                </span>
                {w.br && <span style={{ flexBasis: "100%", height: 0 }} />}
              </React.Fragment>
            );
          })}
        </div>
        <div
          style={{
            height: 5,
            width: 200,
            margin: "36px auto 0",
            borderRadius: 3,
            background: T.accent,
            transform: `scaleX(${underline.toFixed(3)})`,
            transformOrigin: "50% 50%",
          }}
        />
        {copy.sub ? (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 22,
              letterSpacing: "0.14em",
              color: T.mutedSoft,
              marginTop: 32,
              opacity: subT,
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline",
              gap: "0.5em",
            }}
          >
            <span>{copy.sub}</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// 两个具体字卡实例
export const C01Card: React.FC = () => (
  <TitleCard
    copy={{
      head: "01 · 全界面",
      words: [{ text: "每一处界面" }, { text: "都是", br: true }, { text: "中文", accent: true }],
      sub: "sidebar · timeline · review · terminal · tasks · settings",
    }}
  />
);

export const C02Card: React.FC = () => (
  <TitleCard
    copy={{
      head: "02 · 一键切换",
      words: [{ text: "切换" }, { text: "即时生效。", accent: true }],
      sub: "设置 → 外观 → 语言 → 简体中文",
    }}
  />
);
