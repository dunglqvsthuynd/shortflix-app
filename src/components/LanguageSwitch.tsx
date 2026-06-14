import { View, Text, Pressable } from "react-native";
import { Language } from "../types";

const OPTIONS: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
];

export default function LanguageSwitch({
  value,
  onChange,
}: {
  value: Language;
  onChange: (l: Language) => void;
}) {
  return (
    <View className="flex-row bg-surface-2 rounded-full p-1">
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            className={`flex-1 py-2.5 rounded-full items-center ${active ? "bg-brand" : ""}`}
          >
            <Text className={`text-xs font-sans-bold ${active ? "text-white" : "text-ink/60"}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
