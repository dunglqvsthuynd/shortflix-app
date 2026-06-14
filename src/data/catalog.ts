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

export function searchMovies(query: string): Movie[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOVIES;
  return MOVIES.filter((m) => m.title.toLowerCase().includes(q));
}
