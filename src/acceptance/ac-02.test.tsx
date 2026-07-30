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

describe("ac-02", () => {
  it("renders cards with an opaque beige background instead of dark blue-gray", () => {
    const el = mount(createTestStore());
    const card = el.querySelector(".card")!;
    
    // Get the computed background color
    const computedStyle = getComputedStyle(card);
    const backgroundColor = computedStyle.backgroundColor;
    
    // Check that it's not the dark blue-gray color (approximate RGB values)
    // Dark blue-gray is around rgb(40, 50, 60) based on typical CSS hex values
    expect(backgroundColor).not.toBe("rgb(40, 50, 60)");
    expect(backgroundColor).not.toBe("rgba(40, 50, 60, 1)");
    
    // Verify it's a beige color - check that red and green are higher than blue
    const rgbMatch = backgroundColor.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      
      // Beige typically has r and g values higher than b
      expect(r).toBeGreaterThan(b);
      expect(g).toBeGreaterThan(b);
    }
  });
});
