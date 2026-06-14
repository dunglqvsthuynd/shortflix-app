import { Pressable, View, Text } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Movie } from "../types";
import Badge from "./Badge";

export default function PosterCard({ movie, width = 130 }: { movie: Movie; width?: number }) {
  return (
    <Pressable
      onPress={() => router.push(`/detail/${movie.id}`)}
      style={{ width }}
      className="mr-3 active:opacity-80"
    >
      <View className="rounded-xl overflow-hidden bg-surface" style={{ height: width * 1.5 }}>
        <Image source={movie.poster} style={{ flex: 1 }} contentFit="cover" transition={200} />
        {!!movie.badge && (
          <View className="absolute top-2 left-2">
            <Badge label={movie.badge} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} className="text-ink text-xs font-sans-bold mt-1.5">
        {movie.title}
      </Text>
      <Text numberOfLines={1} className="text-ink/40 text-[10px] mt-0.5">
        {movie.genres.slice(0, 2).join(" • ")}
      </Text>
    </Pressable>
  );
}
