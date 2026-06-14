import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, ScrollView, useWindowDimensions } from "react-native";
import { Search } from "lucide-react-native";
import { allMovies, allGenres, searchMovies } from "../../src/data/catalog";
import { useT } from "../../src/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PosterCard from "../../src/components/PosterCard";
import GenreChip from "../../src/components/GenreChip";

export default function Discover() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const GAP = 10;
  const PAD = 16;
  const cardW = Math.floor((width - PAD * 2 - GAP * 2) / 3); // 3 columns, responsive
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState<string>("");
  const genres = useMemo(() => allGenres().slice(0, 14), []);

  const results = useMemo(() => {
    let list = q ? searchMovies(q) : allMovies();
    if (genre) list = list.filter((m) => m.genres.includes(genre));
    return list;
  }, [q, genre]);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top + 12 }}>
      <Text className="text-ink text-2xl font-display px-5 mb-3">{t("discover.title")}</Text>

      <View className="mx-5 mb-3 flex-row items-center bg-surface-2 rounded-full px-4 py-3">
        <Search size={18} color="rgba(229,226,225,0.5)" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t("discover.searchPlaceholder")}
          placeholderTextColor="rgba(229,226,225,0.4)"
          className="flex-1 ml-2 text-ink text-sm"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        className="mb-3 max-h-12"
      >
        <GenreChip label={t("discover.all")} active={!genre} onPress={() => setGenre("")} />
        {genres.map((g) => (
          <GenreChip key={g} label={g} active={genre === g} onPress={() => setGenre(g)} />
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(m) => m.id}
        numColumns={3}
        columnWrapperStyle={{ paddingHorizontal: PAD, gap: GAP }}
        contentContainerStyle={{ paddingBottom: 120, rowGap: 14 }}
        renderItem={({ item }) => <PosterCard movie={item} width={cardW} grid />}
        ListEmptyComponent={
          <Text className="text-ink/40 text-center mt-20">{t("discover.noResults")}</Text>
        }
      />
    </View>
  );
}
