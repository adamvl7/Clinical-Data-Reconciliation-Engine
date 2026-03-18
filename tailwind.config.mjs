/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        onye: {
          50: "#F0FDF9",
          100: "#CCFBEE",
          200: "#9AF5DD",
          300: "#5FE8C9",
          400: "#2FD4B2",
          500: "#14B8A6",
          600: "#0A9989",
          700: "#0D7D71",
          800: "#10635B",
          900: "#12524C",
        },
        coral: "#E05A4E",
      },
    },
  },
  plugins: [],
};

export default config;
