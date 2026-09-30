/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        asphalt: "#0F1F38",
        trader: "#0050D0",
        signal: "#D92D20",
        lot: "#F2F3F5",
        line: "#E2E5EA",
        success: "#12805C",
        warn: "#B54708",
        pending: "#175CD3"
      },
      fontFamily: { sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] }
    }
  },
  plugins: []
};
