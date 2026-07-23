import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f0",
          100: "#ffdedb",
          200: "#ffc2bd",
          300: "#ff968d",
          400: "#ff5b4d",
          500: "#ff2d1a",
          600: "#e01500",
          700: "#b81100",
          800: "#8f0f00",
          900: "#6b0d00",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
