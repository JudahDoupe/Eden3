import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGameStore } from "./game/store";
import { createRenderer } from "./render/renderer";
import { DEFAULT_CONFIG } from "./sim/world";
import { App } from "./ui/App";
import { GameStoreContext } from "./ui/useGame";

/**
 * Composition root: the one place that knows about all four layers at once.
 */
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const root = document.getElementById("ui") as HTMLElement;

const store = createGameStore(DEFAULT_CONFIG);
const renderer = createRenderer(canvas, DEFAULT_CONFIG);

// The renderer redraws on phase changes only; the animation loop it owns keeps
// the camera responsive in between.
renderer.sync(store.world);
store.subscribe(() => renderer.sync(store.world));

createRoot(root).render(
  <StrictMode>
    <GameStoreContext.Provider value={store}>
      <App />
    </GameStoreContext.Provider>
  </StrictMode>,
);
