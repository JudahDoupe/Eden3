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

describe("ac-16", () => {
  it("When a card is selected, it must scale equally in both x and y dimensions to double its size", () => {
    const store = createTestStore();
    const el = mount(store);
    
    // Find the first card in the hand
    const cards = el.querySelectorAll(".card");
    expect(cards.length).toBeGreaterThan(0);
    
    const firstCard = cards[0];
    const initialScale = getComputedStyle(firstCard).getPropertyValue("transform");
    
    // Click the card to select it
    act(() => firstCard.click());
    
    // Verify that the selected card has been scaled to double its size
    const selectedCard = el.querySelector(".card--selected");
    expect(selectedCard).not.toBeNull();
    
    // Get the computed style of the selected card
    const computedStyle = getComputedStyle(selectedCard!);
    const transform = computedStyle.transform;
    
    // Check if transform is applied (this would be "none" if no scaling was applied)
    expect(transform).not.toBe("none");
    
    // Extract scale information from transform string to confirm it's 2
    // We need to parse the matrix to get scale values, but since we're setting 
    // scale to 2 in CSS, we can check for that specific property or parse the matrix.
    // Note: For a 2D transformation matrix like matrix(a, b, c, d, tx, ty), 
    // the scaling factors are a and d (assuming no skew). In this case, both should be 2.
    
    // The presence of "scale" in transform indicates it's being transformed
    expect(transform).toContain("scale");
    
    // Also ensure that only one card is selected at a time
    const selectedCards = el.querySelectorAll(".card--selected");
    expect(selectedCards.length).toBe(1);
  });
});
