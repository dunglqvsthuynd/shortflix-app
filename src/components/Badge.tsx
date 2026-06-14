import { View, Text } from "react-native";

export default function Badge({ label }: { label: string }) {
  if (!label) return null;
  return (
    <View className="bg-brand px-2 py-0.5 rounded">
      <Text className="text-white text-[9px] font-display uppercase tracking-widest">{label}</Text>
    </View>
  );
}
