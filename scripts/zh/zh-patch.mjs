#!/usr/bin/env node
/*
 * pi-gui 构建产物汉化补丁
 *
 * 用法:node scripts/zh/zh-patch.mjs [out 目录,默认 apps/desktop/out]
 *
 * 原理:
 *  - 对 electron-vite 构建出的 renderer/main/preload JS 做字符串值级替换
 *  - 匹配规则:完整字符串字面量(带引号、含转义,等同 JSON.stringify 形式),避免子串误伤
 *  - 保护区:形如 "name.space.key": "value" 的 i18n 字典条目(key 带点)不做替换,
 *    保证切换回 English 时界面仍是英文(en 字典值不动,zh-CN 字典由 i18n 运行时取用)
 *  - 模板字符串规则(如 `Worked for ${...}`)以无引号形式精确匹配,单独列出
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(scriptDir, "..", "..", "apps", "desktop", "out");

// ---- 载入替换表 ----
const tables = ["ui-zh-patch.json", "ui-zh-patch-2.json", "ui-zh-patch-3.json"];
const rules = new Map(); // english -> chinese
const templateRules = []; // {find, replace} 无引号上下文
for (const t of tables) {
  const obj = JSON.parse(readFileSync(join(scriptDir, t), "utf8"));
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("__")) continue;
    if (k.includes("${")) templateRules.push({ find: k, replace: v });
    else rules.set(k, v);
  }
}

// 模板规则按长度降序,长的优先
templateRules.sort((a, b) => b.find.length - a.find.length);

/** 找出 i18n 字典值(带点 key 的字符串值)的保护区间 */
function protectedRanges(src) {
  const ranges = [];
  // "some.dotted.key": "value"   —— key 至少含一个点
  const re = /"((?:[A-Za-z0-9_$-]+\.)+[A-Za-z0-9_$-]+)"\s*:\s*("(?:[^"\\]|\\.)*")/g;
  let m;
  while ((m = re.exec(src))) {
    ranges.push([m.index + m[0].length - m[2].length, m.index + m[0].length]);
  }
  return ranges;
}

function inRanges(pos, ranges) {
  for (const [s, e] of ranges) if (pos >= s && pos < e) return true;
  return false;
}

/** 替换一个文件,返回 {hits, missed:[...]} */
function patchFile(file) {
  let src = readFileSync(file, "utf8");
  const ranges = protectedRanges(src);
  const hits = new Map();
  const missed = [];
  const edits = []; // {start, end, repl}

  // 1) 完整字符串字面量规则:先在原文上收集全部命中区间
  for (const [en, zh] of rules) {
    const needle = JSON.stringify(en); // 带双引号与转义的 bundle 字面形式
    const repl = JSON.stringify(zh);
    let count = 0;
    let idx = src.indexOf(needle);
    while (idx !== -1) {
      if (!inRanges(idx, ranges)) {
        edits.push({ start: idx, end: idx + needle.length, repl });
        count++;
      }
      idx = src.indexOf(needle, idx + needle.length);
    }
    if (count > 0) hits.set(en, count);
    else missed.push(en);
  }

  // 2) 模板字符串规则(反引号内,无引号匹配,要求命中极少避免误伤)
  for (const { find, replace } of templateRules) {
    let idx = src.indexOf(find);
    let count = 0;
    while (idx !== -1 && count < 3) {
      edits.push({ start: idx, end: idx + find.length, repl: replace });
      count++;
      idx = src.indexOf(find, idx + find.length);
    }
    if (count > 0) hits.set(find, count);
  }

  // 3) 统一从后往前应用,坐标永不偏移;重叠时保留靠后的(先收集的)不再重复
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let lastStart = Infinity;
  const applied = [];
  for (const e of edits) {
    if (e.end > lastStart) continue; // 与已应用的更高位置编辑重叠,跳过
    applied.push(e);
    lastStart = e.start;
  }
  for (const e of applied) {
    src = src.slice(0, e.start) + e.repl + src.slice(e.end);
  }

  // 命中统计按去重后的实际应用
  const appliedSet = new Set(applied.map((e) => e.start));
  for (const [en, _c] of hits) {
    // hits 里的计数在去重后可能虚高,重新按规则计数意义不大;保留规则命中标记即可
  }
  if (applied.length > 0) {
    writeFileSync(file, src, "utf8");
  }
  return { applied: applied.length, rulesHit: hits.size, missed };
}

function walk(dir, ext = ".js", out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, ext, out);
    else if (name.endsWith(ext) && !name.includes("wasm")) out.push(p);
  }
  return out;
}

// ---- 主流程 ----
const targets = walk(outDir).filter(
  (f) => f.includes(`${outDir}\\renderer`) || f.includes(`${outDir}/renderer`) || f.includes("main") || f.includes("preload")
);
console.log(`规则数: ${rules.size} 条字符串 + ${templateRules.length} 条模板`);
let totalHits = 0;
const allMissed = [];
for (const f of targets) {
  const { applied, rulesHit, missed } = patchFile(f);
  if (applied > 0) console.log(`✔ ${f.replace(outDir, "out")} 应用 ${applied} 处(规则 ${rulesHit} 条)`);
  totalHits += applied;
  allMissed.push(...missed);
}
if (allMissed.length) {
  console.log(`\n未命中的规则(${allMissed.length} 条,可能该文案仅在 i18n 字典中/被保护区跳过/上游已改词):`);
  for (const m of allMissed) console.log(`  - ${m}`);
}
console.log(`\n完成:共替换 ${totalHits} 处。`);
if (totalHits === 0) {
  console.error("警告:一处都没替换,请检查目标文件与规则。");
  process.exit(1);
}
