/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0D10",
        panel: "#14171C",
        border: "#262A30",
        accent: "#C9A227",
        "accent-dim": "#9B7B1C",
        "text-primary": "#F5F5F5",
        "text-secondary": "#9CA3AF",
        "square-light": "#F0D9B5",
        "square-dark": "#B58863",
        "square-highlight": "#F6F669",
        "square-selected": "#20B2AA",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
