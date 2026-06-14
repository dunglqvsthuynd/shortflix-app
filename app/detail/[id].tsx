import { ScrollView, View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, router } from "expo-router";
import { ArrowLeft, Play, Plus, Check } from "lucide-react-native";
import { getMovie, getEpisodes, allMovies } from "../../src/data/catalog";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import { ScrimBottom } from "../../src/components/Scrim";
import EpisodeGrid from "../../src/components/EpisodeGrid";
import GenreChip from "../../src/components/GenreChip";
import Carousel from "../../src/components/Carousel";

export default function Detail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useStore();
  const { t } = useT();
  const movie = getMovie(String(id));
  if (!movie) return <View className="flex-1 bg-black" />;

  const episodes = getEpisodes(movie.id);
  const fav = state.favorites.includes(movie.id);
  const unlocked = state.unlockedEpisodes[movie.id] ?? [];
  const recommended = allMovies()
    .filter((m) => m.id !== movie.id && m.genres.some((g) => movie.genres.includes(g)))
    .slice(0, 12);
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
      <View className="h-[420px]">
        <Image source={movie.poster} style={{ flex: 1 }} contentFit="cover" />
        <View className="absolute inset-0">
          <ScrimBottom />
        </View>
        <Pressable
          onPress={() => router.back()}
          className="absolute top-14 left-5 w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/10"
        >
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <View className="absolute bottom-5 left-5 right-5">
          <Text className="text-white text-3xl font-display tracking-tight">{movie.title}</Text>
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

      <Text className="text-ink/70 text-sm leading-relaxed px-5 mt-5">{movie.synopsis}</Text>

      <Text className="text-ink text-lg font-sans-bold px-5 mt-7 mb-3">
        {t("detail.episodes")} ({episodes.length})
      </Text>
      <EpisodeGrid
        episodes={episodes}
        unlocked={unlocked}
        onPress={(n) => openWatch(n)}
      />

      <Carousel title={t("detail.youMightLike")} data={recommended} />
    </ScrollView>
  );
}
