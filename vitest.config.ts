import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` ships a no-op `empty.js` for the `react-server`
      // condition, but Vitest evaluates module code under Node (no
      // `react-server` condition) so the default `index.js` runs and throws
      // on import. Point straight at the no-op so server-only files load
      // cleanly under tests.
      "server-only": path.resolve(
        __dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
});
