import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { Episode } from "../types";
import EpisodeGrid from "./EpisodeGrid";
import { useT } from "../i18n";

interface Props {
  visible: boolean;
  title: string;
  episodes: Episode[];
  activeNumber: number;
  onClose: () => void;
  onSelect: (number: number) => void;
}

export default function EpisodesDrawer({
  visible,
  title,
  episodes,
  activeNumber,
  onClose,
  onSelect,
}: Props) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/60 justify-end">
        <Pressable className="bg-surface rounded-t-2xl border-t border-white/5 max-h-[75%]">
          <View className="w-12 h-1 bg-surface-line rounded-full self-center my-3" />
          <View className="px-5 pb-3 border-b border-white/5">
            <Text className="text-white font-display uppercase tracking-wider text-sm">
              {t("watch.episodesSelection")}
            </Text>
            <Text className="text-ink/50 text-[10px] mt-0.5">
              {title} • {t("watch.season")}
            </Text>
          </View>
          <ScrollView className="py-4">
            <EpisodeGrid
              episodes={episodes}
              activeNumber={activeNumber}
              onPress={onSelect}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
