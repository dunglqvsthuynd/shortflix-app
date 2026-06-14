import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import CheckInCard from "../../src/components/CheckInCard";

export default function Rewards() {
  const { state, dispatch } = useStore();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-black"
      style={{ paddingTop: insets.top + 12 }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <Text className="text-ink text-2xl font-display px-5">{t("rewards.title")}</Text>
      <Text className="text-ink/50 text-xs px-5 mt-1 mb-2">{t("rewards.subtitle")}</Text>
      <View className="mx-5 my-3 p-4 bg-surface rounded-2xl flex-row items-center justify-between border border-white/5">
        <Text className="text-ink/70 text-sm">{t("profile.wallet")}</Text>
        <Text className="text-brand font-display text-2xl">{state.user.coins} 🪙</Text>
      </View>
      <View className="flex-row flex-wrap px-3.5">
        {state.checkIn.map((d) => (
          <CheckInCard key={d.day} day={d} onClaim={() => dispatch({ type: "claimReward", day: d.day })} />
        ))}
      </View>
    </ScrollView>
  );
}
