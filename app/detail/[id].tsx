import { useEffect } from "react";
import { ScrollView, View, Text, Pressable, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Play, Plus, Check, Star, Bookmark } from "lucide-react-native";
import { getMovie, getEpisodes, recommendedFor, formatCount, viBadge, displayTitle } from "../../src/data/catalog";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import { useViCatalog } from "../../src/data/catalogVi";
import { ScrimBottom } from "../../src/components/Scrim";
import EpisodeGrid from "../../src/components/EpisodeGrid";
import GenreChip from "../../src/components/GenreChip";
import Carousel from "../../src/components/Carousel";

export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const { t } = useT();
  const vi = useViCatalog();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const posterH = Math.round(height * 0.52); // proportional hero, fits all screen sizes
  const movie = getMovie(String(id));
  useEffect(() => {
    if (movie) vi.ensureSynopsis(movie);
  }, [movie, vi]);
  if (!movie) return <View className="flex-1 bg-black" />;

  const episodes = getEpisodes(movie.id);
  const fav = state.favorites.includes(movie.id);
  const recommended = recommendedFor(movie, 12);
  // Resume from the last-watched episode of this movie, if any.
  const resumeEp = state.continueWatching.find((c) => c.movieId === movie.id)?.episodeNumber;
  const openWatch = (n?: number) =>
    router.push({ pathname: "/watch/[id]", params: { id: movie.id, ...(n ? { ep: String(n) } : {}) } });

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ height: posterH }}>
        <Image source={movie.poster} style={{ flex: 1 }} contentFit="cover" />
        <View className="absolute inset-0">
          <ScrimBottom />
        </View>
        <Pressable
          onPress={() => router.back()}
          className="absolute left-5 w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/10"
          style={{ top: insets.top + 6 }}
        >
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <View className="absolute bottom-5 left-5 right-5">
          {viBadge(movie) && (
            <View
              className={`self-start rounded px-2 py-0.5 mb-2 ${
                viBadge(movie) === "dub" ? "bg-brand" : "bg-black/70"
              }`}
            >
              <Text className="text-white text-[10px] font-sans-bold tracking-wide">
                {viBadge(movie) === "dub" ? "LỒNG TIẾNG" : "PHỤ ĐỀ"}
              </Text>
            </View>
          )}
          <Text className="text-white text-3xl font-display tracking-tight">{displayTitle(vi.title(movie))}</Text>
          <View className="flex-row items-center mt-2 gap-4">
            {!!movie.rating && (
              <View className="flex-row items-center">
                <Star size={14} color="#F5C518" fill="#F5C518" />
                <Text className="text-white text-xs font-sans-bold ml-1">{movie.rating.toFixed(1)}</Text>
              </View>
            )}
            {movie.collectCount > 0 && (
              <View className="flex-row items-center">
                <Bookmark size={13} color="#E5E2E1" />
                <Text className="text-ink/80 text-xs ml-1">{formatCount(movie.collectCount)}</Text>
              </View>
            )}
          </View>
          <View className="flex-row mt-3">
            {movie.genres.slice(0, 3).map((g) => (
              <GenreChip key={g} label={g} />
            ))}
          </View>
        </View>
      </View>

      <View className="flex-row px-5 mt-5 gap-3">
        <Pressable
          onPress={() => openWatch(resumeEp)}
          className="flex-1 bg-brand flex-row items-center justify-center py-3.5 rounded-full"
        >
          <Play size={16} color="#fff" fill="#fff" />
          <Text className="text-white font-sans-bold ml-2">
            {resumeEp ? `${t("home.continueWatching")} · ${t("watch.chapter")} ${resumeEp}` : t("detail.watchNow")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => dispatch({ type: "toggleFavorite", movieId: movie.id })}
          className="w-14 items-center justify-center bg-surface-2 rounded-full border border-white/10"
        >
          {fav ? <Check size={20} color="#E50914" /> : <Plus size={20} color="#fff" />}
        </Pressable>
      </View>

      <Text className="text-ink/70 text-sm leading-relaxed px-5 mt-5">{vi.synopsis(movie)}</Text>

      {!!movie.tags?.length && (
        <View className="flex-row flex-wrap px-5 mt-4 gap-2">
          {movie.tags.slice(0, 10).map((tag) => (
            <View key={tag} className="bg-surface-2 rounded-full px-3 py-1 border border-white/10">
              <Text className="text-ink/70 text-xs">{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {!!movie.cast?.length && (
        <View className="mt-6">
          <Text className="text-ink text-lg font-sans-bold px-5 mb-3">{t("detail.cast")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {movie.cast.map((actor) => (
              <View key={actor.name} className="mr-4 items-center w-20">
                <View className="w-16 h-16 rounded-full overflow-hidden bg-surface-2">
                  {!!actor.pic && <Image source={actor.pic} style={{ flex: 1 }} contentFit="cover" />}
                </View>
                <Text numberOfLines={2} className="text-ink/70 text-[11px] text-center mt-1.5">
                  {actor.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <Text className="text-ink text-lg font-sans-bold px-5 mt-7 mb-3">
        {t("detail.episodes")} ({episodes.length})
      </Text>
      <EpisodeGrid
        episodes={episodes}
        onPress={(n) => openWatch(n)}
      />

      <Carousel title={t("detail.youMightLike")} data={recommended} />
    </ScrollView>
  );
}
