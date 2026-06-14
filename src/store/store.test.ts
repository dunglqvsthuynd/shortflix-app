import { reducer, initialState } from "./reducer";

test("spendCoins deducts when affordable, no-op when not", () => {
  const s1 = reducer(initialState, { type: "spendCoins", amount: 50 });
  expect(s1.user.coins).toBe(100);
  const s2 = reducer(s1, { type: "spendCoins", amount: 999 });
  expect(s2.user.coins).toBe(100); // unchanged
});

test("toggleFavorite adds then removes", () => {
  const a = reducer(initialState, { type: "toggleFavorite", movieId: "X" });
  expect(a.favorites).toContain("X");
  const b = reducer(a, { type: "toggleFavorite", movieId: "X" });
  expect(b.favorites).not.toContain("X");
});

test("unlockEpisode records per-movie unlock", () => {
  const s = reducer(initialState, { type: "unlockEpisode", movieId: "M", number: 5 });
  expect(s.unlockedEpisodes["M"]).toContain(5);
});

test("recordProgress upserts continue-watching newest-first", () => {
  const s1 = reducer(initialState, { type: "recordProgress", movieId: "M", episodeNumber: 2, progress: 40, now: 1 });
  expect(s1.continueWatching[0]).toMatchObject({ movieId: "M", episodeNumber: 2, progress: 40 });
  const s2 = reducer(s1, { type: "recordProgress", movieId: "M", episodeNumber: 3, progress: 10, now: 2 });
  expect(s2.continueWatching.length).toBe(1);
  expect(s2.continueWatching[0].episodeNumber).toBe(3);
});

test("setLanguage updates language", () => {
  const s = reducer(initialState, { type: "setLanguage", lang: "vi" });
  expect(s.language).toBe("vi");
});

test("claimReward marks day claimed and adds coins", () => {
  const s = reducer(initialState, { type: "claimReward", day: 1 });
  expect(s.checkIn.find((d) => d.day === 1)!.isClaimed).toBe(true);
  expect(s.user.coins).toBe(160);
});
