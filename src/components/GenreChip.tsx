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
      // hitSlop widens the touch target well beyond the small pill so chips are easy to tap.
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
      className={`px-4 py-2.5 rounded-full mr-2 border justify-center ${
        active ? "bg-brand border-brand" : "bg-surface-2 border-white/5"
      }`}
    >
      {/* Roomy lineHeight + includeFontPadding so Vietnamese diacritics ("Tất cả",
          "Lồng tiếng") aren't clipped top/bottom inside the line box. */}
      <Text
        style={{ lineHeight: 20, includeFontPadding: true }}
        className={`text-xs font-sans-bold ${active ? "text-white" : "text-ink/70"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
