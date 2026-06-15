import { memo, useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  useWindowDimensions,
  Share,
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Volume2, VolumeX, Heart, Captions, FastForward, Lock, Play } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  getMovie,
  getEpisodes,
  getSubtitles,
  loadMovieSubtitles,
  hasViSubtitles,
  loadMovieSubtitlesVi,
  getViSubtitles,
  viBadge,
  displayTitle,
  formatCount,
  Cue,
} from "../../src/data/catalog";
import { translateCues } from "../../src/data/translate";
import { baseLikes, seedComments } from "../../src/data/social";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import { useViCatalog } from "../../src/data/catalogVi";
import { Comment, Episode } from "../../src/types";
import { ScrimTop } from "../../src/components/Scrim";
import WatchSidebar from "../../src/components/WatchSidebar";
import EpisodesDrawer from "../../src/components/EpisodesDrawer";
import CommentsSheet from "../../src/components/CommentsSheet";

/** Seconds → m:ss for the scrubber time labels. */
function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

// timeUpdate only fires ~3×/sec (every timeUpdateEventInterval), so the active cue is
// recomputed on a coarse grid and shows up to one interval late — which reads as the
// subtitle lagging the audio. Match cues against a slightly future time to cancel that
// quantization lag so lines land on the speech. Tune if subs feel early/late.
const SUBTITLE_LEAD_S = 0.35;

