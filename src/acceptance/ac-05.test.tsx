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

describe("ac-05", () => {
  it("When a card is tapped, it should move in front of all other cards and double in size", () => {
    const store = createTestStore();
    const el = mount(store);
    
    const cards = el.querySelectorAll(".card");
    expect(cards.length).toBeGreaterThan(0);
    
    // Click the first card to select it
    act(() => cards[0].click());
    
    // Verify the selected card has double scale and high z-index
    const selectedCard = el.querySelector(".card--selected");
    expect(selectedCard).not.toBeNull();
    
    const computedStyle = getComputedStyle(selectedCard!);
    expect(computedStyle.transform).toContain("scale(2)");
    expect(computedStyle.zIndex).toBe("1000");
    
    // Verify all other cards are behind it (lower z-index)
    for (let i = 1; i < cards.length; i++) {
      const otherCard = cards[i];
      const otherStyle = getComputedStyle(otherCard);
      expect(parseInt(otherStyle.zIndex)).toBeLessThan(1000);
    }
  });
});
