import { defineConfig } from "vitest/config";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "./tests/fixtures/empty.js"),
    },
  },
  test: {
    exclude: ["**/tests/**", "**/node_modules/**"],
  },
});
