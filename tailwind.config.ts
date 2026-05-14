import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8EC",
        peach: "#FFC9B8",
        sakura: "#FFDCE8",
        mint: "#BFEEDB",
        honey: "#FFD36E",
        cocoa: "#7A5342",
        berry: "#F38BB5",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(122, 83, 66, 0.14)",
        float: "0 12px 28px rgba(243, 139, 181, 0.20)",
      },
      fontFamily: {
        rounded: ["var(--font-nunito)", "var(--font-noto-jp)", "ui-rounded", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        app: "radial-gradient(circle at top left, #FFE6F0 0, transparent 32%), radial-gradient(circle at 88% 12%, #D8F7EA 0, transparent 28%), linear-gradient(180deg, #FFF8EC 0%, #FFF1F6 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
