import { describe, expect, it } from "vitest";
import { defineFlags } from "./bitmask";
import { ActionIds } from "./actions/ids";
import { Tags } from "./tags";

describe("defineFlags", () => {
  const Colors = defineFlags(["RED", "GREEN", "BLUE"] as const);

  it("assigns one distinct bit per name in declaration order", () => {
    expect(Colors.bit.RED).toBe(1);
    expect(Colors.bit.GREEN).toBe(2);
    expect(Colors.bit.BLUE).toBe(4);
  });

  it("combines and decomposes masks", () => {
    const mask = Colors.mask("RED", "BLUE");
    expect(Colors.toNames(mask)).toEqual(["RED", "BLUE"]);
    expect(Colors.maskOf(["RED", "BLUE"])).toBe(mask);
  });

  it("requires every bit for has(), any bit for hasAny()", () => {
    const mask = Colors.mask("RED", "GREEN");
    expect(Colors.has(mask, Colors.mask("RED", "GREEN"))).toBe(true);
    expect(Colors.has(mask, Colors.mask("RED", "BLUE"))).toBe(false);
    expect(Colors.hasAny(mask, Colors.mask("RED", "BLUE"))).toBe(true);
    expect(Colors.hasAny(mask, Colors.mask("BLUE"))).toBe(false);
  });

  it("has() and hasAny() treat an empty requirement as satisfied/unsatisfied", () => {
    expect(Colors.has(0, 0)).toBe(true);
    expect(Colors.hasAny(Colors.mask("RED"), 0)).toBe(false);
  });

  it("names exactly the missing bits — the explain-mode contract", () => {
    const held = Colors.mask("RED");
    expect(Colors.missing(held, Colors.mask("RED", "GREEN", "BLUE"))).toEqual(["GREEN", "BLUE"]);
    expect(Colors.missing(held, Colors.mask("RED"))).toEqual([]);
  });

  it("rejects duplicates and oversized sets", () => {
    expect(() => defineFlags(["A", "B", "A"] as const)).toThrow(/duplicate/);
    const tooMany = Array.from({ length: 32 }, (_, i) => `F${i}`);
    expect(() => defineFlags(tooMany)).toThrow(/31-bit/);
  });
});

describe("game vocabularies", () => {
  it("keeps tags and action ids within the bit budget", () => {
    expect(Tags.names.length).toBeLessThanOrEqual(31);
    expect(ActionIds.names.length).toBeLessThanOrEqual(31);
  });

  it("gates an action on its required tags", () => {
    // The rule the whole action registry rests on: a species that has lost
    // AQUATIC can never SWIM, whether or not it still owns the action.
    const swimRequires = Tags.mask("AQUATIC", "MOTILE");
    const landlocked = Tags.mask("TERRESTRIAL", "MOTILE");
    expect(Tags.has(landlocked, swimRequires)).toBe(false);
    expect(Tags.missing(landlocked, swimRequires)).toEqual(["AQUATIC"]);
  });
});
