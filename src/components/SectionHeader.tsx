import { Text, View } from "react-native";

export default function SectionHeader({ title }: { title: string }) {
  return (
    <View className="px-5 mb-3 mt-6">
      <Text className="text-ink text-lg font-sans-bold">{title}</Text>
    </View>
  );
}
