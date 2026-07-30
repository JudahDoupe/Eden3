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

describe("ac-15", () => {
  it("When a card is selected, it must scale from the bottom edge of the card rather than its center to make it appear to grow taller", () => {
    const store = createTestStore();
    const el = mount(store);
    
    // Get the first card
    const cards = el.querySelectorAll(".card");
    expect(cards.length).toBeGreaterThan(0);
    
    const firstCard = cards[0];
    const initialTransformOrigin = getComputedStyle(firstCard).transformOrigin;
    
    // Select the card
    act(() => {
      firstCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    
    // Check that the card is now selected and scaled
    const selectedCard = el.querySelector(".card--selected");
    expect(selectedCard).not.toBeNull();
    
    // Get the transform origin of the selected card
    const selectedTransformOrigin = getComputedStyle(selectedCard!).transformOrigin;
    
    // Verify it scales from bottom
    expect(selectedTransformOrigin).toBe("bottom");
  });
});
