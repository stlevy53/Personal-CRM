import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  // The `demo` mode (npm run build:demo) builds for GitHub Pages at
  // stlevy53.github.io/Personal-CRM/ — every other mode serves from root.
  base: mode === "demo" ? "/Personal-CRM/" : "/",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow the container's hot-reload websocket to reach the host browser.
    watch: { usePolling: true },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
}));
