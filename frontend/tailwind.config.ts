import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#E8F0EB",
          100: "#C9DDD0",
          200: "#A5C6AF",
          300: "#7FAE8C",
          400: "#5A9670",
          500: "#2D7D5A",
          600: "#1B5E3F",
          700: "#154A32",
          800: "#0F3624",
          900: "#082217",
        },
        cream: {
          50:  "#FBF9F2",
          100: "#F7F4E9",
          200: "#EFEAD8",
          300: "#E3DCC4",
          400: "#D9D2BC",
          500: "#C5BCA0",
          600: "#A89E82",
        },
        semantic: {
          success: "#2D7D5A",
          danger:  "#C53030",
          warning: "#D69E2E",
          info:    "#2C5282",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted:   "#FBF9F2",
          subtle:  "#F7F4E9",
          border:  "#E3DCC4",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 2px 8px rgba(27, 94, 63, 0.06)",
        elevated: "0 4px 16px rgba(27, 94, 63, 0.10)",
      },
    },
  },
  plugins: [],
};
export default config;