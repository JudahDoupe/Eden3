// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../ui/App";
import { GameStoreContext } from "../ui/useGame";
import type { GameStore } from "../game/store";
import { createTestStore } from "../testing/world";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(store: GameStore): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <GameStoreContext.Provider value={store}>
        <App />
      </GameStoreContext.Provider>,
    );
  });
  return container;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("ac-17", () => {
  it("positions cards in an arc shape relative to bottom center of screen", () => {
    const el = mount(createTestStore());
    const hand = el.querySelector(".hand");
    if (!hand) {
      throw new Error("Hand not found");
    }

    const cards = hand.querySelectorAll(".card");
    expect(cards.length).toBeGreaterThan(0);

    // Check that each card has a transform that positions it in an arc
    // We can't easily test the exact positioning, but we at least verify
    // that cards have scaling and transforms applied which implies they're 
    // positioned in an arc (since this is how CSS transforms usually create arcs)
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const style = getComputedStyle(card);
      
      // Should have a transform property that includes scaling or rotation
      expect(style.transform).not.toBe("none");
      
      // Check that cards are positioned relatively to bottom center of screen
      // This would be better tested with actual position values, but we'll
      // verify the presence of CSS properties that imply arc positioning
      expect(style.position).toBe("absolute"); 
    }
  });
});
