/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// One value per build - a timestamp is enough to tell "different build" from
// "same build", which is all useVersionCheck.ts needs; it doesn't need to be
// a git SHA. Baked into the bundle via `__APP_VERSION__` (define, below) and
// mirrored into dist/version.json by emitVersionFile so a running tab can
// compare its own baked-in value against what the server has now.
const APP_VERSION = new Date().toISOString();

/** Emits `version.json` alongside `index.html` - see useVersionCheck.ts, which polls it, and nginx.conf's `no-store` location for it. */
function emitVersionFile(): Plugin {
  return {
    name: "kdlms-emit-version-file",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version: APP_VERSION }),
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), emitVersionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/actuator": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
