import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#FBF8F3",
          100: "#F5EFE6",
          200: "#EBE0CF",
          300: "#DECBAE",
        },
        terracotta: {
          400: "#D68A63",
          500: "#C4623A",
          600: "#A94F2D",
          700: "#873D22",
        },
        charcoal: {
          400: "#6B645C",
          500: "#453F39",
          600: "#2B2521",
          700: "#1D1815",
        },
        sage: {
          400: "#9AA98B",
          500: "#7C8B6F",
          600: "#617054",
        },
        clay: {
          50: "#FDF6F2",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(43, 37, 33, 0.04), 0 8px 24px -12px rgba(43, 37, 33, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
