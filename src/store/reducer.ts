import { UserProfile, CheckInDay, ContinueWatchingItem, Language } from "../types";
import { DEFAULT_USER, DEFAULT_CHECK_IN } from "./defaults";

export interface State {
  user: UserProfile;
  favorites: string[];
  continueWatching: ContinueWatchingItem[];
  checkIn: CheckInDay[];
  language: Language;
  hydrated: boolean;
}

export const initialState: State = {
  user: DEFAULT_USER,
  favorites: [],
  continueWatching: [],
  checkIn: DEFAULT_CHECK_IN,
  language: "en",
  hydrated: false,
};

export type Action =
  | { type: "hydrate"; state: Partial<State> }
  | { type: "addCoins"; amount: number }
  | { type: "toggleFavorite"; movieId: string }
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
