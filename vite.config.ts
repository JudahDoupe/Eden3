import { defineConfig } from "vite";

// The build `base` (public URL prefix) is intentionally left to the CLI so the
// orchestrator can publish the same app under `/` (prod slot) and `/dev/` (the
// PR-preview slot) with `vite build --base=/dev/`. Locally it defaults to `/`.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});
