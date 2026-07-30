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
    
    const cards = el.querySelectorAll(".card");
    expect(cards.length).toBeGreaterThan(0);
    
    const firstCard = cards[0];
    const initialComputedStyle = getComputedStyle(firstCard);
    const initialScale = parseFloat(initialComputedStyle.transform?.split(" ")[0].replace("matrix(", "") || "1");
    
    // Click the card to select it
    act(() => firstCard?.click());
    
    const selectedComputedStyle = getComputedStyle(firstCard);
    const finalScale = parseFloat(selectedComputedStyle.transform?.split(" ")[0].replace("matrix(", "") || "1");
    
    expect(finalScale).toBeCloseTo(2, 0.1);
  });
});
