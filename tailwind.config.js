/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./apps/web/index.html",
    "./apps/web/src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    screens: {
      xs: "420px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1440px"
    },
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.25rem",
        lg: "1.5rem",
        xl: "2rem",
        "2xl": "2.5rem"
      }
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        display: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "Liberation Mono", "monospace"]
      },
      colors: {
        canvas: "rgb(6 9 18 / <alpha-value>)",
        surface: "rgb(9 13 25 / <alpha-value>)",
        panel: "rgb(13 19 35 / <alpha-value>)",
        elevated: "rgb(18 26 45 / <alpha-value>)",
        overlay: "rgb(2 6 23 / <alpha-value>)",
        line: "rgb(51 65 85 / <alpha-value>)",
        strongLine: "rgb(100 116 139 / <alpha-value>)",
        ink: "rgb(241 245 249 / <alpha-value>)",
        muted: "rgb(148 163 184 / <alpha-value>)",
        faint: "rgb(100 116 139 / <alpha-value>)",
        inverse: "rgb(15 23 42 / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(167 139 250 / <alpha-value>)",
          soft: "rgb(46 31 91 / <alpha-value>)",
          strong: "rgb(124 58 237 / <alpha-value>)"
        },
        aurora: {
          DEFAULT: "rgb(34 211 238 / <alpha-value>)",
          soft: "rgb(8 51 68 / <alpha-value>)",
          strong: "rgb(103 232 249 / <alpha-value>)"
        },
        proof: {
          DEFAULT: "rgb(52 211 153 / <alpha-value>)",
          soft: "rgb(6 78 59 / <alpha-value>)",
          strong: "rgb(167 243 208 / <alpha-value>)"
        },
        review: {
          DEFAULT: "rgb(251 191 36 / <alpha-value>)",
          soft: "rgb(69 45 10 / <alpha-value>)",
          strong: "rgb(253 230 138 / <alpha-value>)"
        },
        flag: {
          DEFAULT: "rgb(251 146 60 / <alpha-value>)",
          soft: "rgb(67 32 7 / <alpha-value>)",
          strong: "rgb(254 215 170 / <alpha-value>)"
        },
        block: {
          DEFAULT: "rgb(251 113 133 / <alpha-value>)",
          soft: "rgb(76 5 25 / <alpha-value>)",
          strong: "rgb(254 205 211 / <alpha-value>)"
        }
      },
      fontSize: {
        "display-2xl": ["4.5rem", { lineHeight: "0.95", letterSpacing: "0", fontWeight: "800" }],
        "display-xl": ["3.75rem", { lineHeight: "1", letterSpacing: "0", fontWeight: "800" }],
        "display-lg": ["3rem", { lineHeight: "1.05", letterSpacing: "0", fontWeight: "800" }],
        "display-md": ["2.25rem", { lineHeight: "1.1", letterSpacing: "0", fontWeight: "750" }],
        "title-xl": ["1.5rem", { lineHeight: "1.25", letterSpacing: "0", fontWeight: "700" }],
        "title-lg": ["1.25rem", { lineHeight: "1.3", letterSpacing: "0", fontWeight: "700" }],
        "title-md": ["1.125rem", { lineHeight: "1.35", letterSpacing: "0", fontWeight: "650" }],
        "body-lg": ["1rem", { lineHeight: "1.65", letterSpacing: "0" }],
        "body-md": ["0.9375rem", { lineHeight: "1.6", letterSpacing: "0" }],
        "body-sm": ["0.875rem", { lineHeight: "1.55", letterSpacing: "0" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0" }],
        eyebrow: ["0.75rem", { lineHeight: "1.2", letterSpacing: "0", fontWeight: "700" }]
      },
      borderRadius: {
        xs: "0.375rem",
        sm: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem"
      },
      boxShadow: {
        soft: "0 18px 60px rgb(2 8 23 / 0.18)",
        panel: "0 24px 80px rgb(2 8 23 / 0.26)",
        glow: "0 0 0 1px rgb(34 211 238 / 0.18), 0 20px 70px rgb(124 58 237 / 0.22)",
        "inner-line": "inset 0 1px 0 rgb(255 255 255 / 0.08)"
      },
      backgroundImage: {
        "app-radial":
          "radial-gradient(circle at top left, rgb(124 58 237 / 0.22), transparent 34rem), radial-gradient(circle at top right, rgb(34 211 238 / 0.18), transparent 32rem), linear-gradient(180deg, rgb(6 9 18), rgb(9 13 25))",
        "panel-glass": "linear-gradient(135deg, rgb(255 255 255 / 0.10), rgb(255 255 255 / 0.04))",
        "brand-gradient": "linear-gradient(135deg, rgb(124 58 237), rgb(34 211 238))",
        "proof-gradient": "linear-gradient(135deg, rgb(52 211 153), rgb(34 211 238))",
        "danger-gradient": "linear-gradient(135deg, rgb(251 146 60), rgb(251 113 133))"
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-700px 0" },
          "100%": { backgroundPosition: "700px 0" }
        }
      },
      animation: {
        "fade-up": "fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.8s linear infinite"
      }
    }
  },
  plugins: []
};
