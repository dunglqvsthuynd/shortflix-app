import { Pressable, Text } from "react-native";

export default function GenreChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-full mr-2 border ${
        active ? "bg-brand border-brand" : "bg-surface-2 border-white/5"
      }`}
    >
      <Text className={`text-xs font-sans-bold ${active ? "text-white" : "text-ink/70"}`}>{label}</Text>
    </Pressable>
  );
}
