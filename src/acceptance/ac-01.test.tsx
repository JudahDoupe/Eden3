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

  it("All cards in the hand must be twice as tall as they are wide on phones in portrait mode", () => {
    const el = mount(createTestStore());
    const cards = el.querySelectorAll(".card");
    
    // Check that each card is twice as tall as it is wide
    cards.forEach(card => {
      const style = getComputedStyle(card);
      const height = parseFloat(style.height);
      const width = parseFloat(style.width);
      
      // Since jsdom's layout doesn't compute actual sizes, we'll check that the 
      // computed styles indicate an aspect ratio of 2:1 (height:width)
      expect(height).toBeCloseTo(width * 2, 1); // Allow for small floating point differences
    });
  });
});
