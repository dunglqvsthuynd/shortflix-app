import { View, Text, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../src/store/AppStore";
import { useT } from "../src/i18n";
import LanguageSwitch from "../src/components/LanguageSwitch";

export default function Settings() {
  const { state, dispatch } = useStore();
  const { t } = useT();
  const insets = useSafeAreaInsets();

  const confirmReset = () =>
    Alert.alert(t("settings.title"), t("settings.resetConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: () => {
          dispatch({ type: "reset" });
          router.replace("/(tabs)");
        },
      },
    ]);

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top + 12 }}>
      <View className="flex-row items-center px-5 mb-6">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-surface-2 items-center justify-center mr-3"
        >
          <ArrowLeft size={20} color="#e5e2e1" />
        </Pressable>
        <Text className="text-ink text-xl font-display">{t("settings.title")}</Text>
      </View>

      <View className="px-5">
        <Text className="text-ink/50 text-xs mb-2 uppercase tracking-wider">{t("settings.language")}</Text>
        <LanguageSwitch value={state.language} onChange={(l) => dispatch({ type: "setLanguage", lang: l })} />

        <Pressable
          onPress={confirmReset}
          className="mt-8 py-4 bg-surface rounded-2xl border border-white/5 items-center"
        >
          <Text className="text-brand font-sans-bold text-sm">{t("settings.reset")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
