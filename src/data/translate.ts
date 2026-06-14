import AsyncStorage from "@react-native-async-storage/async-storage";
import { Cue } from "./catalog";

// On-demand EN->VI subtitle translation, cached per movie+episode in AsyncStorage.
// Uses Google's free gtx endpoint (no API key). Runs on-device, so it needs network
// the first time an episode is viewed in Vietnamese; results are cached afterwards.

async function translateOne(text: string): Promise<string> {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url);
  const data = await res.json();
  // data[0] is an array of [translatedSegment, originalSegment, ...]
  return (data?.[0] || []).map((seg: any[]) => seg?.[0] ?? "").join("").trim() || text;
}

/** Run `fn` over items with bounded concurrency, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = await fn(items[i]);
      } catch {
        out[i] = (items[i] as unknown) as R; // fall back to source text on failure
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Translate one episode's cues to Vietnamese (cached). Returns vi cues [start, end, viText]. */
export async function translateCues(cues: Cue[], movieId: string, episodeNumber: number): Promise<Cue[]> {
  const key = `vi1:${movieId}:${episodeNumber}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached) as Cue[];
  } catch {
    // ignore cache read errors
  }
  const translated = await mapLimit(cues.map((c) => c[2]), 8, translateOne);
  const vi: Cue[] = cues.map((c, i) => [c[0], c[1], translated[i] || c[2]]);
  // Only cache if at least some lines actually changed (i.e. translation succeeded),
  // so a transient network failure doesn't poison the cache with English text.
  const changed = vi.some((c, i) => c[2] !== cues[i][2]);
  if (changed) AsyncStorage.setItem(key, JSON.stringify(vi)).catch(() => {});
  return vi;
}
