import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createGameStore } from "./game/store";
import { createRenderer } from "./render/renderer";
import { App } from "./ui/App";
import { GameStoreContext } from "./ui/useGame";

/**
 * Composition root: the one place that knows about all four layers at once.
 */
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const root = document.getElementById("ui") as HTMLElement;

const store = createGameStore();
const renderer = createRenderer(canvas, store.world);

// The renderer redraws on phase changes only; the animation loop it owns keeps
// the camera responsive in between.
renderer.sync(store.world);
store.subscribe(() => renderer.sync(store.world));

// Hover-to-inspect. The store ignores a selection that did not change, so the
// firehose of pointer events costs at most one React render per voxel crossed.
canvas.addEventListener("pointermove", (event) => {
  store.selectVoxel(renderer.pick(event.clientX, event.clientY));
});
canvas.addEventListener("pointerleave", () => store.selectVoxel(null));

createRoot(root).render(
  <StrictMode>
    <GameStoreContext.Provider value={store}>
      <App />
    </GameStoreContext.Provider>
  </StrictMode>,
);
