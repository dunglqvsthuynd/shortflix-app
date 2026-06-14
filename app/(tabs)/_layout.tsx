import { Tabs } from "expo-router";
import BottomNav from "../../src/components/BottomNav";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#000" } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="rewards" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
