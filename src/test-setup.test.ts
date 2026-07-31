// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

/**
 * The acceptance harness's own smoke test.
 *
 * BuilderBot's acceptance specs assert on `getComputedStyle`, and every style this app has lives in
 * `index.html`'s `<style>` block. If the test document does not load it, those specs stop measuring the
 * code and start measuring jsdom's defaults — silently, and in BOTH directions: a criterion about a
 * background goes permanently red (its editor cannot win, whatever it writes), while a criterion about
 * font size goes permanently green (16px beats any threshold) and gets recorded as a proven regression
 * guard that asserts nothing. Job 65079b3b lost a whole run to exactly this, undetected, because
 * nothing anywhere checked that the harness could see a style.
 *
 * This test lives in the ORDINARY suite, not in src/acceptance/ — that directory is excluded from
 * `npm test` and run per-task. `verify()` runs `npm test` on every task, so a harness that goes blind
 * now fails on the first verification of the first task, naming its own cause.
 */
describe("acceptance harness", () => {
  it("applies index.html's stylesheet to the test document", () => {
    const el = document.createElement("div");
    el.className = "card";
    document.body.appendChild(el);

    const style = getComputedStyle(el);
    // Not an assertion about what `.card` currently IS — that changes with every feature. It is an
    // assertion that the rule was seen at all: an unstyled div reports "auto" here, and every numeric
    // assertion built on that parses to NaN.
    expect(style.width).not.toBe("auto");
    expect(Number.isNaN(parseFloat(style.width))).toBe(false);

    el.remove();
  });

  it("reports a real background colour rather than the transparent default", () => {
    const el = document.createElement("div");
    el.className = "card";
    document.body.appendChild(el);

    // "rgba(0, 0, 0, 0)" is what jsdom returns for an element with no matching rule. A spec asserting
    // a colour against a document in that state can never pass.
    expect(getComputedStyle(el).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

    el.remove();
  });
});
