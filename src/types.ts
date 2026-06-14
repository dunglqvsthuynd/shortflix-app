export interface Episode {
  number: number;
  chapterId: string;
  duration: number; // seconds
  thumbnail: string;
  videoUrl: string; // HLS .m3u8
  isFree: boolean;
}

export interface Movie {
  id: string;
  title: string;
  synopsis: string;
  poster: string;
  genres: string[];
  episodeCount: number;
  collectCount: number;
  badge?: string; // "HOT" | "NEW" | ""
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

export type Language = "en" | "vi";
