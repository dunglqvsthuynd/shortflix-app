import { ScrollView, View, Text, Pressable, FlatList } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Settings as SettingsIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../src/store/AppStore";
import { useT } from "../../src/i18n";
import { getMovie } from "../../src/data/catalog";
import { Movie } from "../../src/types";
import CoinWallet from "../../src/components/CoinWallet";
import PosterCard from "../../src/components/PosterCard";

export default function Profile() {
  const { state, dispatch } = useStore();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const favorites = state.favorites
    .map((id) => getMovie(id))
    .filter((m): m is Movie => Boolean(m));

  return (
    <ScrollView
      className="flex-1 bg-black"
      style={{ paddingTop: insets.top + 12 }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      <View className="flex-row items-center justify-between px-5 mb-5">
        <View className="flex-row items-center">
          <Image source={state.user.avatarUrl} style={{ width: 56, height: 56, borderRadius: 28 }} />
          <View className="ml-3">
            <Text className="text-white text-lg font-sans-bold">{state.user.name}</Text>
            <Text className="text-brand text-xs">
              {state.user.isVip ? t("profile.vip") : t("profile.member")}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/settings")}
          className="w-10 h-10 rounded-full bg-surface-2 items-center justify-center"
        >
          <SettingsIcon size={20} color="#e5e2e1" />
        </Pressable>
      </View>

      <CoinWallet coins={state.user.coins} onRecharge={() => dispatch({ type: "addCoins", amount: 100 })} />

      <Text className="text-ink text-lg font-sans-bold px-5 mt-7 mb-3">{t("profile.favorites")}</Text>
      {favorites.length ? (
        <FlatList
          horizontal
          data={favorites}
          keyExtractor={(m) => m.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => <PosterCard movie={item} />}
        />
      ) : (
        <Text className="text-ink/40 text-xs px-5">{t("profile.empty")}</Text>
      )}
    </ScrollView>
  );
}
