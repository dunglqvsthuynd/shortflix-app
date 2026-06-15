import { memo } from "react";
import { Pressable, View, Text } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Star } from "lucide-react-native";
import { Movie } from "../types";
import { useViCatalog } from "../data/catalogVi";
import { isDubbed, displayTitle } from "../data/catalog";
import Badge from "./Badge";

function PosterCardBase({
  movie,
  width = 130,
  grid = false,
}: {
  movie: Movie;
  width?: number;
  grid?: boolean;
}) {
  const vi = useViCatalog();
  const dub = isDubbed(movie);
  const title = displayTitle(vi.title(movie));
  return (
    <Pressable
      onPress={() => router.push(`/detail/${movie.id}`)}
      style={{ width }}
      className={`${grid ? "" : "mr-3"} active:opacity-80`}
    >
      <View className="rounded-xl overflow-hidden bg-surface" style={{ height: width * 1.5 }}>
        <Image source={movie.poster} style={{ flex: 1 }} contentFit="cover" transition={200} />
        {!!movie.badge && (
          <View className="absolute top-2 left-2">
            <Badge label={movie.badge} />
          </View>
        )}
        {!!movie.rating && (
          <View className="absolute top-2 right-2 flex-row items-center bg-black/60 rounded-md px-1.5 py-0.5">
            <Star size={10} color="#F5C518" fill="#F5C518" />
            <Text className="text-white text-[10px] font-sans-bold ml-1">{movie.rating.toFixed(1)}</Text>
          </View>
        )}
        {dub && (
          <View className="absolute bottom-2 left-2 bg-brand rounded px-1.5 py-0.5">
            <Text className="text-white text-[9px] font-sans-bold tracking-wide">LỒNG TIẾNG</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} className="text-ink text-xs font-sans-bold mt-1.5">
        {title}
      </Text>
      <Text numberOfLines={1} className="text-ink/40 text-[10px] mt-0.5">
        {movie.genres.slice(0, 2).join(" • ")}
      </Text>
    </Pressable>
  );
}

// Cards are pure for a given movie/width — memoize so list re-renders (scroll, search
// typing, store updates) don't re-render every visible card.
const PosterCard = memo(PosterCardBase);
export default PosterCard;
