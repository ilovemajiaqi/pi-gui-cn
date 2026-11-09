// S07 · 终端与定时任务 —— terminal-3d 双站压缩版（终检修复轮 v2）
// 修复（must_fix F3-1/F3-2/B2-5/Q-2/A2-1）：
// - 打字先行：1f/字符（4–42f），输出行 46/50f 才揭示（因果顺序正确）
// - 单层提示符：整块命令/输出区在揭示前用面板同色补丁覆盖；覆盖层只画一行绿色 $ + 打字，
//   底层残留块光标与第二条 prompt 一并遮住
// - tab 遮片按实测重做：pill (panel 局部 16,7,223,26)，先铺同形底色再画 chip
// - 站 2 强调改指「创建」按钮（原扫光落点是空态空白区，无动作对象）
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { EASE, ramp, mix, bezier } from "../lib/Polish";
import { alpha } from "../lib/graphics";
import { Vignette, Grain } from "../lib/Polish";
import { T, PAGE } from "../theme";

export const S07_DURATION = 131;

// 站点时序：站1 0–64 / 飞行 64–92 / 站2 92–131
const FLY = [64, 92] as const;
const PULL_PEAK = 520;
const swift = bezier(0.62, 0, 0.16, 1);

// 终端元素 bbox（layout.json）：(1481,48,439,1034)
const TERM = { x: 1481, y: 48, w: 439, h: 1034 };
// 站 2：定时任务视图 (618,48,920,1034)
const TASK = { x: 618, y: 48, w: 920, h: 1034 };
// 「创建」按钮（空态页右上，page CSS 实测）
const CREATE_BTN = { x: 1456, y: 68, w: 70, h: 44 };

const camAt = (frame: number) => {
  const u = ramp(frame, FLY[0], FLY[1] - FLY[0], swift);
  const raw = Math.min(1, Math.max(0, (frame - FLY[0]) / (FLY[1] - FLY[0])));
  const pull = Math.sin(Math.PI * Math.pow(raw, 0.85)) * PULL_PEAK * (1 - ramp(frame, FLY[1], 8, EASE.out));
  const cx = mix(1394, 1140, u);
  const cy = mix(196, 430, u);
  const zoom = mix(1.8, 1.45, u);
  return { s: u, pull, cx, cy, zoom };
};

// 打字（1f/字符）与输出揭示
const TYPE_AT = 4;
const CMD = 'node -v && echo "stardust-notes dev ready"';
const TYPE_END = TYPE_AT + CMD.length;
const OUT_AT = [46, 50];
// panel 内实测（局部 CSS）：命令行 y≈50..63、v24 y≈65..74、dev y≈79..88、残留 prompt y≈92..102
const PATCH = { x: TERM.x + 8, y: TERM.y + 46, w: TERM.w - 16, h: 62 };
const CMD_LINE_Y = TERM.y + 50;
const OUT_Y = [TERM.y + 64, TERM.y + 78];
const TAB = { x: TERM.x + 16, y: TERM.y + 7, w: 223, h: 26 };

