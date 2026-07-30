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

describe("ac-14", () => {
  it("defines the opaque beige color for cards using a CSS variable", () => {
    const el = mount(createTestStore());
    const card = el.querySelector(".card");
    expect(card).toBeTruthy();
    
    const computedStyle = getComputedStyle(card!);
    const backgroundColor = computedStyle.backgroundColor;
    
    // Check that the background color is defined as a CSS variable
    // The spec requires that the color be defined via CSS variable for consistent theming
    expect(backgroundColor).toMatch(/var\(--card-bg-color\)/);
  });
});
