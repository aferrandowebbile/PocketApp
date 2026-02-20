/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        inter: ["Inter_400Regular"],
        "inter-semibold": ["Inter_600SemiBold"],
        "inter-medium": ["Inter_500Medium"]
      },
      boxShadow: {
        card: "0 6px 20px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