export const S07Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { s, pull, cx, cy, zoom } = camAt(frame);

  const typed = frame < TYPE_AT ? 0 : Math.min(CMD.length, frame - TYPE_AT);
  const typingDone = typed >= CMD.length;
  const caretOn = frame >= TYPE_AT - 2 && frame <= TYPE_END + 12 && (frame <= TYPE_END || Math.floor((frame - TYPE_END) / 8) % 2 === 0);

  return (
    <AbsoluteFill style={{ backgroundColor: T.window, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 66% at 50% 44%, ${alpha(T.accent, 0.06)} 0%, rgba(154,174,216,0) 70%)` }} />
      <div style={{ position: "absolute", inset: 0, perspective: 1400, perspectiveOrigin: "960px 540px" }}>
        {/* —— 站 1 · 终端窗 —— */}
        <div
          style={{
            position: "absolute",
            width: 1920,
            height: PAGE.h,
            zoom,
            transform: `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px) translateZ(${-pull}px)`,
            transformOrigin: `${cx}px ${cy}px`,
            filter: s > 0.5 && s < 0.85 ? `blur(${(2.4 * (s - 0.5) * (0.85 - s) * 25).toFixed(2)}px)` : undefined,
            opacity: frame < FLY[1] + 6 ? 1 : 0,
          }}
        >
          <Img src={staticFile("textures/zh-CN/terminal.png")} style={{ position: "absolute", width: 1920, height: PAGE.h }} />

          {/* tab 遮片：同形底色垫底（盖掉原 tab 轮廓）→ chip */}
          <div style={{ position: "absolute", left: TAB.x - 4, top: TAB.y - 3, width: TAB.w + 8, height: TAB.h + 6, borderRadius: 10, backgroundColor: T.main }} />
          <div
            style={{
              position: "absolute",
              left: TAB.x,
              top: TAB.y,
              width: TAB.w,
              height: TAB.h,
              borderRadius: 8,
              backgroundColor: T.elevated,
              boxShadow: `inset 0 0 0 1px ${alpha("#000000", 0.25)}`,
            }}
          />
          <div style={{ position: "absolute", left: TAB.x + 14, top: TAB.y + 5, fontFamily: '"Cascadia Code","Consolas",monospace', fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>
            stardust-notes — bash
          </div>

          {/* 命令/输出区补丁常驻（面板同色）：底层命令、输出与残留块光标永不再露出 */}
          <div style={{ position: "absolute", left: PATCH.x, top: PATCH.y, width: PATCH.w, height: PATCH.h, backgroundColor: T.main }} />

          {/* 单层命令打字行 */}
          <div
            style={{
              position: "absolute",
              left: TERM.x + 12,
              top: CMD_LINE_Y,
              fontFamily: '"Cascadia Code","Consolas",monospace',
              fontSize: 13,
              color: T.ink,
              whiteSpace: "pre",
            }}
          >
            <span style={{ color: T.success }}>$ </span>
            {CMD.slice(0, typed)}
            {caretOn ? <span style={{ display: "inline-block", width: 7, height: 13, background: T.ink, opacity: 0.85, transform: "translateY(2px)" }} /> : null}
          </div>

          {/* 输出行揭示（打字完成后；3f 淡入 + 左移收回） */}
          {OUT_AT.map((t0, i) => {
            const p = ramp(frame, t0, 8, EASE.out);
            if (p <= 0) return null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: TERM.x + 12 + 10 * (1 - p),
                  top: OUT_Y[i],
                  fontFamily: '"Cascadia Code","Consolas",monospace',
                  fontSize: 13,
                  color: i === 0 ? T.text : T.success,
                  opacity: p,
                  whiteSpace: "pre",
                }}
              >
                {i === 0 ? "v24.14.0" : "stardust-notes dev ready"}
              </div>
            );
          })}
          {/* 输出落定后的空行提示符（单层，光标呼吸） */}
          {typingDone && frame >= OUT_AT[1] ? (
            <div style={{ position: "absolute", left: TERM.x + 12, top: TERM.y + 92, fontFamily: '"Cascadia Code","Consolas",monospace', fontSize: 13, color: T.text, whiteSpace: "pre" }}>
              <span style={{ color: T.success }}>$ </span>
              <span style={{ display: "inline-block", width: 7, height: 13, background: alpha(T.ink, 0.85), transform: "translateY(2px)" }} />
            </div>
          ) : null}
        </div>

        {/* —— 站 2 · 定时任务 —— */}
        <div
          style={{
            position: "absolute",
            width: 1920,
            height: PAGE.h,
            zoom,
            transform: `translate(${960 / zoom - cx}px, ${540 / zoom - cy}px) translateZ(${-Math.max(0, pull - 200)}px)`,
            transformOrigin: `${cx}px ${cy}px`,
            opacity: interpolate(frame, [FLY[0] + 20, FLY[1]], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <Img src={staticFile("textures/zh-CN/scheduled-list.png")} style={{ position: "absolute", width: 1920, height: PAGE.h }} />
          {/* 「创建」按钮强调：软光环呼吸（单点光，唯一） */}
          <div
            style={{
              position: "absolute",
              left: CREATE_BTN.x - 8,
              top: CREATE_BTN.y - 7,
              width: CREATE_BTN.w + 16,
              height: CREATE_BTN.h + 14,
              borderRadius: 14,
              boxShadow: `inset 0 0 0 1px ${alpha(T.accent, 0.5)}, 0 0 26px ${alpha(T.accent, 0.28)}`,
              opacity:
                interpolate(frame, [FLY[1] + 4, FLY[1] + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
                (0.75 + 0.25 * Math.sin((frame - FLY[1]) / 10)),
            }}
          />
        </div>
      </div>
      <Vignette strength={0.26} color="#000000" inner={0.55} />
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};
