import AsyncStorage from "@react-native-async-storage/async-storage";
import { Cue } from "./catalog";
import { translateTexts } from "./mt";

// On-demand EN->VI subtitle translation, cached per movie+episode in AsyncStorage.
//
// Subtitle lines are sentence FRAGMENTS — one sentence is usually split across several
// cues ("critically" | "injured patients"). Translating each fragment alone mistranslates
// words whose meaning depends on the rest of the sentence. So we first GROUP consecutive
// cues that form one sentence, translate the whole sentence (via the context-batched gtx
// in ./mt), then split the Vietnamese back across the original cues — proportional to each
// cue's share of the English text — keeping every cue's original start/end timing.

// A cue ends a sentence if it finishes with terminal punctuation (allowing trailing quotes).
const ENDS_SENTENCE = /[.!?…]["'”’)\]]*$/;
const GAP_LIMIT_CS = 150; // a >1.5s pause between cues implies a sentence break
const MAX_GROUP_CHARS = 200; // cap so a run without punctuation can't form a huge group
const MAX_GROUP_CUES = 8;

interface Group {
  idxs: number[];
  text: string;
}

/** Group consecutive cues into sentence units. */
function groupCues(cues: Cue[]): Group[] {
  const groups: Group[] = [];
  let cur: number[] = [];
  let curLen = 0;
  for (let i = 0; i < cues.length; i++) {
    cur.push(i);
    curLen += cues[i][2].length + 1;
    const next = cues[i + 1];
    const gap = next ? next[0] - cues[i][1] : Infinity;
    const endsSentence = ENDS_SENTENCE.test(cues[i][2].trim());
    const tooBig = curLen >= MAX_GROUP_CHARS || cur.length >= MAX_GROUP_CUES;
    if (endsSentence || tooBig || gap > GAP_LIMIT_CS || !next) {
      groups.push({ idxs: cur, text: cur.map((idx) => cues[idx][2].trim()).join(" ") });
      cur = [];
      curLen = 0;
    }
  }
  return groups;
}

/** Allocate `totalWords` across n buckets proportional to `weights`, each >=1 when possible. */
function allocCounts(weights: number[], totalWords: number): number[] {
  const n = weights.length;
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (w / wsum) * totalWords);
  const counts = exact.map((e) => Math.floor(e));
  // Hand out the rounding remainder to the largest fractional parts.
  let rem = totalWords - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, f: e - Math.floor(e) }))
    .sort((a, b) => b.f - a.f);
  for (let k = 0; k < rem; k++) counts[order[k % n].i]++;
  // Avoid empty buckets (blank subtitle mid-sentence) by stealing from the largest.
  if (totalWords >= n) {
    for (let i = 0; i < n; i++) {
      if (counts[i] === 0) {
        let max = 0;
        for (let j = 0; j < n; j++) if (counts[j] > counts[max]) max = j;
        if (counts[max] > 1) {
          counts[max]--;
          counts[i]++;
        }
      }
    }
  }
  return counts;
}

/** Split one translated sentence back into n cue slots, weighted by `weights`. */
function splitProportional(viText: string, weights: number[]): string[] {
  const n = weights.length;
  const text = (viText || "").trim();
  if (n <= 1) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const out = new Array(n).fill("");
    out[0] = text;
    return out;
  }
  const counts = allocCounts(weights, words.length);
  const out: string[] = [];
  let p = 0;
  for (let i = 0; i < n; i++) {
    out.push(words.slice(p, p + counts[i]).join(" "));
    p += counts[i];
  }
  if (p < words.length) out[n - 1] = (out[n - 1] + " " + words.slice(p).join(" ")).trim();
  return out;
}

/** Translate one episode's cues to Vietnamese (cached). Returns vi cues [start, end, viText]. */
export async function translateCues(cues: Cue[], movieId: string, episodeNumber: number): Promise<Cue[]> {
  // vi4: sentence-grouped translation (cues joined into sentences, VI split back per cue).
  // Bumped from vi3 so older fragment-translated caches regenerate with the new algorithm.
  const key = `vi4:${movieId}:${episodeNumber}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached) as Cue[];
  } catch {
    // ignore cache read errors
  }

  const groups = groupCues(cues);
  const sentencesVi = await translateTexts(groups.map((g) => g.text));

  // Start from English (fallback), then overwrite with the split Vietnamese per cue.
  const vi: Cue[] = cues.map((c) => [c[0], c[1], c[2]]);
  groups.forEach((g, gi) => {
    const weights = g.idxs.map((i) => Math.max(1, cues[i][2].trim().length));
    const parts = splitProportional(sentencesVi[gi], weights);
    g.idxs.forEach((ci, j) => {
      vi[ci] = [cues[ci][0], cues[ci][1], parts[j] || cues[ci][2]];
    });
  });

  // Only cache if at least some lines changed (translation succeeded), so a transient
  // network failure doesn't poison the cache with English text.
  const changed = vi.some((c, i) => c[2] !== cues[i][2]);
  if (changed) AsyncStorage.setItem(key, JSON.stringify(vi)).catch(() => {});
  return vi;
}
