import { View, Text, Pressable } from "react-native";
import { Lock } from "lucide-react-native";
import { Episode } from "../types";
import { useT } from "../i18n";

interface Props {
  episodes: Episode[];
  unlocked: number[];
  activeNumber?: number;
  onPress: (number: number) => void;
}

export default function EpisodeGrid({ episodes, unlocked, activeNumber, onPress }: Props) {
  const { t } = useT();
  return (
    <View className="flex-row flex-wrap px-4">
      {episodes.map((ep) => {
        const isUnlocked = ep.isFree || unlocked.includes(ep.number);
        const isActive = ep.number === activeNumber;
        return (
          <Pressable
            key={ep.number}
            onPress={() => onPress(ep.number)}
            className={`w-[18%] aspect-square m-[1%] rounded-xl items-center justify-center border ${
              isActive
                ? "bg-brand border-transparent"
                : isUnlocked
                ? "bg-surface-2 border-white/5"
                : "bg-surface border-white/5 opacity-60"
            }`}
          >
            <Text className={`font-display text-sm ${isActive ? "text-white" : "text-ink"}`}>
              {ep.number}
            </Text>
            {ep.isFree && !isActive && (
              <View className="absolute top-1 right-1 bg-green-600 px-1 rounded">
                <Text className="text-white text-[7px] font-sans-bold">{t("detail.free")}</Text>
              </View>
            )}
            {!isUnlocked && (
              <View className="absolute inset-0 items-center justify-center bg-black/40 rounded-xl">
                <Lock size={14} color="rgba(255,255,255,0.5)" />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
