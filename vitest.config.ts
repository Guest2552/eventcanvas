import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      // `server-only` throws outside the React server bundle; tests import server modules directly
      "server-only": src("./node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // A couple of workers is plenty; more just contend for disk while booting jsdom
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts", "src/components/**/*.tsx"],
      exclude: ["src/components/ui/**", "**/*.test.*", "src/lib/types.ts"],
      reporter: ["text-summary", "html"],
    },
  },
});
