import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "#E2E8F0",
        shell: "#F8FAFC",
        surface: "#FFFFFF",
        subtle: "#F1F5F9",
        primary: "#0F172A",
        secondary: "#64748B",
        accent: "#2563EB",
        success: "#16A34A",
        warning: "#D97706",
        critical: "#DC2626"
      }
    }
  },
  plugins: []
};

export default config;
