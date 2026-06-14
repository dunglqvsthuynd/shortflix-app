import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Compass, Gift, User } from "lucide-react-native";
import { COLORS } from "../theme/tokens";
import { useT } from "../i18n";

const TABS = [
  { name: "index", icon: Home, key: "home" },
  { name: "discover", icon: Compass, key: "discover" },
  { name: "rewards", icon: Gift, key: "rewards" },
  { name: "profile", icon: User, key: "profile" },
] as const;

export default function BottomNav({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  return (
    <View
      style={{ paddingBottom: insets.bottom || 8 }}
      className="absolute bottom-0 left-0 right-0 flex-row justify-around items-center pt-2 bg-black/95 border-t border-white/5"
    >
      {state.routes.map((route: any, i: number) => {
        const cfg = TABS.find((tt) => tt.name === route.name);
        if (!cfg) return null;
        const focused = state.index === i;
        const Icon = cfg.icon;
        const color = focused ? COLORS.brand : "rgba(229,226,225,0.45)";
        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            className="items-center justify-center py-1 flex-1"
          >
            <Icon size={22} color={color} />
            <Text className="text-[10px] font-sans-bold mt-0.5" style={{ color }}>
              {t(`nav.${cfg.key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
