import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const base = "C:/Users/Lecoo/.agents/skills/video-shotcraft/references/shots";
const cats = readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory());
const out = [];
for (const cat of cats) {
  for (const f of readdirSync(path.join(base, cat.name)).filter((n) => n.endsWith(".md") && n !== "ATTRIBUTION.md")) {
    const raw = readFileSync(path.join(base, cat.name, f), "utf8");
    const fm = raw.split("---")[1] ?? "";
    const pick = (k) => (fm.match(new RegExp(`^${k}: (.+)$`, "m"))?.[1] ?? "").trim();
    out.push({
      file: `${cat.name}/${f}`,
      name: pick("name"),
      一句话: pick("一句话"),
      适用: pick("适用"),
      时长: pick("时长"),
      能量: pick("能量"),
    });
  }
}
mkdirSync("promo/notes", { recursive: true });
writeFileSync("promo/notes/shots-index.json", JSON.stringify(out, null, 1), "utf8");
writeFileSync(
  "promo/notes/shots-index.md",
  out.map((s) => `### ${s.file}\n- name: ${s.name}\n- 一句话: ${s.一句话}\n- 适用: ${s.适用}\n- 时长: ${s.时长}\n- 能量: ${s.能量}`).join("\n"),
  "utf8",
);
console.log(`${out.length} cards indexed`);
