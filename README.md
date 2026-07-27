# Eden

A card-based roguelike wrapped around an ecosystem simulation. You play as
evolution: your deck is made of **mutation cards** (algae, fish, fungus, tree,
bird…), the world is a **voxel grid** where many species share each voxel, and
the simulation runs autonomously between your plays.

Play a mutation onto a species and it **branches a new species** off it — the
parent survives, so runs build an evolutionary tree. Win by playing your whole
deck. Lose to total extinction, or to deadlock when no card can be legally
played for too long.

Built with [React](https://react.dev) (UI), [three.js](https://threejs.org)
(rendering), and [koota](https://github.com/pmndrs/koota) (ECS simulation state),
bundled by [Vite](https://vitejs.dev).

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## Check

```bash
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run build      # production bundle → dist/
```

## Deploy (Docker)

Multi-stage build (Node → nginx) serving the static bundle:

```bash
docker compose up --build   # http://localhost:8092
```

## Layout

Dependencies flow strictly one way. **The simulation never imports three.js or
React**, so the visualization can be replaced without touching game logic. This
is enforced by `src/architecture.test.ts`, not by convention.

```
src/
  sim/        imports: koota      — headless, deterministic, runs in bare node
  game/       imports: sim        — deck, hand, legality, win/lose
  render/     imports: sim, three — reads world state, never mutates it
  ui/         imports: game       — React DOM overlay
  main.tsx    composition root
```

Notable pieces:

- `src/sim/rng.ts` — seeded RNG. Every random decision flows through it; nothing
  under `sim/` or `game/` may call `Math.random()`, or runs stop being reproducible.
- `src/sim/bitmask.ts` — named bit flags backing both species tags and action
  ids. Its `missing()` is what lets the UI say *which* tag gates an action out.
- `src/sim/tags.ts` — the tag vocabulary. Tags gate card targeting, gate which
  actions a species can perform, and describe prey to predators.
- `src/game/store.ts` — the only bridge between sim and UI. React subscribes to a
  version counter via `useSyncExternalStore` and re-renders once per turn, never
  per frame.

Tests run in a `node` environment by default, which is what keeps `sim/` and
`game/` honest. UI tests opt into a DOM with a `// @vitest-environment jsdom`
docblock.

The Vite `base` (public-URL prefix) is set at build time via `--base`, so the same
app can be published at `/` or under a preview path like `/dev/`.
