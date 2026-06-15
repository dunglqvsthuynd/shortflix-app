// One-off audit of EN->VI subtitle translation quality, using the SAME gtx batch logic
// as src/data/mt.ts. Translates each movie's first-episode opening cues, runs automated
// checks (translated-ratio, alignment, artifacts, leftover-English), and flags problems.
// Run: node scripts/audit_subs.mjs            (coverage over all 297 movies)
//      node scripts/audit_subs.mjs deep       (deep EN|VI samples for a diverse subset)
import fs from "fs";

const GTX = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t";

async function gtx(q, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(GTX, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: "q=" + encodeURIComponent(q),
      });
      if (res.status === 429) { await sleep(800 * (i + 1)); continue; }
      const data = await res.json();
      return (data?.[0] || []).map((s) => s?.[0] ?? "").join("");
    } catch { await sleep(400 * (i + 1)); }
  }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Same batching contract as mt.ts: join lines by \n, split back, count-check.
async function translateBatch(lines) {
  const joined = await gtx(lines.join("\n"));
  if (joined == null) return null;
  const out = joined.split("\n").map((s) => s.trim());
  if (out.length === lines.length) return out.map((t, i) => t || lines[i]);
  // alignment broke -> per-line
  const per = [];
  for (const l of lines) per.push(((await gtx(l)) || l).trim() || l);
  return per;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let n = 0;
  async function worker() {
    while (n < items.length) { const i = n++; out[i] = await fn(items[i], i); }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

function firstEpisodeCues(id) {
  const j = JSON.parse(fs.readFileSync(`src/data/subs/${id}.bin`, "utf8"));
  const epKeys = Object.keys(j).sort((a, b) => Number(a) - Number(b));
  return j[epKeys[0]] || [];
}

const map = fs.readFileSync("src/data/subsMap.ts", "utf8");
const ids = [...map.matchAll(/"([0-9a-f]{24})":/g)].map((m) => m[1]);
const movies = JSON.parse(fs.readFileSync("src/data/movies.json", "utf8"));
const titleOf = Object.fromEntries(movies.map((m) => [m.id, m.title]));

// Looks-untranslated: ASCII-only line with >=2 latin words and no Vietnamese diacritics.
const VN_DIACRITIC = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
function looksEnglish(vi, en) {
  const t = vi.trim();
  if (!t) return false;
  if (VN_DIACRITIC.test(t)) return false;
  if (/[^\x00-\x7F]/.test(t)) return false; // has non-ascii (likely VN) -> ok
  const words = t.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
  return words.length >= 2 && t.toLowerCase() === en.trim().toLowerCase();
}

const mode = process.argv[2] === "deep" ? "deep" : "coverage";
const SAMPLE = mode === "deep" ? 14 : ids.length;
const CUES = mode === "deep" ? 18 : 12;

// For deep mode pick a spread across the catalog (popular + mid + tail + dubbed).
let target = ids;
if (mode === "deep") {
  const ordered = movies.map((m) => m.id).filter((id) => ids.includes(id));
  const step = Math.floor(ordered.length / SAMPLE);
  target = Array.from({ length: SAMPLE }, (_, i) => ordered[i * step]).filter(Boolean);
}

const results = [];
let done = 0;
await mapLimit(target, 4, async (id) => {
  const cues = firstEpisodeCues(id);
  const lines = cues.slice(0, CUES).map((c) => c[2]);
  if (!lines.length) { results.push({ id, title: titleOf[id], err: "no-cues" }); return; }
  const vi = await translateBatch(lines);
  done++;
  if (process.stdout.isTTY) process.stderr.write(`\r${done}/${target.length}`);
  if (!vi) { results.push({ id, title: titleOf[id], err: "translate-failed" }); return; }
  const aligned = vi.length === lines.length;
  let changed = 0, english = 0, artifact = 0;
  for (let i = 0; i < lines.length; i++) {
    if ((vi[i] || "").trim() !== lines[i].trim()) changed++;
    if (looksEnglish(vi[i] || "", lines[i])) english++;
    if (/\{\s*\d+\s*\}/.test(vi[i] || "")) artifact++;
  }
  results.push({
    id, title: titleOf[id], n: lines.length, aligned,
    changedPct: Math.round((changed / lines.length) * 100),
    english, artifact,
    sample: mode === "deep" ? lines.map((en, i) => [en, vi[i]]) : undefined,
  });
});
process.stderr.write("\n");

if (mode === "deep") {
  for (const r of results) {
    console.log(`\n=== ${r.title}  (${r.changedPct}% translated, ${r.english} look-EN, ${r.artifact} artifact) ===`);
    for (const [en, vi] of r.sample || []) console.log(`  EN: ${en}\n  VI: ${vi}`);
  }
} else {
  const ok = results.filter((r) => !r.err && r.aligned && r.changedPct >= 60 && !r.english && !r.artifact);
  const flagged = results.filter((r) => !ok.includes(r));
  console.log(`\nCOVERAGE: ${results.length} movies audited (first ${CUES} cues of ep 1)`);
  console.log(`  clean: ${ok.length}`);
  console.log(`  flagged: ${flagged.length}`);
  const byReason = {};
  for (const r of flagged) {
    const reason = r.err || (!r.aligned ? "misaligned" : r.artifact ? "artifact" : r.english ? `${r.english} look-EN` : `low-translated(${r.changedPct}%)`);
    (byReason[r.err || reason.replace(/\(.*/, "").replace(/\d+ /, "")] ||= []).push(r);
  }
  for (const [reason, list] of Object.entries(byReason)) {
    console.log(`\n  [${reason}] ${list.length}:`);
    for (const r of list.slice(0, 25)) console.log(`    ${r.changedPct ?? "-"}%  ${r.title}`);
    if (list.length > 25) console.log(`    ... +${list.length - 25} more`);
  }
}
fs.writeFileSync("scripts/.audit_subs_result.json", JSON.stringify(results, null, 1));
console.log("\n(full results -> scripts/.audit_subs_result.json)");
