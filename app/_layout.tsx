import "../global.css";
import { useEffect } from "react";
import { Platform, AppState } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Localization from "expo-localization";
import {
  useFonts,
  BeVietnamPro_400Regular,
  BeVietnamPro_700Bold,
  BeVietnamPro_800ExtraBold,
} from "@expo-google-fonts/be-vietnam-pro";
import { AppStoreProvider, useStore } from "../src/store/AppStore";
import { LanguageProvider } from "../src/i18n";
import { ViCatalogProvider } from "../src/data/catalogVi";
import { Language } from "../src/types";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Inner() {
  const { state, dispatch } = useStore();

  // First launch: adopt device locale if the user hasn't switched away from default.
  useEffect(() => {
    if (state.hydrated && state.language === "en") {
      const code = Localization.getLocales()[0]?.languageCode;
      if (code === "vi") dispatch({ type: "setLanguage", lang: "vi" as Language });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.hydrated]);

  return (
    <LanguageProvider lang={state.language}>
      <ViCatalogProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#000" },
            animation: "fade",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="detail/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="watch/[id]" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="settings" options={{ animation: "slide_from_right" }} />
        </Stack>
      </ViCatalogProvider>
    </LanguageProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_700Bold,
    BeVietnamPro_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Immersive full-screen: hide the Android navigation bar (it stays hidden, swipe from the
  // edge reveals it briefly). The status bar is hidden via <StatusBar hidden /> below.
  // Re-hide on every return-to-foreground — Android re-shows the bar after backgrounding.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const hide = () => NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    hide();
    const sub = AppState.addEventListener("change", (s) => s === "active" && hide());
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <SafeAreaProvider>
        <StatusBar style="light" hidden />
        <AppStoreProvider>
          <Inner />
        </AppStoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
