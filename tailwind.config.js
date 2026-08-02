/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: "#2563EB",
        canvas: "#F8FAFC",
        ink: "#0F172A",
      },
    },
  },
  plugins: [],
};
