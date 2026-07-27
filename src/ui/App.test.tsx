// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { GameStoreContext } from "./useGame";
import { createGameStore, type GameStore } from "../game/store";

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
  it("renders the current turn and phase", () => {
    const el = mount(createGameStore());
    expect(el.textContent).toContain("Eden");
    expect(el.querySelectorAll("dd")[0]?.textContent).toBe("0");
    expect(el.querySelectorAll("dd")[1]?.textContent).toBe("player");
  });

  it("advances the simulation when Pass is clicked, and re-renders", () => {
    const store = createGameStore();
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
});
