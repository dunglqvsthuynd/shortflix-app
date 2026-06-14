import { useCallback, useRef, useState, useEffect } from "react";
import { View, Text, Pressable, FlatList, useWindowDimensions, Share } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { getMovie, getEpisodes } from "../../src/data/catalog";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import { Episode } from "../../src/types";
import { ScrimTop } from "../../src/components/Scrim";
import WatchSidebar from "../../src/components/WatchSidebar";
import EpisodesDrawer from "../../src/components/EpisodesDrawer";
import UnlockModal from "../../src/components/UnlockModal";
import { UNLOCK_ONE_COST, UNLOCK_ALL_COST } from "../../src/store/defaults";

function VideoPage({
  episode,
  active,
  title,
  episodeCount,
  onProgress,
  onEnd,
}: {
  episode: Episode;
  active: boolean;
  title: string;
  episodeCount: number;
  onProgress: (pct: number) => void;
  onEnd: () => void;
}) {
  const { height, width } = useWindowDimensions();
  const { t } = useT();
  const player = useVideoPlayer(episode.videoUrl, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);

  useEffect(() => {
    const sub = player.addListener("timeUpdate", (e: { currentTime: number }) => {
      if (!active) return;
      const dur = player.duration || episode.duration || 1;
      const pct = Math.min(100, Math.round(((e.currentTime ?? 0) / dur) * 100));
      onProgress(pct);
    });
    const end = player.addListener("playToEnd", () => {
      if (active) onEnd();
    });
    return () => {
      sub.remove();
      end.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, active]);

  return (
    <View style={{ width, height }} className="bg-black">
      <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} />
      <View className="absolute bottom-24 left-5 right-20">
        <Text className="text-white text-xl font-display">{title}</Text>
        <Text className="text-ink/70 text-xs mt-1">
          {t("watch.chapter")} {episode.number} {t("watch.of")} {episodeCount}
        </Text>
      </View>
    </View>
  );
}

export default function Watch() {
  const { id, ep } = useLocalSearchParams<{ id: string; ep?: string }>();
  const { state, dispatch } = useStore();
  const { t } = useT();
  const { height } = useWindowDimensions();
  const movie = getMovie(String(id));
  const episodes = getEpisodes(String(id));
  const listRef = useRef<FlatList<Episode>>(null);

  const found = episodes.findIndex((e) => e.number === Number(ep || 1));
  const [index, setIndex] = useState(found < 0 ? 0 : found);
  const [drawer, setDrawer] = useState(false);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

  const unlocked = state.unlockedEpisodes[String(id)] ?? [];
  const isUnlocked = useCallback(
    (e: Episode) => e.isFree || unlocked.includes(e.number),
    [unlocked]
  );

  const goTo = useCallback(
    (targetIndex: number) => {
      const target = episodes[targetIndex];
      if (!target) return;
      if (!isUnlocked(target)) {
        setPending(targetIndex);
        return;
      }
      listRef.current?.scrollToIndex({ index: targetIndex, animated: true });
      setIndex(targetIndex);
      setDrawer(false);
    },
    [episodes, isUnlocked]
  );

  const onViewable = useRef(({ viewableItems }: any) => {
    if (viewableItems?.length) setIndex(viewableItems[0].index ?? 0);
  }).current;

  if (!movie || !episodes.length) return <View className="flex-1 bg-black" />;

  const fav = state.favorites.includes(movie.id);

  const confirmUnlock = () => {
    if (pending == null) return;
    const target = episodes[pending];
    if (state.user.coins < UNLOCK_ONE_COST) {
      setPending(null);
      return;
    }
    dispatch({ type: "spendCoins", amount: UNLOCK_ONE_COST });
    dispatch({ type: "unlockEpisode", movieId: movie.id, number: target.number });
    const ti = pending;
    setPending(null);
    // The episode is now unlocked; navigate directly rather than via goTo,
    // whose isUnlocked closure still references the pre-dispatch unlocked list.
    listRef.current?.scrollToIndex({ index: ti, animated: true });
    setIndex(ti);
    setDrawer(false);
  };

  const unlockAll = () => {
    if (state.user.coins < UNLOCK_ALL_COST) return;
    dispatch({ type: "spendCoins", amount: UNLOCK_ALL_COST });
    dispatch({ type: "unlockAll", movieId: movie.id, numbers: episodes.map((e) => e.number) });
  };

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
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        windowSize={3}
        maxToRenderPerBatch={2}
        renderItem={({ item, index: i }) =>
          isUnlocked(item) ? (
            <VideoPage
              episode={item}
              active={i === index}
              title={movie.title}
              episodeCount={episodes.length}
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
          ) : (
            <Pressable
              onPress={() => setPending(i)}
              style={{ height }}
              className="bg-black items-center justify-center"
            >
              <Image
                source={item.thumbnail}
                style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.4 }}
                contentFit="cover"
              />
              <Text className="text-white font-display">
                {t("unlock.title")} {item.number}
              </Text>
            </Pressable>
          )
        }
      />

      <View className="absolute top-0 left-0 right-0 h-32">
        <ScrimTop />
      </View>
      <Pressable
        onPress={() => router.back()}
        className="absolute top-14 left-5 w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/10"
      >
        <ArrowLeft size={20} color="#fff" />
      </Pressable>
      <View className="absolute top-14 left-0 right-0 items-center">
        <Text className="text-brand font-display text-lg">{t("appName")}</Text>
        <Text className="text-white/50 text-[10px] tracking-widest">
          {t("watch.chapter")} {active.number} {t("watch.of")} {episodes.length}
        </Text>
      </View>

      <WatchSidebar
        liked={liked}
        favorited={fav}
        likeCount={liked ? "12.5K" : "12.4K"}
        onLike={() => setLiked((v) => !v)}
        onFavorite={() => dispatch({ type: "toggleFavorite", movieId: movie.id })}
        onShare={() => Share.share({ message: `${movie.title} on ShortFlix` })}
        onEpisodes={() => setDrawer(true)}
      />

      <EpisodesDrawer
        visible={drawer}
        title={movie.title}
        episodes={episodes}
        unlocked={unlocked}
        activeNumber={active.number}
        onClose={() => setDrawer(false)}
        onSelect={(n) => goTo(episodes.findIndex((e) => e.number === n))}
        onUnlockAll={unlockAll}
      />

      <UnlockModal
        visible={pending != null}
        episodeNumber={pending != null ? episodes[pending].number : 0}
        onCancel={() => setPending(null)}
        onConfirm={confirmUnlock}
      />
    </View>
  );
}
