import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        /** Títulos / autoridade — ConeXai Bento */
        display: ["Lexend", "Space Grotesk", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        /** Nexus 3D — interface clean */
        ui: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        /** Coordenadas, métricas e displays de hardware */
        mono: ["JetBrains Mono", "SF Mono", "ui-monospace", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        grid: {
          free: "hsl(var(--grid-free))",
          occupied: "hsl(var(--grid-occupied))",
          premium: "hsl(var(--grid-premium))",
          hover: "hsl(var(--grid-hover))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        influencer: {
          DEFAULT: "hsl(var(--influencer-primary))",
          muted: "hsl(var(--influencer-muted))",
          surface: "hsl(var(--influencer-surface))",
        },
        /** Nexus 3D — palco e streams */
        stage: {
          void: "hsl(var(--stage-void))",
          deep: "hsl(var(--stage-deep))",
          rim: "hsl(var(--stage-rim))",
        },
        stream: {
          core: "hsl(var(--stream-core))",
          halo: "hsl(var(--stream-halo))",
          alt: "hsl(var(--stream-alt))",
        },
        oled: {
          on: "hsl(var(--oled-on))",
          off: "hsl(var(--oled-off))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        tile: "var(--tile-radius)",
      },
      boxShadow: {
        rest: "var(--shadow-rest)",
        lift: "var(--shadow-lift)",
        panel: "var(--shadow-panel)",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "count-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "cyber-pan": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        "halo-pulse": {
          "0%, 100%": { boxShadow: "0 0 15px hsl(var(--primary) / 0.5)" },
          "50%": { boxShadow: "0 0 30px hsl(var(--primary) / 0.8), 0 0 10px hsl(var(--accent) / 0.5)" },
        },
        /** Nexus 3D */
        "tile-lift": {
          from: { transform: "translate3d(0,0,0) scale(1)" },
          to: { transform: "translate3d(0,-7px,14px) scale(1.015)" },
        },
        "stream-flow": {
          from: { strokeDashoffset: "0" },
          to: { strokeDashoffset: "-48" },
        },
        "ambient-breathe": {
          "0%, 100%": { opacity: "0.72", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.035)" },
        },
        "oled-flicker": {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "94%": { opacity: "0.82" },
          "96%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "count-up": "count-up 0.6s ease-out forwards",
        "cyber-pan": "cyber-pan 10s linear infinite alternate",
        "halo-pulse": "halo-pulse 2s ease-in-out infinite",
        "tile-lift": "tile-lift 320ms cubic-bezier(0.22,1,0.36,1) forwards",
        "stream-flow": "stream-flow 1.4s linear infinite",
        "ambient-breathe": "ambient-breathe 7s ease-in-out infinite",
        "oled-flicker": "oled-flicker 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
