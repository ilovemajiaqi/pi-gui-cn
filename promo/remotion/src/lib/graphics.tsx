// 全片通用小部件：alpha、逐词入场（blur-slide 参数真相）、字标组合等。
// 时间/缓动参数来自 demos/typography/blur-slide 与 Polish（已拷入本工程）。
import React from "react";
import { useCurrentFrame } from "remotion";
import { EASE, ramp } from "./Polish";
import { FONT, T } from "../theme";

export const alpha = (color: string, a: number): string => {
  if (color.startsWith("#")) {
    const h = color.slice(1);
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
};

type Word = {
  text: string;
  start: number;
  dur: number;
  style?: React.CSSProperties;
  track?: [number, number];
};

// 三通道同一条缓动同步收敛（blur-slide 核心参数，不可拆）
export const Words: React.FC<{
  words: Word[];
  dy: number;
  blur: number;
  gap?: string;
  style?: React.CSSProperties;
}> = ({ words, dy, blur, gap = "0.24em", style }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap, whiteSpace: "nowrap", ...style }}>
      {words.map((w, i) => {
        const p = ramp(frame, w.start, w.dur, EASE.out);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              transform: `translateY(${((1 - p) * dy).toFixed(2)}px)`,
              filter: p >= 0.999 ? undefined : `blur(${((1 - p) * blur).toFixed(2)}px)`,
              letterSpacing: w.track ? `${(w.track[0] + (w.track[1] - w.track[0]) * p).toFixed(4)}em` : undefined,
              ...w.style,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

// mono 小写 kicker（首帧即在，blur-slide 单行版）
export const Kicker: React.FC<{ text: string; start: number; style?: React.CSSProperties }> = ({ text, start, style }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, start, 18, EASE.out);
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 20,
        fontWeight: 500,
        letterSpacing: "0.35em",
        textTransform: "uppercase",
        color: T.accent,
        opacity: p,
        transform: `translateY(${((1 - p) * 14).toFixed(2)}px)`,
        filter: p >= 0.999 ? undefined : `blur(${((1 - p) * 5).toFixed(2)}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
