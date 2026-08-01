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

  it("All cards in the hand must fit on the screen without requiring scrolling", () => {
    const el = mount(createTestStore());
    const hand = el.querySelector(".hand")!;
    const cards = el.querySelectorAll(".card");

    // Check that all cards are visible within the hand container
    expect(cards.length).toBeGreaterThan(0);
    
    // Get the computed style of the hand container to check its dimensions
    const handStyle = getComputedStyle(hand);
    
    // Check that no card is positioned outside the hand container
    for (const card of cards) {
      const cardStyle = getComputedStyle(card);
      
      // Verify that the card's position is within the hand bounds
      expect(cardStyle.left).not.toBe("auto");
      expect(cardStyle.top).not.toBe("auto");
      
      // Instead of parsing, assert on the raw string values
      const leftValue = cardStyle.left;
      const topValue = cardStyle.top;
      
      // Check that left and top are valid numeric values (not auto or invalid)
      expect(leftValue).toMatch(/^[0-9]+px$/);
      expect(topValue).toMatch(/^[0-9]+px$/);
      
      // Check that the card's position is within the hand container
      const leftNum = parseFloat(leftValue);
      const topNum = parseFloat(topValue);
      const widthNum = parseFloat(cardStyle.width);
      const heightNum = parseFloat(cardStyle.height);
      
      expect(leftNum).toBeGreaterThanOrEqual(parseFloat(handStyle.left));
      expect(leftNum + widthNum).toBeLessThanOrEqual(
        parseFloat(handStyle.left) + parseFloat(handStyle.width)
      );
      expect(topNum).toBeGreaterThanOrEqual(parseFloat(handStyle.top));
      expect(topNum + heightNum).toBeLessThanOrEqual(
        parseFloat(handStyle.top) + parseFloat(handStyle.height)
      );
    }
  });
});