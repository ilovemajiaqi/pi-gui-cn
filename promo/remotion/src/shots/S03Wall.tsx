// S03 · 广度瀑布墙 —— 真实中文界面切片 3 列 3D 后仰差速滚动（page-waterfall-wall 参数真相）
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { VerticalTicker, type TickerColumn } from "../lib/VerticalTicker";
import { Vignette, Grain } from "../lib/Polish";
import { T } from "../theme";

export const S03_DURATION = 145;

const BG = "#101014";
const ZOOM = 1.2;
const PUSH = 0.06;
const COL_W = 420;
const GAP = 26;

const card = (file: string, h: number) => (
  <div
    style={{
      position: "relative",
      width: COL_W,
      height: h,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: T.main,
      boxShadow: "0 2px 4px rgba(0,0,0,0.4), 0 22px 48px -12px rgba(0,0,0,0.6)",
    }}
  >
    <Img
      src={staticFile(`textures/wall/${file}`)}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 14,
        pointerEvents: "none",
        boxShadow: "inset 0 0 0 1px rgba(238,238,234,0.10), inset 0 1px 0 rgba(238,238,234,0.16)",
      }}
    />
  </div>
);

// 三列差速反向（对齐 demo loops 12/9/14，中列反向）
export const buildColumns = (loops: [number, number, number]): TickerColumn[] => [
  {
    items: [
      card("card01-thread.png", 525),
      card("card04-terminal.png", 830),
      card("card09-composer.png", 358),
    ],
    durationInSeconds: loops[0],
    direction: -1,
  },
  {
    items: [
      card("card03-review.png", 900),
      card("card07-palette.png", 373),
      card("card02-convo.png", 224),
    ],
    durationInSeconds: loops[1],
    direction: 1,
  },
  {
    items: [
      card("card05-scheduled.png", 472),
      card("card06-settings.png", 302),
      card("card08-palette-empty.png", 408),
    ],
    durationInSeconds: loops[2],
    direction: -1,
  },
];

const Wall: React.FC<{ loops: [number, number, number]; zoom: number }> = ({ loops, zoom }) => (
  <AbsoluteFill>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1920 / zoom,
        height: 1080 / zoom,
        zoom,
      }}
    >
      <VerticalTicker
        columns={buildColumns(loops)}
        backgroundColor="transparent"
        maskHeight={0}
        scale={1}
        columnWidth={COL_W}
        gap={GAP}
      />
    </div>
    <AbsoluteFill
      style={{
        background: "linear-gradient(to bottom, rgba(16,16,20,0.34) 0%, rgba(16,16,20,0) 46%)",
        pointerEvents: "none",
      }}
    />
    {/* 上下羽化（暗场底色的实际色） */}
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(to bottom, #121216 0%, rgba(18,18,22,0.55) 8%, rgba(18,18,22,0) 26%)",
        pointerEvents: "none",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(to top, #0b0b0d 0%, rgba(11,11,13,0.5) 6%, rgba(11,11,13,0) 20%)",
        pointerEvents: "none",
      }}
    />
  </AbsoluteFill>
);

export const S03Wall: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const push = interpolate(frame, [0, durationInFrames], [1, 1 + PUSH], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 55% 60% at 50% 42%, ${"rgba(154,174,216,0.07)"} 0%, rgba(154,174,216,0) 70%)`,
        }}
      />
      <Wall loops={[12, 9, 14]} zoom={ZOOM * push} />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 50%, rgba(5,5,6,0) 55%, rgba(5,5,6,0.4) 100%)",
          pointerEvents: "none",
        }}
      />
      <Vignette strength={0.3} color="#000000" inner={0.55} />
      <Grain opacity={0.07} blend="soft-light" />
    </AbsoluteFill>
  );
};
