// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../ui/App";
import { GameStoreContext } from "../ui/useGame";
import type { GameStore } from "../game/store";
import { createTestStore } from "../testing/world";

/**
 * Covers the sim -> store -> React path. The three.js renderer is not exercised
 * here: jsdom has no WebGL, and keeping the renderer out of React's tree is
 * precisely what makes this testable.
 */

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

describe("App", () => {
  it("renders the run's vital statistics", () => {
    const el = mount(createTestStore());
    const stats = el.querySelectorAll("dd");
    expect(el.textContent).toContain("Eden");
    expect(stats[0]?.textContent).toBe("0"); // turn
    expect(stats[1]?.textContent).toBe("1"); // the starting amoeba
    expect(stats[2]?.textContent).toBe("1"); // one species
  });

  it("deals an opening hand", () => {
    const el = mount(createTestStore());
    expect(el.querySelectorAll(".card").length).toBeGreaterThan(0);
  });

  it("advances the simulation when Pass is clicked, and re-renders", () => {
    const store = createTestStore();
    const el = mount(store);
    const button = el.querySelector("button")!;

    act(() => button.click());

    expect(store.getSnapshot().turn).toBe(1);
    expect(el.querySelectorAll("dd")[0]?.textContent).toBe("1");
  });

  it("throws a useful error when rendered without a provider", () => {
    expect(() => {
      const el = document.createElement("div");
      const orphan = createRoot(el);
      act(() => orphan.render(<App />));
    }).toThrow(/GameStoreContext/);
  });

  it("ensures all cards in the hand are twice as tall as they are wide", () => {
    const el = mount(createTestStore());
    const cards = el.querySelectorAll<HTMLElement>(".card");
    expect(cards.length).toBeGreaterThan(0);

    // Check that each card has an aspect ratio of approximately 2:1 (height/width ≈ 2)
    for (const card of cards) {
      const style = getComputedStyle(card);
      
      // Get the declared width and height values
      const width = style.width;
      const height = style.height;
      
      // Parse numeric values from the declared styles
      const widthNum = parseFloat(width);
      const heightNum = parseFloat(height);
      
      // Assert that both dimensions are valid numbers and check the ratio
      expect(widthNum).toBeGreaterThan(0);
      expect(heightNum).toBeGreaterThan(0);
      expect(heightNum / widthNum).toBeCloseTo(2, 1); // Allow for small rounding differences
    }
  });
});
