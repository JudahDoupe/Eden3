/**
 * Without this flag React 19's `act()` does not flush updates synchronously and
 * merely warns, which lets UI assertions pass against un-rendered output. It is
 * harmless in the node-environment sim tests, so it is set globally.
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Koota caps live worlds at 16 per process; release them between tests.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach } from "vitest";
import { destroyTestWorlds } from "./testing/world";

afterEach(destroyTestWorlds);

/**
 * Load the app's stylesheet into the test document.
 *
 * Every style in this app lives in `index.html`'s `<style>` block, and nothing imports it — no `.css`
 * file exists. A jsdom document that never parsed index.html therefore has no stylesheet at all, so
 * `getComputedStyle` answers with UA defaults for everything: `width` is "auto" (parseFloat → NaN) and
 * `backgroundColor` is "rgba(0, 0, 0, 0)", whatever the CSS says.
 *
 * That silently invalidated every acceptance spec that reads a computed style, which as of
 * 2026-07-31 was all of them. Job 65079b3b is the specimen: t-01's only editable file is index.html,
 * its two criteria assert a computed width ratio and a beige background, and NO edit to index.html
 * could ever have moved them. The fixer spent 14 minutes a round on an unwinnable target and would
 * have spent ~56 before deferring. A third spec (ac-03, "all text is larger") passed instead — jsdom
 * reports a default 16px font-size for every element, so its `> 10px` and `>= 14px` assertions were
 * true no matter what — and was recorded as a proven-green regression guard asserting nothing.
 *
 * jsdom DOES apply the cascade; it just cannot apply a stylesheet it was never given. Guarded on
 * `document` because this file is also the setup for the node-environment suite, where `sim/` and
 * `game/` are required to stay DOM-free.
 */
if (typeof document !== "undefined") {
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
  for (const [, css] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }
}

export {};
