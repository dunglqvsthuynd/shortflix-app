import { useEffect } from "react";
import { ScrollView, View, Text, Pressable, FlatList, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Play } from "lucide-react-native";
import { allMovies, moviesByGenre, allGenres, getMovie, topMovies } from "../../src/data/catalog";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import Carousel from "../../src/components/Carousel";
import { ScrimBottom } from "../../src/components/Scrim";
import Badge from "../../src/components/Badge";
import { useViCatalog } from "../../src/data/catalogVi";

export default function Home() {
  const { state } = useStore();
  const { t } = useT();
  const vi = useViCatalog();
  const { height } = useWindowDimensions();
  const bannerH = Math.round(height * 0.58); // proportional banner, fits all screen sizes
  const movies = allMovies();
  const featured = movies[0];
  const genres = allGenres().slice(0, 5);
  // "Trending" ranks by rating (then collects) — a different signal from the
  // collect-count "Most Popular" rail so the two rows aren't identical.
  const trending = [...movies]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.collectCount - a.collectCount)
    .slice(0, 12);

  const cw = state.continueWatching
    .map((c) => ({ c, movie: getMovie(c.movieId) }))
    .filter((x) => x.movie);

  // Translate the featured movie's synopsis when in Vietnamese.
  useEffect(() => {
    if (featured) vi.ensureSynopsis(featured);
  }, [featured, vi]);

  return (
    <ScrollView
      className="flex-1 bg-black"
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      {featured && (
        <Pressable onPress={() => router.push(`/detail/${featured.id}`)} className="w-full" style={{ height: bannerH }}>
          <Image source={featured.poster} style={{ flex: 1 }} contentFit="cover" />
          <View className="absolute inset-0">
            <ScrimBottom />
          </View>
          <View className="absolute bottom-6 left-5 right-5">
            {!!featured.badge && (
              <View className="mb-2 self-start">
                <Badge label={featured.badge} />
              </View>
            )}
            <Text className="text-white text-3xl font-display tracking-tight">{vi.title(featured)}</Text>
            <Text numberOfLines={2} className="text-ink/70 text-xs mt-2 leading-relaxed">
              {vi.synopsis(featured)}
            </Text>
            <Pressable
              onPress={() => router.push(`/watch/${featured.id}`)}
              className="bg-brand mt-4 self-start flex-row items-center px-6 py-3 rounded-full"
            >
              <Play size={16} color="#fff" fill="#fff" />
              <Text className="text-white font-sans-bold text-sm ml-2">{t("home.playNow")}</Text>
            </Pressable>
          </View>
        </Pressable>
      )}

      {cw.length > 0 && (
        <View className="mt-6">
          <Text className="text-ink text-lg font-sans-bold px-5 mb-3">{t("home.continueWatching")}</Text>
          <FlatList
            horizontal
            data={cw}
            keyExtractor={(x) => x.c.movieId}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/watch/[id]",
                    params: { id: item.movie!.id, ep: String(item.c.episodeNumber) },
                  })
                }
                className="mr-3 w-44"
              >
                <View className="h-24 rounded-xl overflow-hidden bg-surface">
                  <Image source={item.movie!.poster} style={{ flex: 1 }} contentFit="cover" />
                  <View className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <View className="h-full bg-brand" style={{ width: `${item.c.progress}%` }} />
                  </View>
                </View>
                <Text numberOfLines={1} className="text-ink text-xs font-sans-bold mt-1.5">
                  {vi.title(item.movie!)}
                </Text>
                <Text className="text-ink/40 text-[10px]">
                  {t("watch.chapter")} {item.c.episodeNumber}
                </Text>
              </Pressable>
            )}
          />
        </View>
      )}

      <Carousel title={t("home.trending")} data={trending} />
      <Carousel title={t("home.popular")} data={topMovies(12)} />

      {genres.map((g) => (
        <Carousel key={g} title={g} data={moviesByGenre(g).slice(0, 12)} />
      ))}
    </ScrollView>
  );
}
