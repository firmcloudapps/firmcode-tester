import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "#E5E7EB",
        shell: "#F7F7F8",
        surface: "#FFFFFF",
        subtle: "#F3F4F6",
        primary: "#111827",
        secondary: "#6B7280",
        accent: "#2563EB",
        accentPressed: "#1D4ED8",
        success: "#16A34A",
        warning: "#D97706",
        critical: "#DC2626",
        mist: "#E5E7EB",
        stone: "#6B7280",
        blush: "#EFF6FF",
        ember: "#2563EB"
      }
    }
  },
  plugins: []
};

export default config;
