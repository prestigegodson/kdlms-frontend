// Tailwind 3 runs as a PostCSS plugin (v4's @tailwindcss/vite is gone - see
// tailwind.config.js for why we're on v3). autoprefixer reads package.json's
// "browserslist", the same floor @vitejs/plugin-legacy builds for.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
