// Shared EN->VI machine translation via Google's free gtx endpoint (no API key).
// Lines are translated in CONTEXT: contiguous strings are batched into one request
// (joined by newlines) so the engine sees surrounding text, then the result is split
// back per line with a strict count-check fallback to per-line translation. Used by
// both subtitle translation (translate.ts) and catalog title/synopsis translation.

const GTX =
  "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t";

// Each batch is sent as one POST (body avoids the GET URL-length limit). Keep batches
// modest so a request stays fast and any alignment fallback only re-does a few lines.
const CHUNK_CHARS = 1200;

/** POST text to gtx and concatenate the translated segments (newlines preserved). */
async function gtxTranslate(q: string): Promise<string> {
  const res = await fetch(GTX, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: "q=" + encodeURIComponent(q),
  });
  const data = await res.json();
  return (data?.[0] || []).map((seg: any[]) => seg?.[0] ?? "").join("");
}

/** Translate a single line on its own (used as the alignment fallback). */
async function translateLine(text: string): Promise<string> {
  if (!text.trim()) return text;
  try {
    return (await gtxTranslate(text)).trim() || text;
  } catch {
    return text; // fall back to source text on failure
  }
}

/** Translate a batch of contiguous lines together, then split back per line.
 *  If the line count doesn't survive the round-trip (Google merged/split lines),
 *  fall back to translating each line individually so items stay aligned. */
async function translateChunk(lines: string[]): Promise<string[]> {
  try {
    const joined = await gtxTranslate(lines.join("\n"));
    const out = joined.split("\n").map((s) => s.trim());
    if (out.length === lines.length) {
      return out.map((t, i) => t || lines[i]);
    }
  } catch {
    // fall through to per-line
  }
  return mapLimit(lines, 3, translateLine);
}

/** Group contiguous line indices into chunks under a character budget. */
function chunkByChars(texts: string[], budget: number): number[][] {
  const chunks: number[][] = [];
  let cur: number[] = [];
  let curLen = 0;
  for (let i = 0; i < texts.length; i++) {
    const len = texts[i].length + 1; // +1 for the joining newline
    if (cur.length && curLen + len > budget) {
      chunks.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(i);
    curLen += len;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Run `fn` over items with bounded concurrency, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
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

/** Translate an ordered list of strings EN->VI, preserving order. Empty/blank pass through. */
export async function translateTexts(texts: string[]): Promise<string[]> {
  const chunks = chunkByChars(texts, CHUNK_CHARS);
  const chunkResults = await mapLimit(chunks, 4, (idxs) => translateChunk(idxs.map((i) => texts[i])));
  const out: string[] = new Array(texts.length);
  chunks.forEach((idxs, ci) => {
    const r = chunkResults[ci];
    idxs.forEach((origIdx, j) => {
      out[origIdx] = r[j] ?? texts[origIdx];
    });
  });
  return out;
}
