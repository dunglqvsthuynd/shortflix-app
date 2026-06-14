import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Localization from "expo-localization";
import { useFonts, Inter_400Regular, Inter_700Bold } from "@expo-google-fonts/inter";
import { Montserrat_800ExtraBold } from "@expo-google-fonts/montserrat";
import { AppStoreProvider, useStore } from "../src/store/AppStore";
import { LanguageProvider } from "../src/i18n";
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
    </LanguageProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_700Bold, Montserrat_800ExtraBold });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppStoreProvider>
          <Inner />
        </AppStoreProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
