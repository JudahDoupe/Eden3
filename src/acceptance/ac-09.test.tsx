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

  it("displays play and pass buttons side by side", () => {
    const el = mount(createTestStore());
    const buttons = el.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    
    // Find the play and pass buttons
    const playButton = Array.from(buttons).find(b => b.textContent?.includes("Play"));
    const passButton = Array.from(buttons).find(b => b.textContent?.includes("Pass"));
    
    expect(playButton).toBeDefined();
    expect(passButton).toBeDefined();
    
    // Check they are side by side (same parent, adjacent siblings)
    const playParent = playButton?.parentElement;
    const passParent = passButton?.parentElement;
    
    expect(playParent).toBe(passParent);
    
    const siblings = Array.from(playParent?.children || []);
    const playIndex = siblings.indexOf(playButton!);
    const passIndex = siblings.indexOf(passButton!);
    
    expect(Math.abs(playIndex - passIndex)).toBe(1);
  });
});