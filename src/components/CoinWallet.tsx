import { View, Text, Pressable } from "react-native";
import { Coins } from "lucide-react-native";
import { useT } from "../i18n";

export default function CoinWallet({ coins, onRecharge }: { coins: number; onRecharge: () => void }) {
  const { t } = useT();
  return (
    <View className="mx-5 p-5 bg-surface rounded-2xl border border-white/5 flex-row items-center justify-between">
      <View className="flex-row items-center">
        <Coins size={26} color="#E50914" />
        <View className="ml-3">
          <Text className="text-ink/50 text-xs">{t("profile.wallet")}</Text>
          <Text className="text-white font-display text-2xl">{coins}</Text>
        </View>
      </View>
      <Pressable onPress={onRecharge} className="bg-brand px-5 py-2.5 rounded-full">
        <Text className="text-white text-xs font-sans-bold">{t("profile.recharge")}</Text>
      </Pressable>
    </View>
  );
}
