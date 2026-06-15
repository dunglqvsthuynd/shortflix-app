export interface Episode {
  number: number;
  chapterId: string;
  duration: number; // seconds
  thumbnail: string;
  videoUrl: string; // HLS .m3u8
  isFree: boolean;
}

export interface CastMember {
  name: string;
  pic: string;
}

export interface Movie {
  id: string;
  title: string;
  synopsis: string;
  poster: string;
  genres: string[];
  tags?: string[]; // themes/tropes/setting beyond genres
  cast?: CastMember[]; // actors (present for ~half the catalog)
  rating?: number; // popularityScore from the original site, 4.5–4.9
  episodeCount: number;
  collectCount: number; // bookmarks/collects on the original site
  badge?: string; // "HOT" | "NEW" | ""
  dubbed?: boolean; // Vietnamese-dubbed ("[lồng tiếng]") entry
  viNative?: boolean; // title/synopsis already Vietnamese (skip machine translation)
}

export interface UserProfile {
  name: string;
  role: string;
  avatarUrl: string;
  isVip: boolean;
  coins: number;
}

export interface CheckInDay {
  day: number;
  coins: number;
  isClaimed: boolean;
  isSpecial?: boolean;
}

export interface ContinueWatchingItem {
  movieId: string;
  episodeNumber: number;
  progress: number; // 0..100
  updatedAt: number;
}

export interface Comment {
  id: string;
  author: string;
  avatarUrl: string;
  text: string;
  createdAt: number;
  likes: number;
}

export type Language = "en" | "vi";
