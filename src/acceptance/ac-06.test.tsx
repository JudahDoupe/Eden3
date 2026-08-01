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

describe("ac-06", () => {
  it("should move a card in front of all other cards when tapped", () => {
    const store = createTestStore();
    const el = mount(store);
    const cards = el.querySelectorAll<HTMLElement>(".card");

    expect(cards.length).toBeGreaterThan(0);

    // Initially, no card should have the selected class
    for (const card of cards) {
      expect(card.classList.contains("card--selected")).toBe(false);
    }

    // Click on the first card to select it
    act(() => {
      cards[0].click();
    });

    // The first card should now be selected
    expect(cards[0].classList.contains("card--selected")).toBe(true);

    // Check that the z-index of the selected card is higher than others
    const firstCardZIndex = getComputedStyle(cards[0]).zIndex;
    for (let i = 1; i < cards.length; i++) {
      const otherCardZIndex = getComputedStyle(cards[i]).zIndex;
      // Convert string values to numbers for comparison
      const firstZIndexNum = parseInt(firstCardZIndex) || 0;
      const otherZIndexNum = parseInt(otherCardZIndex) || 0;
      expect(firstZIndexNum).toBeGreaterThan(otherZIndexNum);
    }
  });
});