// pi-gui-zh 宣传片 · 设计 tokens（提取自 apps/desktop contracts/theme.ts Default Dark + tokens.css）
// 参照 promo/DESIGN-SPEC.md §2；全片文字/配色/材质只从这里取。

export const T = {
  window: "#151514",
  windowCenter: "#1b1b1a",
  main: "#1d1d1c",
  elevated: "#232322",
  ink: "#eeeeea",
  text: "#e4e3df",
  muted: "#b3b1ac",
  mutedSoft: "#9d9b95",
  mutedSubtle: "#8a8880",
  line: "#2c2c2a",
  lineStrong: "#383732",
  accent: "#9aaed8",
  accentTint: "rgba(154,174,216,0.12)",
  accentBorder: "rgba(154,174,216,0.32)",
  success: "#40c977",
  error: "#e05467",
  warning: "#d97706",
  hairline: "0 0 0 0.5px rgba(238,238,234,0.13)",
  hairlineBorder: "0.5px solid rgba(238,238,234,0.13)",
  shadowDeep: "rgba(0,0,0,0.5)",
} as const;

// 字体：与 app 一致的系统栈（渲染机 Windows；CJK 落微软雅黑）
export const FONT = {
  display: '"Segoe UI Variable Display","Segoe UI","Microsoft YaHei",sans-serif',
  sans: '"Segoe UI","Microsoft YaHei",sans-serif',
  mono: '"Cascadia Code","Consolas",ui-monospace,monospace',
} as const;

// 动效性格 tokens（spec §2：专业信赖预设 + 切换/落地允许轻弹）
export const MOTION = {
  enterOut: [0, 0, 0.2, 1] as const, // app 的 --ease-out
  landPop: [0.34, 1.3, 0.64, 1] as const, // 过冲 ≤1.04 的落地弹（仅切换/归位）
  holdBrand: 45, // 字标落定 hold ≥1s
  holdShot: 30, // 功能镜落定
} as const;

// 画幅
export const VIDEO = { fps: 30, width: 1920, height: 1080 } as const;

// 采集纹理的页面尺寸（来自 capture layout.json：CSS 1920×1082）
export const PAGE = { w: 1920, h: 1082 } as const;

// tex：public/textures 下采集文件的 staticFile 路径助手
export const tex = (locale: string, name: string, suffix = "") =>
  `textures/${locale}/${name}${suffix}`;
