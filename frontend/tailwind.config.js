/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#080a0f",
        coal: "#10131b",
        panel: "#151923",
        line: "#2c3444",
        mint: "#26d9ff",
        cyanish: "#2f6bff",
        amberish: "#ffd166",
        roseish: "#f43fd7"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(0, 0, 0, 0.34)",
        neon: "0 0 26px rgba(38, 217, 255, 0.22), 0 0 46px rgba(244, 63, 215, 0.12)"
      }
    }
  },
  plugins: []
};
