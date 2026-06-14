import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { Zap } from "lucide-react-native";
import { Episode } from "../types";
import EpisodeGrid from "./EpisodeGrid";
import { useT } from "../i18n";
import { UNLOCK_ALL_COST } from "../store/defaults";

interface Props {
  visible: boolean;
  title: string;
  episodes: Episode[];
  unlocked: number[];
  activeNumber: number;
  onClose: () => void;
  onSelect: (number: number) => void;
  onUnlockAll: () => void;
}

export default function EpisodesDrawer({
  visible,
  title,
  episodes,
  unlocked,
  activeNumber,
  onClose,
  onSelect,
  onUnlockAll,
}: Props) {
  const { t } = useT();
  const hasLocks = episodes.some((e) => !e.isFree); // hide Unlock All when nothing is locked
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <Pressable className="bg-surface rounded-t-2xl border-t border-white/5 max-h-[75%]">
          <View className="w-12 h-1 bg-surface-line rounded-full self-center my-3" />
          <View className="flex-row justify-between items-center px-5 pb-3 border-b border-white/5">
            <View>
              <Text className="text-white font-display uppercase tracking-wider text-sm">
                {t("watch.episodesSelection")}
              </Text>
              <Text className="text-ink/50 text-[10px] mt-0.5">
                {title} • {t("watch.season")}
              </Text>
            </View>
            {hasLocks && (
              <Pressable
                onPress={onUnlockAll}
                className="flex-row items-center bg-brand/10 border border-brand/30 px-3 py-1.5 rounded-lg"
              >
                <Zap size={14} color="#E50914" fill="#E50914" />
                <Text className="text-brand text-xs font-sans-bold ml-1">
                  {t("watch.unlockAll")} ({UNLOCK_ALL_COST} 🪙)
                </Text>
              </Pressable>
            )}
          </View>
          <ScrollView className="py-4">
            <EpisodeGrid
              episodes={episodes}
              unlocked={unlocked}
              activeNumber={activeNumber}
              onPress={onSelect}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
