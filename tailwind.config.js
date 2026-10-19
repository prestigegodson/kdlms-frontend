import defaultTheme from "tailwindcss/defaultTheme";
import plugin from "tailwindcss/plugin";

/*
 * Pinned to Tailwind 3.4: v4's output (oklch palette, color-mix() opacity,
 * @layer/@property) doesn't parse on the older kids' tablets schools use, so
 * the app showed index.html's "Please update your browser" gate. Don't upgrade
 * to v4 without re-checking package.json's "browserslist" floor.
 *
 * Design tokens follow /style_guide.md - the source of record for all
 * frontend styling (see CLAUDE.md's Frontend Design System section).
 *
 * The guide's neutral ramp (slate) and semantic colors (success/warning/
 * error/info) are Tailwind's built-in slate/green-600/amber-600/red-600/
 * blue-600, so only brand (indigo) and accent (amber CTA) need custom stops.
 * Brand runs 50/100/200/400/500/600/800 per the guide - there is no 700 stop;
 * hover states use 600, text-on-tint uses 800.
 */
const brand = {
  50: "#eef1fc",
  100: "#d6ddf8",
  200: "#aebaf1",
  400: "#5d75e3",
  500: "#3b4fd9",
  600: "#2f3fae",
  800: "#182057",
};

/*
 * Accent amber is reserved for the one key CTA per view (style_guide.md
 * §3/§5) - never for status/warning, which stays on the semantic amber-600
 * (Tailwind's default `amber` scale) as a tint, not a fill.
 */
const accent = {
  50: "#fff7e6",
  100: "#fdecc4",
  200: "#fbd888",
  300: "#f9c44d",
  500: "#f59e0b",
  600: "#c47d08",
  800: "#623e04",
};

/* controls (inputs/buttons) 6px, panels (alerts/menus) 8px, cards/modals 12px */
const radius = { control: "6px", panel: "8px", card: "12px" };

/*
 * MobileTabBar's touch-row height, below `lg` only. Registered as spacing so
 * `h-tabbar`/`bottom-tabbar`/`pb-tabbar-safe` generate as first-class
 * utilities rather than fragile arbitrary values. `-safe` bakes in the bottom
 * safe-area inset for consumers that sit above the bar itself (PortalShell's
 * <main>); the bar's own padding uses the inset directly.
 */
const spacing = {
  tabbar: "3.5rem",
  "tabbar-safe": "calc(3.5rem + env(safe-area-inset-bottom))",
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  future: {
    // v4 behaviour: `hover:` only applies on devices that can hover, so a tap
    // on a tablet doesn't leave hover styles stuck on.
    hoverOnlyWhenSupported: true,
  },
  theme: {
    screens: {
      ...defaultTheme.screens,
      /*
       * Mobile chrome boundary (mobile-plan.md "Two boundaries"): below `lg`
       * (1024px) the sidebar becomes a bottom tab bar + app bar. The density
       * boundary is `md` (767.98px, just below Tailwind's `md`), named here so
       * feature code never repeats the literal - matches index.css's
       * `.responsive-table` query. A screen (listed last) rather than a plain
       * variant so its rules are emitted after `sm:`/`md:` and win the
       * 640-767px overlap, as v4's @custom-variant did.
       */
      mobile: { raw: "(max-width: 767.98px)" },
    },
    extend: {
      colors: { brand, accent },
      fontFamily: {
        sans: ['"Inter Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Lexend Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: radius,
      spacing,
      // The code was written against v4's defaults, which differ from v3's -
      // these keep the rendered result identical.
      borderColor: { DEFAULT: "currentColor" },
      ringWidth: { DEFAULT: "1px" },
      ringColor: { DEFAULT: "currentColor" },
      boxShadow: {
        "2xs": "0 1px rgb(0 0 0 / 0.05)",
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        sm: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [
    plugin(({ addVariant, addBase }) => {
      /*
       * A non-min-width screen (`mobile` above) switches off v3's built-in
       * `max-*` variants, so the ones in use are re-added with v3's own
       * definitions. Plugin variants sort before the screens, as `max-*` did.
       */
      addVariant("max-sm", `@media not all and (min-width: ${defaultTheme.screens.sm})`);
      addVariant("max-lg", `@media not all and (min-width: ${defaultTheme.screens.lg})`);

      // v3 doesn't expose theme values as CSS variables the way v4's @theme
      // did, but index.css and a few inline styles read them via var().
      const vars = {};
      for (const [k, v] of Object.entries(brand)) vars[`--color-brand-${k}`] = v;
      for (const [k, v] of Object.entries(accent)) vars[`--color-accent-${k}`] = v;
      for (const [k, v] of Object.entries(radius)) vars[`--radius-${k}`] = v;
      for (const [k, v] of Object.entries(spacing)) vars[`--spacing-${k}`] = v;
      addBase({ ":root": vars });
    }),
  ],
};
