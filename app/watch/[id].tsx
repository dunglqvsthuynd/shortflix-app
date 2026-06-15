import { memo, useCallback, useRef, useState, useEffect } from "react";
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
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Volume2, VolumeX, Heart, Captions } from "lucide-react-native";
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
  Cue,
} from "../../src/data/catalog";
import { translateCues } from "../../src/data/translate";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import { useViCatalog } from "../../src/data/catalogVi";
import { Episode } from "../../src/types";
import { ScrimTop } from "../../src/components/Scrim";
import WatchSidebar from "../../src/components/WatchSidebar";
import EpisodesDrawer from "../../src/components/EpisodesDrawer";

// timeUpdate only fires ~3×/sec (every timeUpdateEventInterval), so the active cue is
// recomputed on a coarse grid and shows up to one interval late — which reads as the
// subtitle lagging the audio. Match cues against a slightly future time to cancel that
// quantization lag so lines land on the speech. Tune if subs feel early/late.
const SUBTITLE_LEAD_S = 0.35;

function VideoPageBase({
  episode,
  active,
  muted,
  title,
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
  title: string;
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

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  useEffect(() => {
    const status = player.addListener("statusChange", (e: { status: string }) => {
      setBuffering(e.status === "loading" || e.status === "idle");
    });
    const time = player.addListener("timeUpdate", (e: { currentTime: number }) => {
      const cur = e.currentTime ?? 0;
      const dur = player.duration || episode.duration || 1;
      const p = Math.min(100, (cur / dur) * 100);
      // Only re-render the progress bar when the whole-percent changes (not every tick),
      // so the ~3/sec timeUpdate doesn't churn re-renders and stutter playback.
      const rp = Math.round(p);
      if (rp !== pctShown.current) {
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

  // Double-tap to like (heart burst) vs single-tap to toggle controls.
  const heart = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const burstHeart = useCallback(() => {
    heart.setValue(0);
    Animated.timing(heart, {
      toValue: 1,
      duration: 750,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heart]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      lastTap.current = 0;
      onLike();
      burstHeart();
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => {
        onTap();
        tapTimer.current = null;
      }, 280);
    }
  }, [onLike, onTap, burstHeart]);

  useEffect(() => () => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
  }, []);

  return (
    <View style={{ width, height }} className="bg-black">
      <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} />

      {/* Poster (already cached from Home/Detail) covers the black surface while the
          stream buffers, so opening/swiping feels instant instead of flashing black. */}
      {buffering && (
        <Image source={poster} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" />
      )}

      {/* Transparent tap-catcher above the native video surface. */}
      <Pressable onPress={handleTap} className="absolute inset-0" />

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

      {/* Subtitles — custom overlay (expo-video can't side-load external VTT). Always
          visible (even in clean mode); rides higher when controls show so it never
          overlaps the title block. */}
      {subtitlesOn && cue !== "" && (
        <View
          className="absolute left-4 right-20 items-center"
          style={{ bottom: insets.bottom + (controlsVisible ? 150 : 96) }}
          pointerEvents="none"
        >
          <Text className="text-white text-[15px] font-sans-bold text-center bg-black/55 px-2 py-1 rounded-md leading-snug">
            {cue}
          </Text>
        </View>
      )}

      {/* Bottom metadata (hidden in clean mode) — kept clear of the sidebar and the
          home indicator via safe-area insets so it never gets cut off / overlapped. */}
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
        </View>
      )}

      {/* Thin playback progress bar, sitting just above the system navigation area. */}
      <View
        className="absolute left-0 right-0 h-[3px] bg-white/15"
        style={{ bottom: insets.bottom }}
        pointerEvents="none"
      >
        <View className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </View>
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
    a.controlsVisible === b.controlsVisible &&
    a.subtitlesOn === b.subtitlesOn &&
    a.cues === b.cues &&
    a.title === b.title &&
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
  const [liked, setLiked] = useState(false);
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

  const cycleSub = () =>
    setSubMode((m) => (m === "en" ? "vi" : m === "vi" ? "off" : "en"));
  const [controls, setControls] = useState(true); // TikTok-style: tap to reveal, auto-hide after 5s

  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 5000);
  }, []);
  const toggleControls = useCallback(() => {
    setControls((prev) => {
      const next = !prev;
      if (next) armHide();
      else if (hideTimer.current) clearTimeout(hideTimer.current);
      return next;
    });
  }, [armHide]);

  // Reveal controls (and re-arm the 5s timer) on mount and whenever the active episode changes.
  useEffect(() => {
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

  const active = episodes[index];

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
              onTap={toggleControls}
              onLike={() => setLiked(true)}
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

      {/* Immersive overlay — hidden in clean mode (tap video to reveal, auto-hides after 5s). */}
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

          <WatchSidebar
            liked={liked}
            favorited={fav}
            likeCount={liked ? "12.5K" : "12.4K"}
            onLike={() => setLiked((v) => !v)}
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
    </View>
  );
}
