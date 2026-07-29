import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The acceptance-criteria suite, run SEPARATELY from `npm test`.
 *
 * BuilderBot writes one spec per acceptance criterion into `src/acceptance/` before any implementation
 * exists, so every spec here is red from the moment it is written until its criterion is built. That is
 * the point — an assertion that passes before the feature exists is vacuous — but it means these files
 * cannot be part of the default test run: they would fail the build check for every task in a plan,
 * including tasks that have nothing to do with them.
 *
 * So the orchestrator names the specs it wants explicitly, per task:
 *
 *   npx vitest run --config vitest.acceptance.config.ts src/acceptance/ac-01.test.ts …
 *
 * `jsdom` is the default here (unlike the main config's `node`) because every acceptance spec mounts the
 * app and asserts on the DOM. There is no layout engine in jsdom, so specs assert inline styles,
 * attributes, text, and post-click behaviour — never pixel geometry.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/acceptance/**/*.test.{ts,tsx}"],
  },
});
