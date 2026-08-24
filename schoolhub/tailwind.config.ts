import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce7fd",
          200: "#c0d3fb",
          300: "#94b5f8",
          400: "#618df2",
          500: "#3d68ec",
          600: "#2749e0",
          700: "#1f38ce",
          800: "#2030a7",
          900: "#1f2e84",
          950: "#171f52"
        }
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)"
      },
      keyframes: {
        "slide-in": {
          from: { transform: "translateX(120%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" }
        },
        "fade-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" }
        }
      },
      animation: {
        "slide-in": "slide-in .25s ease-out",
        "fade-up": "fade-up .25s ease-out"
      }
    }
  },
  plugins: []
};
export default config;
