import { FlatList, View } from "react-native";
import { Movie } from "../types";
import PosterCard from "./PosterCard";
import SectionHeader from "./SectionHeader";

export default function Carousel({ title, data }: { title: string; data: Movie[] }) {
  if (!data.length) return null;
  return (
    <View>
      <SectionHeader title={title} />
      <FlatList
        horizontal
        data={data}
        keyExtractor={(m) => m.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        renderItem={({ item }) => <PosterCard movie={item} />}
      />
    </View>
  );
}
