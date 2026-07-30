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

describe("ac-07", () => {
  it("renders a play button on the right half of the screen's bottom area that is only enabled when a card is selected", () => {
    const store = createTestStore();
    const el = mount(store);
    
    // Find the play button - it should be in the bottom area
    const playButton = el.querySelector("button")?.nextSibling?.nextSibling as HTMLElement;
    
    expect(playButton).not.toBeNull();
    expect(playButton.textContent).toBe("Play");
    
    // Initially, play button should be disabled (because no card is selected)
    expect(playButton.hasAttribute("disabled")).toBe(true);
    
    // Select a card
    const firstCard = el.querySelector(".card");
    if (firstCard) {
      act(() => firstCard.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }
    
    // After selecting a card, play button should be enabled
    expect(playButton.hasAttribute("disabled")).toBe(false);
    
    // Selecting the same card again should disable the play button
    if (firstCard) {
      act(() => firstCard.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }
    
    expect(playButton.hasAttribute("disabled")).toBe(true);
  });
});
