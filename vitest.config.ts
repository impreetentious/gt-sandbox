import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Unit scope: engine and state only. Browser behaviour belongs to the Playwright suite.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/engine/**/*.ts"],
    },
  },
});
