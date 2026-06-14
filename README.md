# ShortFlix (Expo)

Vertical short-drama streaming app. React Native + Expo + TypeScript. Dark cinematic UI, real ReelShort metadata + real HLS video, VI/EN in-app language switch.

## Setup

```bash
npm install
# regenerate src/data/*.json from ../http-proxy-lab/phim-json (already committed):
npm run build:catalog
npm start            # then press i (iOS simulator) / a (Android) / scan QR in Expo Go
```

> Installs use `legacy-peer-deps` (see `.npmrc`) because the template ships `react-dom` for web alongside `react`.

## Build iOS

```bash
npx eas build -p ios
```

## Project structure

- `app/` — expo-router screens (tabs + stack)
  - `(tabs)/` — Home, Discover, Rewards, Profile + custom `BottomNav`
  - `detail/[id]`, `watch/[id]`, `settings`, `index` (splash)
- `src/data/` — generated `movies.json` (781 titles) + `episodes.json` (47k episodes) + `catalog.ts` loaders
- `src/store/` — `reducer.ts` (pure, tested) + `AppStore.tsx` (Context + AsyncStorage persistence)
- `src/i18n/` — EN/VI dictionaries + `t()` (`LanguageProvider`)
- `src/components/` — presentational components
- `src/theme/tokens.ts` — colors + scrim gradients
- `scripts/build_catalog.py` — data pipeline (parses `phim-json/`)

## Tests

```bash
npm test                          # jest: i18n key parity + store reducer (7 tests)
python -m pytest scripts/ -q      # build-catalog pipeline (3 tests)
npm run typecheck                 # tsc --noEmit (app code)
```

## Video sources

Episodes stream from ReelShort's public HLS CDN (`v-mps.crazymaplestudios.com/*.m3u8`) via `expo-video`. iOS plays HLS natively.

**If a video does not load on device** (CDN may require a referer/token), open `app/watch/[id].tsx` and change the player source to include headers:

```tsx
const player = useVideoPlayer(
  { uri: episode.videoUrl, headers: { Referer: "https://www.reelshort.com/" } },
  (p) => { p.loop = false; p.timeUpdateEventInterval = 1; }
);
```

To confirm player wiring with a known-good stream, temporarily use Apple's sample:
`https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8`

## Subtitles

English subtitles exist for 297 of the titles. Because expo-video can't side-load external
WebVTT (the HLS manifests carry no subtitle track), the app renders them with a **custom
overlay** synced to playback time, toggled by the **CC** button on the Watch screen.

To keep the JS bundle small, subtitles ship as one small bundled **asset per movie**
(`src/data/subs/<bookId>.bin`, ~70KB each) plus a static require map (`src/data/subsMap.ts`),
downloaded on demand via `expo-asset` when a movie opens. Regenerate from the scrape with:

```bash
npm run build:subs   # parses ../http-proxy-lab/subtitles/<slug>/ep*_en.vtt
```

The **CC button** on the Watch screen cycles **EN → VI → Off**. The source only ships
English, so **Vietnamese is produced by on-demand machine translation** (`src/data/translate.ts`,
Google's free endpoint) the first time an episode is viewed in VI, then **cached** per
episode in AsyncStorage (needs network on first view only).

## Notes

- First 3 episodes per series are free; the rest unlock with coins (10 each, or 100 for all). Mock wallet — no real payments.
- User/favorites/coins/check-in/language persist in AsyncStorage.
- UI language defaults to device locale (vi → Vietnamese), switchable in Settings.
