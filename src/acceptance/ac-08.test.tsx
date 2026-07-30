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

describe("ac-08", () => {
  it("deselects a selected card when clicked again", () => {
    const store = createTestStore();
    const el = mount(store);
    const cards = el.querySelectorAll(".card");
    
    // Select the first card
    act(() => cards[0].click());
    
    // Verify the first card is selected (has higher z-index and scale)
    const firstCard = cards[0] as HTMLElement;
    expect(firstCard.style.zIndex).toBe("1000");
    expect(firstCard.style.transform).toContain("scale(2)");
    
    // Click it again to deselect
    act(() => cards[0].click());
    
    // Verify the first card is no longer selected (back to normal z-index and scale)
    expect(firstCard.style.zIndex).toBe("0");
    expect(firstCard.style.transform).toBe("none");
  });
});
