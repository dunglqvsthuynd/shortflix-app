import { Pressable, Text } from "react-native";
import { Coins, Check } from "lucide-react-native";
import { CheckInDay } from "../types";
import { useT } from "../i18n";

export default function CheckInCard({ day, onClaim }: { day: CheckInDay; onClaim: () => void }) {
  const { t } = useT();
  return (
    <Pressable
      onPress={() => !day.isClaimed && onClaim()}
      className={`w-[30%] m-[1.5%] aspect-square rounded-2xl items-center justify-center border ${
        day.isClaimed
          ? "bg-surface border-white/5 opacity-60"
          : day.isSpecial
          ? "bg-brand/15 border-brand/40"
          : "bg-surface-2 border-white/10"
      }`}
    >
      <Text className="text-ink/60 text-[10px] mb-1">
        {t("rewards.day")} {day.day}
      </Text>
      {day.isClaimed ? (
        <Check size={22} color="#22c55e" />
      ) : (
        <Coins size={22} color={day.isSpecial ? "#E50914" : "#e5e2e1"} />
      )}
      <Text className={`font-display text-sm mt-1 ${day.isSpecial ? "text-brand" : "text-ink"}`}>
        +{day.coins}
      </Text>
    </Pressable>
  );
}
