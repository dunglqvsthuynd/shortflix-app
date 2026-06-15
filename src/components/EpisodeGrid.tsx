import { View, Text, Pressable } from "react-native";
import { Episode } from "../types";

interface Props {
  episodes: Episode[];
  activeNumber?: number;
  onPress: (number: number) => void;
}

export default function EpisodeGrid({ episodes, activeNumber, onPress }: Props) {
  return (
    <View className="flex-row flex-wrap px-4">
      {episodes.map((ep) => {
        const isActive = ep.number === activeNumber;
        return (
          <Pressable
            key={ep.number}
            onPress={() => onPress(ep.number)}
            className={`w-[18%] aspect-square m-[1%] rounded-xl items-center justify-center border ${
              isActive ? "bg-brand border-transparent" : "bg-surface-2 border-white/5"
            }`}
          >
            <Text className={`font-display text-sm ${isActive ? "text-white" : "text-ink"}`}>
              {ep.number}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
