import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "#E8E7E4",
        shell: "#F5F4F2",
        surface: "#FFFFFF",
        subtle: "#FDE9D9",
        primary: "#1A1A18",
        secondary: "#9B9B96",
        accent: "#F26522",
        accentPressed: "#D94F0A",
        success: "#16A34A",
        warning: "#F7931A",
        critical: "#DC2626",
        mist: "#E8E7E4",
        stone: "#9B9B96",
        blush: "#FDE9D9",
        ember: "#D94F0A"
      }
    }
  },
  plugins: []
};

export default config;
