import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useStore } from "../src/store/AppStore";
import { COLORS } from "../src/theme/tokens";

export default function Splash() {
  const { state } = useStore();
  const [minTime, setMinTime] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTime(true), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (state.hydrated && minTime) router.replace("/(tabs)");
  }, [state.hydrated, minTime]);

  return (
    <View className="flex-1 items-center justify-center bg-black">
      <Text className="text-brand text-5xl font-display tracking-tighter">ShortFlix</Text>
      <Text className="text-ink/40 text-xs mt-2 tracking-[3px]">PREMIUM SHORT DRAMAS</Text>
      <ActivityIndicator color={COLORS.brand} className="mt-8" />
    </View>
  );
}
