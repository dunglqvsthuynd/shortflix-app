import { Modal, View, Text, Pressable } from "react-native";
import { Lock } from "lucide-react-native";
import { useT } from "../i18n";
import { UNLOCK_ONE_COST } from "../store/defaults";

interface Props {
  visible: boolean;
  episodeNumber: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function UnlockModal({ visible, episodeNumber, onCancel, onConfirm }: Props) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} className="flex-1 bg-black/70 items-center justify-center">
        <Pressable className="bg-surface border border-white/10 rounded-2xl p-6 w-[85%] max-w-sm items-center">
          <View className="w-12 h-12 rounded-full bg-brand/20 border border-brand/50 items-center justify-center mb-4">
            <Lock size={20} color="#E50914" />
          </View>
          <Text className="text-white font-display uppercase tracking-wider mb-2">
            {t("unlock.title")} {episodeNumber}
          </Text>
          <Text className="text-ink/70 text-xs text-center mb-5 leading-relaxed">{t("unlock.body")}</Text>
          <View className="flex-row gap-3 w-full">
            <Pressable onPress={onCancel} className="flex-1 py-3 bg-surface-2 rounded-xl items-center">
              <Text className="text-ink text-xs font-sans-bold">{t("unlock.cancel")}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} className="flex-1 py-3 bg-brand rounded-xl items-center">
              <Text className="text-white text-xs font-sans-bold">
                {t("unlock.confirm")} ({UNLOCK_ONE_COST} 🪙)
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
