import moviesJson from "./movies.json";
import episodesJson from "./episodes.json";
import { Movie, Episode } from "../types";

// The generated movies.json contains a handful of duplicate rows (same id twice).
// Dedupe on load so lists don't get duplicate React keys (reconciliation warnings +
// wasted re-renders) and the same title doesn't appear twice.
const MOVIES = dedupeById(moviesJson as Movie[]);
// Episode unlocking is disabled — every episode is free to watch. Normalising isFree=true
// here makes all the gating UI (lock icons, FREE badges, "Unlock All", the unlock modal)
// see unlocked episodes and disappear, without touching each call site.
const EPISODES: Record<string, Episode[]> = Object.fromEntries(
  Object.entries(episodesJson as Record<string, Episode[]>).map(([id, eps]) => [
    id,
    eps.map((e) => (e.isFree ? e : { ...e, isFree: true })),
  ])
);
const BY_ID = new Map(MOVIES.map((m) => [m.id, m]));

function dedupeById(list: Movie[]): Movie[] {
  const seen = new Set<string>();
  const out: Movie[] = [];
  for (const m of list) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/** Dubbed alternates: English ("...(English-dubbed)") or Vietnamese ("[lồng tiếng] ...").
 *  Vietnamese-dubbed entries also carry an explicit `dubbed` flag from the scraper. */
export function isDubbed(m: Movie): boolean {
  return !!m.dubbed || /dubbed|lồng tiếng/i.test(m.title);
}

/** Vietnamese-language content: VI-dubbed (VI audio) plus the native VI catalog
 *  (VI titles/subtitles). Grouped under the "Lồng tiếng" filter. Note: this deliberately
 *  excludes English-"dubbed" alternates (English audio) that isDubbed()'s regex matches —
 *  only the scraper's `dubbed` flag (VI) and `viNative` count as Vietnamese. */
export function isVietnamese(m: Movie): boolean {
  return !!m.viNative || !!m.dubbed;
}

// The "[lồng tiếng]" prefix eats most of a narrow card's single title line, hiding the
// real name behind an ellipsis. Strip it for display (the dub status is shown separately
// as a badge) so the actual title is what gets the space.
const DUB_PREFIX = /^\s*\[\s*lồng tiếng\s*\]\s*/i;
export function displayTitle(title: string): string {
  return title.replace(DUB_PREFIX, "").trim();
}

/** Compact a large count like 14660121 -> "14.7M" for display on cards/detail. */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

/** Most-collected titles (catalog is already sorted by collectCount desc). */
export function topMovies(n: number): Movie[] {
  return MOVIES.slice(0, n);
}

/** Recommendations for a movie, ranked by shared genres + tags. */
export function recommendedFor(movie: Movie, n: number): Movie[] {
  const want = new Set([...(movie.genres || []), ...(movie.tags || [])]);
  return MOVIES.filter((m) => m.id !== movie.id)
    .map((m) => {
      let score = 0;
      for (const g of m.genres || []) if (want.has(g)) score += 2; // genre match weighs more
      for (const tg of m.tags || []) if (want.has(tg)) score += 1;
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.m);
}

export function allMovies(): Movie[] {
  return MOVIES;
}

export function getMovie(id: string): Movie | undefined {
  return BY_ID.get(id);
}

export function getEpisodes(movieId: string): Episode[] {
  return EPISODES[movieId] ?? [];
}

export function getEpisode(movieId: string, number: number): Episode | undefined {
  return getEpisodes(movieId).find((e) => e.number === number);
}

/** Distinct genres across the catalog, ordered by frequency. */
export function allGenres(): string[] {
  const count = new Map<string, number>();
  for (const m of MOVIES) for (const g of m.genres) count.set(g, (count.get(g) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

export function moviesByGenre(genre: string): Movie[] {
  return MOVIES.filter((m) => m.genres.includes(genre));
}

// Subtitles ship as one small bundled ASSET per movie (~70KB), downloaded on demand
// at runtime — kept out of the JS bundle. A cue is [startCs, endCs, text].
export type Cue = [number, number, string];
type EpisodeCues = Record<string, Cue[]>;

import { SUBS_MODULES } from "./subsMap";
import { SUBS_VI_MODULES } from "./subsViMap";

const subsCache: Record<string, EpisodeCues> = {};
const subsLoading: Record<string, Promise<EpisodeCues | null>> = {};
const subsViCache: Record<string, EpisodeCues> = {};
const subsViLoading: Record<string, Promise<EpisodeCues | null>> = {};

/** Build a download+parse loader over a require-map, caching per movie. */
function makeLoader(
  modules: Record<string, number>,
  cache: Record<string, EpisodeCues>,
  loading: Record<string, Promise<EpisodeCues | null>>
) {
  return (movieId: string): Promise<EpisodeCues | null> => {
    if (cache[movieId]) return Promise.resolve(cache[movieId]);
    const mod = modules[movieId];
    if (!mod) return Promise.resolve(null);
    if (!loading[movieId]) {
      loading[movieId] = (async () => {
        const { Asset } = require("expo-asset");
        const FileSystem = require("expo-file-system/legacy");
        const asset = Asset.fromModule(mod);
        await asset.downloadAsync();
        const text = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
        const parsed = JSON.parse(text) as EpisodeCues;
        cache[movieId] = parsed;
        return parsed;
      })();
    }
    return loading[movieId];
  };
}

/** Download + parse the English subtitle asset for one movie (cached). */
export const loadMovieSubtitles = makeLoader(SUBS_MODULES, subsCache, subsLoading);
/** Download + parse the native Vietnamese subtitle asset (only ~6 titles have one). */
export const loadMovieSubtitlesVi = makeLoader(SUBS_VI_MODULES, subsViCache, subsViLoading);

/** Synchronous lookup; returns null until loadMovieSubtitles() has resolved. */
export function getSubtitles(movieId: string, episodeNumber: number): Cue[] | null {
  const m = subsCache[movieId];
  return (m && m[String(episodeNumber)]) || null;
}

/** Native Vietnamese cues if the site shipped them for this movie/episode. */
export function getViSubtitles(movieId: string, episodeNumber: number): Cue[] | null {
  const m = subsViCache[movieId];
  return (m && m[String(episodeNumber)]) || null;
}

export function hasSubtitles(movieId: string): boolean {
  return !!SUBS_MODULES[movieId];
}

/** Whether the movie has native (site-provided) Vietnamese subtitles. */
export function hasViSubtitles(movieId: string): boolean {
  return !!SUBS_VI_MODULES[movieId];
}

export function searchMovies(query: string): Movie[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOVIES;
  // Match title OR any genre/tag; title hits rank above genre-only hits.
  const titleHits: Movie[] = [];
  const genreHits: Movie[] = [];
  for (const m of MOVIES) {
    if (m.title.toLowerCase().includes(q)) titleHits.push(m);
    else if (m.genres.some((g) => g.toLowerCase().includes(q))) genreHits.push(m);
  }
  return [...titleHits, ...genreHits];
}
