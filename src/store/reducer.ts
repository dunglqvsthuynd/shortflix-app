import { UserProfile, CheckInDay, ContinueWatchingItem, Language, Comment } from "../types";
import { DEFAULT_USER, DEFAULT_CHECK_IN } from "./defaults";

export interface State {
  user: UserProfile;
  favorites: string[];
  likes: string[]; // movie ids the user has liked (watch screen heart)
  following: string[]; // movie/series ids the user follows
  comments: Record<string, Comment[]>; // user-added comments per movie id
  continueWatching: ContinueWatchingItem[];
  checkIn: CheckInDay[];
  language: Language;
  hydrated: boolean;
}

export const initialState: State = {
  user: DEFAULT_USER,
  favorites: [],
  likes: [],
  following: [],
  comments: {},
  continueWatching: [],
  checkIn: DEFAULT_CHECK_IN,
  language: "en",
  hydrated: false,
};

export type Action =
  | { type: "hydrate"; state: Partial<State> }
  | { type: "addCoins"; amount: number }
  | { type: "toggleFavorite"; movieId: string }
  | { type: "toggleLike"; movieId: string }
  | { type: "toggleFollow"; movieId: string }
  | { type: "addComment"; movieId: string; comment: Comment }
  | { type: "recordProgress"; movieId: string; episodeNumber: number; progress: number; now: number }
  | { type: "claimReward"; day: number }
  | { type: "setLanguage"; lang: Language }
  | { type: "reset" };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.state, hydrated: true };
    case "addCoins":
      return { ...state, user: { ...state.user, coins: state.user.coins + action.amount } };
    case "toggleFavorite":
      return {
        ...state,
        favorites: state.favorites.includes(action.movieId)
          ? state.favorites.filter((id) => id !== action.movieId)
          : [...state.favorites, action.movieId],
      };
    case "toggleLike":
      return {
        ...state,
        likes: state.likes.includes(action.movieId)
          ? state.likes.filter((id) => id !== action.movieId)
          : [...state.likes, action.movieId],
      };
    case "toggleFollow":
      return {
        ...state,
        following: state.following.includes(action.movieId)
          ? state.following.filter((id) => id !== action.movieId)
          : [...state.following, action.movieId],
      };
    case "addComment":
      return {
        ...state,
        comments: {
          ...state.comments,
          [action.movieId]: [action.comment, ...(state.comments[action.movieId] ?? [])],
        },
      };
    case "recordProgress": {
      const rest = state.continueWatching.filter((c) => c.movieId !== action.movieId);
      const item: ContinueWatchingItem = {
        movieId: action.movieId,
        episodeNumber: action.episodeNumber,
        progress: action.progress,
        updatedAt: action.now,
      };
      return { ...state, continueWatching: [item, ...rest].slice(0, 20) };
    }
    case "claimReward": {
      const day = state.checkIn.find((d) => d.day === action.day);
      if (!day || day.isClaimed) return state;
      return {
        ...state,
        user: { ...state.user, coins: state.user.coins + day.coins },
        checkIn: state.checkIn.map((d) => (d.day === action.day ? { ...d, isClaimed: true } : d)),
      };
    }
    case "setLanguage":
      return { ...state, language: action.lang };
    case "reset":
      return { ...initialState, hydrated: true };
    default:
      return state;
  }
}