function VideoPageBase({
  episode,
  active,
  muted,
  paused,
  title,
  description,
  hashtags,
  viLabel,
  poster,
  cues,
  subtitlesOn,
  episodeCount,
  controlsVisible,
  onTap,
  onLike,
  onProgress,
  onEnd,
}: {
  episode: Episode;
  active: boolean;
  muted: boolean;
  paused: boolean;
  title: string;
  description: string;
  hashtags: string[];
  viLabel: "dub" | "sub" | null;
  poster: string;
  cues: Cue[] | null;
  subtitlesOn: boolean;
  episodeCount: number;
  controlsVisible: boolean;
  onTap: () => void;
  onLike: () => void;
  onProgress: (pct: number) => void;
  onEnd: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [cue, setCue] = useState("");
  const player = useVideoPlayer(episode.videoUrl, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.3; // finer ticks so subtitles track speech closely
    // Faster startup: smaller forward buffer + prioritise time so playback begins ASAP.
    p.bufferOptions = {
      preferredForwardBufferDuration: 8,
      minBufferForPlayback: 1,
      prioritizeTimeOverSizeThreshold: true,
    };
  });

  const [buffering, setBuffering] = useState(true);
  const [pct, setPct] = useState(0);
  const lastReported = useRef(-1);
  const pctShown = useRef(-1);

  // Scrubbing (drag-to-seek). While the user drags, timeUpdate must not move the bar.
  const [dur, setDur] = useState(episode.duration || 0);
  const durRef = useRef(dur);
  durRef.current = dur;
  const [scrubbing, setScrubbing] = useState(false);
  const scrubbingRef = useRef(false);
  const [scrubPct, setScrubPct] = useState(0);
  const scrubPctRef = useRef(0);
  const barW = useRef(0);

  const setScrub = useCallback(
    (x: number) => {
      const w = barW.current || 1;
      const p = Math.max(0, Math.min(100, (x / w) * 100));
      scrubPctRef.current = p;
      setScrubPct(p);
    },
    []
  );

  const commitScrub = useCallback(() => {
    const target = (scrubPctRef.current / 100) * (durRef.current || 1);
    try {
      player.currentTime = target;
    } catch {
      // ignore if player not ready
    }
    pctShown.current = Math.round(scrubPctRef.current);
    setPct(Math.round(scrubPctRef.current));
    scrubbingRef.current = false;
    setScrubbing(false);
  }, [player]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        scrubbingRef.current = true;
        setScrubbing(true);
        setScrub(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => setScrub(e.nativeEvent.locationX),
      onPanResponderRelease: commitScrub,
      onPanResponderTerminate: commitScrub,
    })
  ).current;

  useEffect(() => {
    if (active && !paused) player.play();
    else player.pause();
  }, [active, paused, player]);

  // Only the active page is ever audible. Non-active pages (the preloaded next page, or a
  // page mid-release while swiping) are force-muted so two videos can never play sound at
  // once — even during the brief window where an off-screen player hasn't released yet.
  useEffect(() => {
    player.muted = muted || !active;
  }, [muted, active, player]);

  // Stop playback immediately when this page unmounts. expo-video releases the player on
  // unmount, but the native release can lag a beat (ExoPlayer); pausing first guarantees the
  // audio cuts the moment the page leaves the window instead of bleeding into the next video.
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // player already released
      }
    };
  }, [player]);

  useEffect(() => {
    const status = player.addListener("statusChange", (e: { status: string }) => {
      setBuffering(e.status === "loading" || e.status === "idle");
    });
    const time = player.addListener("timeUpdate", (e: { currentTime: number }) => {
      const cur = e.currentTime ?? 0;
      const d = player.duration || episode.duration || 1;
      // Publish the real duration once known so the scrubber's time labels are correct.
      if (d > 1 && Math.abs(d - durRef.current) > 0.5) setDur(d);
      const p = Math.min(100, (cur / d) * 100);
      // Only re-render the progress bar when the whole-percent changes (not every tick),
      // so the ~3/sec timeUpdate doesn't churn re-renders and stutter playback. Freeze it
      // while the user is dragging the scrubber so the thumb follows the finger, not the video.
      const rp = Math.round(p);
      if (!scrubbingRef.current && rp !== pctShown.current) {
        pctShown.current = rp;
        setPct(rp);
      }

      // Active subtitle cue for the current time (cues sorted by start). Look slightly
      // ahead (SUBTITLE_LEAD_S) so the line appears on the speech instead of one
      // timeUpdate tick behind it.
      if (cues && cues.length) {
        const cs = (cur + SUBTITLE_LEAD_S) * 100;
        const hit = cues.find((c) => cs >= c[0] && cs <= c[1]);
        setCue((prev) => (hit ? (prev === hit[2] ? prev : hit[2]) : prev === "" ? prev : ""));
      }

      if (!active) return;
      const rounded = Math.round(p);
      // Only report every ~2% to avoid a state/persist update every second.
      if (Math.abs(rounded - lastReported.current) >= 2) {
        lastReported.current = rounded;
        onProgress(rounded);
      }
    });
    const end = player.addListener("playToEnd", () => {
      if (active) onEnd();
    });
    return () => {
      status.remove();
      time.remove();
      end.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, active, cues]);

  // Clear any lingering line when the cue set changes (e.g. EN<->VI switch).
  useEffect(() => {
    setCue("");
  }, [cues]);

  // Double-tap heart burst animation.
  const heart = useRef(new Animated.Value(0)).current;
  const burstHeart = useCallback(() => {
    heart.setValue(0);
    Animated.timing(heart, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heart]);

  // Press-and-hold to play at 2× (TikTok-style). While holding, a vertical swipe locks the
  // 2× on (swipe down) or unlocks it (swipe up) so playback keeps doubling after release.
  const [fast, setFast] = useState(false); // 2× indicator visible (holding or locked)
  const [locked, setLocked] = useState(false);
  const holdingRef = useRef(false);
  const lockedRef = useRef(false);
  const startYRef = useRef(0); // touch Y when the hold engaged, for lock/unlock swipe

  const setRate = useCallback(
    (r: number) => {
      try {
        player.playbackRate = r;
      } catch {
        // player not ready yet
      }
    },
    [player]
  );

  const engage2x = useCallback(() => {
    holdingRef.current = true;
    setRate(2);
    setFast(true);
  }, [setRate]);

  const release2x = useCallback(() => {
    holdingRef.current = false;
    if (!lockedRef.current) {
      setRate(1);
      setFast(false);
    }
  }, [setRate]);

  // Gestures (react-native-gesture-handler — composes with the FlatList paging without the
  // responder-termination fight a raw PanResponder runs into). runOnJS so the callbacks can
  // touch React state / the player directly. Single tap = play/pause, double tap = like,
  // long-press = 2× with vertical-swipe lock/unlock.
  const gesture = useMemo(() => {
    const single = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(250)
      .onEnd((_e, ok) => {
        if (ok) onTap();
      });
    const dbl = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDuration(280)
      .onEnd((_e, ok) => {
        if (ok) {
          onLike();
          burstHeart();
        }
      });
    const hold = Gesture.LongPress()
      .runOnJS(true)
      .minDuration(250)
      .maxDistance(10000) // don't cancel on movement — we use movement to lock/unlock
      .onStart((e) => {
        startYRef.current = e.y;
        engage2x();
      })
      .onTouchesMove((e) => {
        const tt = e.changedTouches[0] || e.allTouches[0];
        if (!tt) return;
        const dy = tt.y - startYRef.current;
        if (dy > 50 && !lockedRef.current) {
          lockedRef.current = true;
          setLocked(true);
        } else if (dy < -50 && lockedRef.current) {
          lockedRef.current = false;
          setLocked(false);
        }
      })
      .onFinalize(() => release2x());
    return Gesture.Exclusive(dbl, hold, single);
  }, [onTap, onLike, burstHeart, engage2x, release2x]);

  // Reset speed when this page is no longer the active one (swiped away while locked).
  useEffect(() => {
    if (!active) {
      holdingRef.current = false;
      lockedRef.current = false;
      setFast(false);
      setLocked(false);
      setRate(1);
    }
  }, [active, setRate]);

  return (
    <View style={{ width, height }} className="bg-black">
      <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} />

      {/* Poster (already cached from Home/Detail) covers the black surface while the
          stream buffers, so opening/swiping feels instant instead of flashing black. */}
      {buffering && (
        <Image source={poster} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" />
      )}

      {/* Transparent gesture-catcher above the native video surface: tap (play/pause),
          double-tap (like) and press-and-hold (2×) all run through this detector. */}
      <GestureDetector gesture={gesture}>
        <View className="absolute inset-0" />
      </GestureDetector>

      {/* Center play icon while paused (tap again to resume). */}
      {active && paused && (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View className="w-[68px] h-[68px] rounded-full bg-black/45 items-center justify-center">
            <Play size={32} color="#fff" fill="#fff" />
          </View>
        </View>
      )}

      {/* 2× speed indicator (press-and-hold). Stays up while locked. */}
      {fast && (
        <View
          pointerEvents="none"
          className="absolute left-0 right-0 items-center"
          style={{ top: insets.top + 56 }}
        >
          <View className="flex-row items-center bg-black/70 rounded-full px-3.5 py-1.5">
            <FastForward size={15} color="#fff" fill="#fff" />
            <Text className="text-white text-xs font-sans-bold ml-1.5">2x</Text>
            {locked && (
              <View className="flex-row items-center ml-2 pl-2 border-l border-white/20">
                <Lock size={11} color="#E50914" />
                <Text className="text-brand text-[10px] font-sans-bold ml-1">{t("watch.locked")}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Double-tap heart burst */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          alignSelf: "center",
          top: height / 2 - 60,
          opacity: heart.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.95, 0] }),
          transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.7] }) }],
        }}
      >
        <Heart size={120} color="#E50914" fill="#E50914" />
      </Animated.View>

      {/* Buffering spinner */}
      {active && buffering && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color="#E50914" />
        </View>
      )}

      {/* Subtitles — custom overlay (expo-video can't side-load external VTT). Always visible;
          rides higher when the controls show so it never overlaps the title block + scrubber. */}
      {subtitlesOn && cue !== "" && (
        <View
          className="absolute left-4 right-20 items-center"
          style={{ bottom: insets.bottom + (controlsVisible ? 168 : 40) }}
          pointerEvents="none"
        >
          <Text className="text-white text-[15px] font-sans-bold text-center bg-black/55 px-2 py-1 rounded-md leading-snug">
            {cue}
          </Text>
        </View>
      )}

      {/* Bottom metadata — shown with the controls (YouTube-style auto-hide), kept clear of the
          sidebar and the home indicator via safe-area insets so it never gets cut off. */}
      {controlsVisible && (
        <View
          className="absolute left-5 right-24"
          style={{ bottom: insets.bottom + 80 }}
          pointerEvents="none"
        >
          {viLabel && (
            <View
              className={`self-start rounded px-2 py-0.5 mb-1.5 ${
                viLabel === "dub" ? "bg-brand" : "bg-black/70"
              }`}
            >
              <Text className="text-white text-[10px] font-sans-bold tracking-wide">
                {viLabel === "dub" ? "LỒNG TIẾNG" : "PHỤ ĐỀ"}
              </Text>
            </View>
          )}
          <Text className="text-white text-xl font-display" numberOfLines={2}>
            {title}
          </Text>
          <Text className="text-ink/70 text-xs mt-1">
            {t("watch.chapter")} {episode.number} {t("watch.of")} {episodeCount}
          </Text>
          {description ? (
            <Text className="text-white/80 text-xs mt-1.5 leading-snug" numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          {hashtags.length > 0 && (
            <Text className="text-white text-xs mt-1.5 font-sans-bold" numberOfLines={1}>
              {hashtags.map((h) => `#${h.replace(/\s+/g, "")}`).join("  ")}
            </Text>
          )}
        </View>
      )}

      {/* Draggable scrubber (thumb + time labels). Hidden entirely with the rest of the
          controls — nothing is left on screen in clean mode. */}
      {controlsVisible && (
        <View className="absolute left-0 right-0" style={{ bottom: insets.bottom }}>
          <View className="flex-row justify-between px-4 mb-1">
            <Text className="text-white text-[11px] font-sans-bold">
              {fmtTime(((scrubbing ? scrubPct : pct) / 100) * (dur || 0))}
            </Text>
            <Text className="text-white/60 text-[11px]">{fmtTime(dur)}</Text>
          </View>
          <View
            {...pan.panHandlers}
            onLayout={(e) => (barW.current = e.nativeEvent.layout.width)}
            className="h-7 justify-center"
          >
            <View className="h-[4px] bg-white/25 mx-0">
              <View
                className="h-full bg-brand"
                style={{ width: `${scrubbing ? scrubPct : pct}%` }}
              />
            </View>
            <View
              pointerEvents="none"
              className="absolute"
              style={{
                left: `${scrubbing ? scrubPct : pct}%`,
                marginLeft: scrubbing ? -9 : -7,
                alignSelf: "center",
              }}
            >
              <View
                className="rounded-full bg-brand border-2 border-white"
                style={{ width: scrubbing ? 18 : 14, height: scrubbing ? 18 : 14 }}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// Re-render a page only when its own meaningful inputs change (ignore parent-state churn
// like the per-second progress dispatch or controls auto-hide on sibling pages).
const VideoPage = memo(
  VideoPageBase,
  (a, b) =>
    a.episode.number === b.episode.number &&
    a.active === b.active &&
    a.muted === b.muted &&
    a.paused === b.paused &&
    a.controlsVisible === b.controlsVisible &&
    a.subtitlesOn === b.subtitlesOn &&
    a.cues === b.cues &&
    a.title === b.title &&
    a.description === b.description &&
    a.hashtags === b.hashtags &&
    a.viLabel === b.viLabel &&
    a.poster === b.poster &&
    a.episodeCount === b.episodeCount
);

export default function Watch() {
  const { id, ep } = useLocalSearchParams<{ id: string; ep?: string }>();
  const { state, dispatch } = useStore();
  const { t } = useT();
  const vi = useViCatalog();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const movie = getMovie(String(id));
  const episodes = getEpisodes(String(id));
  const listRef = useRef<FlatList<Episode>>(null);

  const found = episodes.findIndex((e) => e.number === Number(ep || 1));
  const [index, setIndex] = useState(found < 0 ? 0 : found);
  const [drawer, setDrawer] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [subMode, setSubMode] = useState<"off" | "en" | "vi">("en");
  const [subsReady, setSubsReady] = useState(false); // true once subtitles asset is loaded
  const [viSubsReady, setViSubsReady] = useState(false); // true once native VI asset is loaded
  const [viCache, setViCache] = useState<Record<number, Cue[]>>({});

  // This movie ships native (site-provided) Vietnamese subtitles — prefer them over MT.
  const nativeVi = hasViSubtitles(String(id));

  useEffect(() => {
    loadMovieSubtitles(String(id))
      .then(() => setSubsReady(true))
      .catch(() => {});
    if (nativeVi) loadMovieSubtitlesVi(String(id)).then(() => setViSubsReady(true)).catch(() => {});
  }, [id, nativeVi]);

  // Vietnamese subtitles: native ones load directly above. For movies without them,
  // translate the current episode's English cues on demand (cached).
  useEffect(() => {
    if (subMode !== "vi" || !movie || nativeVi) return;
    const ep = episodes[index];
    if (!ep || viCache[ep.number]) return;
    const en = getSubtitles(movie.id, ep.number);
    if (!en) return;
    let cancelled = false;
    translateCues(en, movie.id, ep.number)
      .then((vi) => {
        if (!cancelled) setViCache((c) => ({ ...c, [ep.number]: vi }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subMode, index, movie, subsReady]);

  // Kick off the (lazy) Vietnamese synopsis translation so the on-video description can
  // show in the user's language; no-op for English or once cached.
  useEffect(() => {
    if (movie) vi.ensureSynopsis(movie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, state.language]);

  // Up to 3 genres become #hashtags under the title. Memoised so the page's memo() doesn't
  // see a new array each render and re-render every swipe.
  const hashtags = useMemo(() => (movie ? (movie.genres || []).slice(0, 3) : []), [movie]);

  const cycleSub = () =>
    setSubMode((m) => (m === "en" ? "vi" : m === "vi" ? "off" : "en"));

  // YouTube-style: all overlay (top bar + sidebar + info + scrubber) is hidden during
  // playback and only appears on activity. A single tap toggles play/pause AND reveals the
  // controls; while playing they auto-hide after a few seconds, while paused they stay up.
  const [paused, setPaused] = useState(false);
  const [controls, setControls] = useState(true);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (pausedRef.current) return; // keep controls up while paused
    hideTimer.current = setTimeout(() => setControls(false), 3500);
  }, []);
  // Single tap: pause/play and reveal the controls.
  const onTapVideo = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    setControls(true);
    armHide();
  }, [armHide]);

  // On mount and whenever the active episode changes: resume playback, reveal the controls,
  // and re-arm their auto-hide.
  useEffect(() => {
    setPaused(false);
    pausedRef.current = false;
    setControls(true);
    armHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [index, armHide]);

  const goTo = useCallback(
    (targetIndex: number) => {
      const target = episodes[targetIndex];
      if (!target) return;
      listRef.current?.scrollToIndex({ index: targetIndex, animated: true });
      setIndex(targetIndex);
      setDrawer(false);
    },
    [episodes]
  );

  const onViewable = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) setIndex(viewableItems[0].index ?? 0);
  }).current;

  if (!movie || !episodes.length) return <View className="flex-1 bg-black" />;

  const fav = state.favorites.includes(movie.id);
  const liked = state.likes.includes(movie.id);
  const following = state.following.includes(movie.id);

  // Social numbers: deterministic baselines from the catalog + the user's own actions.
  const userComments = state.comments[movie.id] ?? [];
  const seeds = seedComments(movie);
  const mergedComments = [...userComments, ...seeds];
  const likeCount = formatCount(baseLikes(movie) + (liked ? 1 : 0));
  const commentCount = formatCount(mergedComments.length);
  const saveCount = formatCount(movie.collectCount + (fav ? 1 : 0));
  const description = vi.synopsis(movie);

  const sendComment = (text: string) => {
    const comment: Comment = {
      id: `u-${Date.now()}`,
      author: state.user.name,
      avatarUrl: state.user.avatarUrl,
      text,
      createdAt: Date.now(),
      likes: 0,
    };
    dispatch({ type: "addComment", movieId: movie.id, comment });
  };

  // Guard a stale index (e.g. the screen reused for a shorter series) — episodes is
  // non-empty here, so falling back to episodes[0] keeps active.number from crashing.
  const active = episodes[index] ?? episodes[0];

  return (
    <View className="flex-1 bg-black">
      <FlatList
        ref={listRef}
        data={episodes}
        keyExtractor={(e) => String(e.number)}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        onScrollToIndexFailed={({ index: i }) => {
          // Fallback when a far-off target row isn't measured yet.
          listRef.current?.scrollToOffset({ offset: i * height, animated: true });
        }}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        initialNumToRender={2}
        windowSize={3}
        maxToRenderPerBatch={1}
        removeClippedSubviews
        renderItem={({ item, index: i }) => {
          // Only mount a real player for the active page and the next one (preload), so
          // we never have more than ~2 HLS streams decoding at once — the main source of
          // jank when swiping. Other pages just show the poster until they come near.
          if (i !== index && i !== index + 1) {
            return (
              <View style={{ height }} className="bg-black">
                <Image
                  source={movie.poster}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </View>
            );
          }
          return (
            <VideoPage
              episode={item}
              active={i === index}
              muted={muted}
              title={displayTitle(vi.title(movie))}
              description={description}
              hashtags={hashtags}
              viLabel={viBadge(movie)}
              poster={movie.poster}
              cues={
                subMode === "vi"
                  ? nativeVi
                    ? viSubsReady
                      ? getViSubtitles(movie.id, item.number)
                      : null
                    : viCache[item.number] ?? null
                  : subMode === "en"
                  ? getSubtitles(movie.id, item.number)
                  : null
              }
              subtitlesOn={subMode !== "off"}
              episodeCount={episodes.length}
              controlsVisible={controls}
              paused={paused && i === index}
              onTap={onTapVideo}
              onLike={() => {
                // Double-tap always likes (TikTok never un-likes on double-tap).
                if (!liked) dispatch({ type: "toggleLike", movieId: movie.id });
              }}
              onProgress={(pct) =>
                dispatch({
                  type: "recordProgress",
                  movieId: movie.id,
                  episodeNumber: item.number,
                  progress: pct,
                  now: Date.now(),
                })
              }
              onEnd={() => goTo(i + 1)}
            />
          );
        }}
      />

      {/* Overlay — back / title / captions / mute + sidebar. Hidden during playback; revealed
          on tap (which also pauses) and stays up while paused, then auto-hides while playing. */}
      {controls && (
        <>
          <View
            className="absolute top-0 left-0 right-0"
            style={{ height: insets.top + 72 }}
            pointerEvents="none"
          >
            <ScrimTop height={insets.top + 72} />
          </View>
          <Pressable
            onPress={() => router.back()}
            className="absolute left-5 w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/10"
            style={{ top: insets.top + 6 }}
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View
            className="absolute left-28 right-28 items-center"
            style={{ top: insets.top + 6 }}
            pointerEvents="none"
          >
            <Text className="text-brand font-display text-lg">{t("appName")}</Text>
            <Text className="text-white/50 text-[10px] tracking-widest">
              {t("watch.chapter")} {active.number} {t("watch.of")} {episodes.length}
            </Text>
          </View>
          <Pressable
            onPress={() => setMuted((m) => !m)}
            className="absolute right-5 w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/10"
            style={{ top: insets.top + 6 }}
          >
            {muted ? <VolumeX size={18} color="#fff" /> : <Volume2 size={18} color="#fff" />}
          </Pressable>
          <Pressable
            onPress={cycleSub}
            className="absolute h-10 px-2 min-w-10 flex-row rounded-full bg-black/40 items-center justify-center border border-white/10"
            style={{ top: insets.top + 6, right: 64 }}
          >
            <Captions size={18} color={subMode !== "off" ? "#E50914" : "#fff"} />
            {subMode !== "off" && (
              <Text className="text-white text-[10px] font-sans-bold ml-1">
                {subMode === "vi" ? "VI" : "EN"}
              </Text>
            )}
          </Pressable>

          {/* Right action column — hidden together with the rest of the controls. */}
          <WatchSidebar
            avatar={movie.poster}
            following={following}
            liked={liked}
            favorited={fav}
            likeCount={likeCount}
            commentCount={commentCount}
            saveCount={saveCount}
            onFollow={() => dispatch({ type: "toggleFollow", movieId: movie.id })}
            onLike={() => dispatch({ type: "toggleLike", movieId: movie.id })}
            onComment={() => setCommentsOpen(true)}
            onFavorite={() => dispatch({ type: "toggleFavorite", movieId: movie.id })}
            onShare={() => Share.share({ message: `${movie.title} on ShortFlix` })}
            onEpisodes={() => setDrawer(true)}
          />
        </>
      )}

      <EpisodesDrawer
        visible={drawer}
        title={vi.title(movie)}
        episodes={episodes}
        activeNumber={active.number}
        onClose={() => setDrawer(false)}
        onSelect={(n) => goTo(episodes.findIndex((e) => e.number === n))}
      />

      <CommentsSheet
        visible={commentsOpen}
        comments={mergedComments}
        meAvatar={state.user.avatarUrl}
        now={Date.now()}
        onClose={() => setCommentsOpen(false)}
        onSend={sendComment}
      />
    </View>
  );
}
