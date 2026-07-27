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

/**
 * The renderer redraws on state changes only; the animation loop it owns keeps
 * the camera responsive in between.
 */
function redraw(): void {
  renderer.highlight(store.highlightedVoxels());
  renderer.sync(store.world);
}
redraw();
store.subscribe(redraw);

// Hover-to-inspect. The store ignores a selection that did not change, so the
// firehose of pointer events costs at most one React render per voxel crossed.
canvas.addEventListener("pointermove", (event) => {
  store.selectVoxel(renderer.pick(event.clientX, event.clientY));
});
canvas.addEventListener("pointerleave", () => store.selectVoxel(null));

/**
 * Targeting is diegetic: with a card selected, clicking a highlighted voxel in
 * the world plays it there.
 */
canvas.addEventListener("click", (event) => {
  const cardId = store.getSnapshot().selectedCard;
  if (!cardId) return;

  const voxelIndex = renderer.pick(event.clientX, event.clientY);
  if (voxelIndex === null) return;

  store.play(cardId, voxelIndex);
});

createRoot(root).render(
  <StrictMode>
    <GameStoreContext.Provider value={store}>
      <App />
    </GameStoreContext.Provider>
  </StrictMode>,
);
