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
        sans: ["Inter_400Regular"],
        "sans-bold": ["Inter_700Bold"],
        display: ["Montserrat_800ExtraBold"],
      },
    },
  },
  plugins: [],
};
