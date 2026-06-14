import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";
import { SCRIM_BOTTOM, SCRIM_TOP } from "../theme/tokens";

export function ScrimBottom() {
  return (
    <LinearGradient colors={SCRIM_BOTTOM as any} style={StyleSheet.absoluteFill} pointerEvents="none" />
  );
}

export function ScrimTop({ height = 160 }: { height?: number }) {
  return (
    <LinearGradient
      colors={SCRIM_TOP as any}
      style={[StyleSheet.absoluteFill, { height }]}
      pointerEvents="none"
    />
  );
}
