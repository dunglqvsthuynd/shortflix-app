/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#E50914", dark: "#B20710" },
        ink: "#e5e2e1",
        surface: { DEFAULT: "#1c1b1b", 2: "#2a2a2a", line: "#353534" },
      },
      fontFamily: {
        // Be Vietnam Pro renders stacked Vietnamese diacritics cleanly on Android
        // (Inter/Montserrat clip them in tight line boxes).
        sans: ["BeVietnamPro_400Regular"],
        "sans-bold": ["BeVietnamPro_700Bold"],
        display: ["BeVietnamPro_800ExtraBold"],
      },
    },
  },
  plugins: [],
};
