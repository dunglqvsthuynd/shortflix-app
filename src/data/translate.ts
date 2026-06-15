import AsyncStorage from "@react-native-async-storage/async-storage";
import { Cue } from "./catalog";

// On-demand EN->VI subtitle translation, cached per movie+episode in AsyncStorage.
// Uses Google's free gtx endpoint (no API key). Proper names are protected from
// translation (masked with {0}-style placeholders, restored afterwards) so e.g.
// "Sam." stays "Sam." instead of becoming "Sâm.".

// Capitalized words that are NOT names (so they stay translatable).
const STOP = new Set([
  "I", "I'm", "I'll", "I've", "I'd", "OK", "Okay", "TV", "Oh", "Ah", "Hey", "Hi", "Yes", "No",
  "God", "Mom", "Mum", "Mommy", "Dad", "Daddy", "Mr", "Mrs", "Ms", "Dr", "Sir", "Madam", "Miss",
  "Uncle", "Aunt", "Grandma", "Grandpa", "Sister", "Brother", "Doctor",
]);

const WORD = /[A-Z][A-Za-z'’-]+/g;

/** Build the set of proper names to protect from translation, gathered across the whole
 *  episode: capitalized words that appear MID-sentence, plus first-word vocatives like
 *  "Sam," / "Diego!". Common words (STOP) are excluded so they stay translatable. */
function buildNameSet(cues: Cue[]): Set<string> {
  const names = new Set<string>();
  const add = (tok: string) => {
    if (tok.length >= 2 && !STOP.has(tok)) names.add(tok);
  };
  for (const c of cues) {
    const words = c[2].split(/\s+/);
    words.forEach((w, i) => {
      if (i > 0) {
        // mid-sentence capital -> proper noun
        const m = w.match(/^([A-Z][A-Za-z'’-]+)[.,!?;:"']?$/);
        if (m) add(m[1]);
      } else {
        // first word followed by a comma -> direct address by name ("Sam, ...").
        // Only comma (not ! or ?) to avoid catching exclamations like "Really?".
        const v = w.match(/^([A-Z][A-Za-z'’-]+),$/);
        if (v) add(v[1]);
      }
    });
  }
  return names;
}

function mask(text: string, names: Set<string>): { masked: string; found: string[] } {
  const found: string[] = [];
  const masked = text.replace(WORD, (w) => {
    if (names.has(w)) {
      const i = found.length;
      found.push(w);
      return `{${i}}`;
    }
    return w;
  });
  return { masked, found };
}

function unmask(text: string, found: string[]): string {
  return text.replace(/\{\s*(\d+)\s*\}/g, (_, n) => found[Number(n)] ?? "");
}

async function translateOne(text: string, names: Set<string>): Promise<string> {
  const { masked, found } = mask(text, names);
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=" +
    encodeURIComponent(masked);
  const res = await fetch(url);
  const data = await res.json();
  const out = (data?.[0] || []).map((seg: any[]) => seg?.[0] ?? "").join("").trim();
  return unmask(out || masked, found) || text;
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
  const key = `vi2:${movieId}:${episodeNumber}`;
  try {
    const cached = await AsyncStorage.getItem(key);
    if (cached) return JSON.parse(cached) as Cue[];
  } catch {
    // ignore cache read errors
  }
  const names = buildNameSet(cues);
  const translated = await mapLimit(cues.map((c) => c[2]), 8, (t) => translateOne(t, names));
  const vi: Cue[] = cues.map((c, i) => [c[0], c[1], translated[i] || c[2]]);
  // Only cache if at least some lines changed (translation succeeded), so a transient
  // network failure doesn't poison the cache with English text.
  const changed = vi.some((c, i) => c[2] !== cues[i][2]);
  if (changed) AsyncStorage.setItem(key, JSON.stringify(vi)).catch(() => {});
  return vi;
}
