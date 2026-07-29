import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The build `base` (public URL prefix) is intentionally left to the CLI so the
// orchestrator can publish the same app under `/` (prod slot) and `/dev/` (the
// PR-preview slot) with `vite build --base=/dev/`. Locally it defaults to `/`.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // `node` is deliberate: `sim/` and `game/` must stay DOM-free, and running
    // them in a bare environment is what proves it. UI tests opt in per-file
    // with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
    // BuilderBot's acceptance specs (one per acceptance criterion) live in src/acceptance/ and are RED
    // until their criterion is implemented, so they must not fail the ordinary test run. They are
    // executed explicitly, per task, via vitest.acceptance.config.ts.
    exclude: ["**/node_modules/**", "**/dist/**", "src/acceptance/**"],
  },
});
