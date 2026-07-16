# Eden3

A minimal TypeScript + [three.js](https://threejs.org) game, built with
[Vite](https://vitejs.dev). It renders a single green sphere in the middle of the
screen.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## Check

```bash
npm run typecheck  # tsc --noEmit
npm test           # vitest — asserts the green sphere at the origin
npm run build      # production bundle → dist/
```

## Deploy (Docker)

Multi-stage build (Node → nginx) serving the static bundle:

```bash
docker compose up --build   # http://localhost:8092
```

## Layout

- `src/scene.ts` — `createScene()`, the headless-testable scene factory (green
  sphere, camera, lights). No renderer, so it can be asserted in a unit test.
- `src/main.ts` — owns the `WebGLRenderer`, canvas mount, resize, and animation loop.
- `src/scene.test.ts` — the acceptance test for the green sphere.

The Vite `base` (public-URL prefix) is set at build time via `--base`, so the same
app can be published at `/` or under a preview path like `/dev/`.
