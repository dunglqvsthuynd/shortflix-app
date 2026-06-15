import { Comment, Movie } from "../types";

// This app has no social backend, so the watch-screen "social" numbers and the seed
// comment threads are derived deterministically from each movie. Same movie always yields
// the same likes/comments so the UI is stable across renders and app restarts; the user's
// own likes/comments (persisted in the store) are layered on top of these baselines.

/** Cheap deterministic hash of a string → unsigned 32-bit int. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Baseline like count for a movie (before the user's own like). Scaled off the site's
 *  collectCount with a per-movie jitter so likes ≳ saves, like a real short-video feed. */
export function baseLikes(movie: Movie): number {
  const jitter = 1.8 + (hash(movie.id) % 120) / 100; // 1.8x .. 3.0x
  return Math.round(movie.collectCount * jitter);
}

const COMMENTERS: { author: string; avatarUrl: string }[] = [
  { author: "Linh Trần", avatarUrl: "https://i.pravatar.cc/150?img=5" },
  { author: "Minh Phạm", avatarUrl: "https://i.pravatar.cc/150?img=11" },
  { author: "Hoa Nguyễn", avatarUrl: "https://i.pravatar.cc/150?img=20" },
  { author: "David Lee", avatarUrl: "https://i.pravatar.cc/150?img=33" },
  { author: "Mai Anh", avatarUrl: "https://i.pravatar.cc/150?img=44" },
  { author: "Quang Huy", avatarUrl: "https://i.pravatar.cc/150?img=52" },
  { author: "Sophie Chen", avatarUrl: "https://i.pravatar.cc/150?img=47" },
  { author: "Tuấn Kiệt", avatarUrl: "https://i.pravatar.cc/150?img=60" },
  { author: "Bảo Châu", avatarUrl: "https://i.pravatar.cc/150?img=24" },
  { author: "Jason Park", avatarUrl: "https://i.pravatar.cc/150?img=15" },
];

const TEXTS = [
  "Tập này hay quá, hóng tập sau 🔥",
  "Nam chính đỉnh thật sự 😍",
  "Xem mà không dứt ra được luôn",
  "Cốt truyện cuốn ghê, cày một mạch hết phim",
  "Đoạn này plot twist không ngờ tới 😱",
  "Diễn viên đẹp mà diễn cũng hay nữa",
  "Ai xem lại tập 1 với mình không 🙋",
  "Phần này cảm động muốn khóc 😭",
  "Chất lượng phim ngày càng xịn",
  "Đợi tập mới mỏi cả mắt 🥹",
  "Best phim mình xem tháng này",
  "Phân cảnh cuối quay đẹp xuất sắc",
];

const DAY = 86_400_000;

/** Deterministic seed comment thread for a movie (newest first). */
export function seedComments(movie: Movie): Comment[] {
  const h = hash(movie.id);
  const count = 4 + (h % 5); // 4..8 seed comments
  const out: Comment[] = [];
  for (let i = 0; i < count; i++) {
    const k = hash(movie.id + ":" + i);
    const person = COMMENTERS[k % COMMENTERS.length];
    out.push({
      id: `seed-${movie.id}-${i}`,
      author: person.author,
      avatarUrl: person.avatarUrl,
      text: TEXTS[(k >> 3) % TEXTS.length],
      // Fixed offsets (not Date.now) so the order/labels stay deterministic.
      createdAt: 0 - (i + 1) * (DAY + (k % DAY)),
      likes: (k >> 5) % 240,
    });
  }
  return out;
}

/** "5 phút trước", "3 ngày trước"… relativeTo defaults to now at call site. */
export function timeAgo(createdAt: number, now: number, vi: boolean): string {
  // Seed comments use negative offsets relative to "now"; treat <=0 as that many ms ago.
  const ms = createdAt <= 0 ? -createdAt : Math.max(0, now - createdAt);
  const min = Math.round(ms / 60000);
  if (min < 1) return vi ? "vừa xong" : "just now";
  if (min < 60) return vi ? `${min} phút trước` : `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return vi ? `${hr} giờ trước` : `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return vi ? `${d} ngày trước` : `${d}d ago`;
  const w = Math.round(d / 7);
  return vi ? `${w} tuần trước` : `${w}w ago`;
}
