import moviesJson from "./movies.json";
import episodesJson from "./episodes.json";
import { Movie, Episode } from "../types";

const MOVIES = moviesJson as Movie[];
const EPISODES = episodesJson as Record<string, Episode[]>;
const BY_ID = new Map(MOVIES.map((m) => [m.id, m]));

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

const subsCache: Record<string, EpisodeCues> = {};
const subsLoading: Record<string, Promise<EpisodeCues | null>> = {};

/** Download + parse the subtitle asset for one movie (cached). */
export function loadMovieSubtitles(movieId: string): Promise<EpisodeCues | null> {
  if (subsCache[movieId]) return Promise.resolve(subsCache[movieId]);
  const mod = SUBS_MODULES[movieId];
  if (!mod) return Promise.resolve(null);
  if (!subsLoading[movieId]) {
    subsLoading[movieId] = (async () => {
      const { Asset } = require("expo-asset");
      const FileSystem = require("expo-file-system/legacy");
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      const text = await FileSystem.readAsStringAsync(asset.localUri || asset.uri);
      const parsed = JSON.parse(text) as EpisodeCues;
      subsCache[movieId] = parsed;
      return parsed;
    })();
  }
  return subsLoading[movieId];
}

/** Synchronous lookup; returns null until loadMovieSubtitles() has resolved. */
export function getSubtitles(movieId: string, episodeNumber: number): Cue[] | null {
  const m = subsCache[movieId];
  return (m && m[String(episodeNumber)]) || null;
}

export function hasSubtitles(movieId: string): boolean {
  return !!SUBS_MODULES[movieId];
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
