import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SHOTS, TOTAL_FRAMES } from "./SHOTS";
import { SFX_CUES } from "./SFX";
import { S01Brand } from "./shots/S01Brand";
import { S02Crane } from "./shots/S02Crane";
import { S03Wall } from "./shots/S03Wall";
import { C01Card, C02Card } from "./shots/CTitle";
import { S04Threads } from "./shots/S04Threads";
import { S05Palette } from "./shots/S05Palette";
import { S06Review } from "./shots/S06Review";
import { S07Terminal } from "./shots/S07Terminal";
import { S08Hero } from "./shots/S08Hero";
import { S09Foundation, S10Lockup, S11Outro } from "./shots/S09S10S11";

// 转场覆盖层：S01→S02 推进流白（4f 入/4f 出），S10→S11 黑场 dip（4f 入/4f 出）
const FlushWhite: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 4, 8], [0, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#f5f4f0", opacity: o, pointerEvents: "none" }} />;
};
const DipBlack: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 4, 8], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: "#000000", opacity: o, pointerEvents: "none" }} />;
};

export type PromoProps = {
  readonly bgm: boolean;
};

const SHOT_COMPONENTS: Record<string, React.FC> = {
  S01: S01Brand,
  S02: S02Crane,
  S03: S03Wall,
  C01: C01Card,
  S04: S04Threads,
  S05: S05Palette,
  S06: S06Review,
  S07: S07Terminal,
  C02: C02Card,
  S08: S08Hero,
  S09: S09Foundation,
  S10: S10Lockup,
  S11: S11Outro,
};

export const Promo: React.FC<PromoProps> = ({ bgm }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#151514" }}>
      {SHOTS.map((shot) => {
        const Comp = SHOT_COMPONENTS[shot.id];
        return (
          <Sequence key={shot.id} from={shot.from} durationInFrames={shot.duration} name={`${shot.id} ${shot.title}`}>
            <Comp />
          </Sequence>
        );
      })}
      {/* SFX：钉帧表相对帧；startFrom = 文件内起点（按素材能量峰对齐） */}
      {SFX_CUES.map((cue, i) => (
        <Sequence key={`sfx-${i}`} from={Math.max(0, cue.from)} durationInFrames={TOTAL_FRAMES - Math.max(0, cue.from)} name={`sfx ${cue.note}`}>
          <Audio src={staticFile(cue.src)} volume={cue.volume} startFrom={cue.startFrom ?? 0} />
        </Sequence>
      ))}
      {/* 转场层（钉在切点：116 = S01→S02 流白；1431 = S10→S11 dip） */}
      <Sequence from={112} durationInFrames={9} name="flush S01→S02">
        <FlushWhite />
      </Sequence>
      <Sequence from={1427} durationInFrames={9} name="dip S10→S11">
        <DipBlack />
      </Sequence>
      {/* BGM：已从源音乐拍 8 起裁剪（bgm-cut.mp3），整段铺底；尾段 1.8s 淡出与画面淡黑同步；bgm inputProp 控制双版本 */}
      {bgm ? (
        <Audio
          src={staticFile("audio/bgm/bgm-cut.mp3")}
          volume={(f) => 0.45 * (f > TOTAL_FRAMES - 54 ? Math.max(0, 1 - (f - (TOTAL_FRAMES - 54)) / 54) : 1)}
        />
      ) : null}
    </AbsoluteFill>
  );
};
