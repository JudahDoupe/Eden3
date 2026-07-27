import { describe, expect, it } from "vitest";
import { Rng } from "./rng";

describe("Rng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = Array.from({ length: 32 }, () => new Rng(42).next());
    const b = new Rng(42);
    expect(a[0]).toBe(b.next());

    const first = Array.from({ length: 32 }, () => new Rng(7).next());
    const second = Array.from({ length: 32 }, () => new Rng(7).next());
    expect(first).toEqual(second);
  });

  it("produces different sequences for different seeds", () => {
    const a = Array.from({ length: 16 }, () => 0).map(() => new Rng(1).next());
    const b = Array.from({ length: 16 }, () => 0).map(() => new Rng(2).next());
    expect(a[0]).not.toBe(b[0]);
  });

  it("stays within [0, 1)", () => {
    const rng = new Rng(123);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("bounds int() to [0, maxExclusive) and tolerates an empty range", () => {
    const rng = new Rng(9);
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(rng.int(0)).toBe(0);
  });

  it("shuffles deterministically and preserves membership", () => {
    const items = () => [1, 2, 3, 4, 5, 6, 7, 8];
    const a = new Rng(5).shuffle(items());
    const b = new Rng(5).shuffle(items());
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items());
  });

  it("returns undefined when picking from an empty array", () => {
    expect(new Rng(1).pick([])).toBeUndefined();
  });

  it("round-trips through snapshot/restore", () => {
    const rng = new Rng(77);
    rng.next();
    const state = rng.snapshot();
    const expected = [rng.next(), rng.next(), rng.next()];

    rng.restore(state);
    expect([rng.next(), rng.next(), rng.next()]).toEqual(expected);
  });

  it("forks independent streams that do not disturb the parent", () => {
    const parent = new Rng(11);
    parent.fork();
    const afterFork = parent.next();

    const control = new Rng(11);
    control.next(); // fork() consumes exactly one value
    expect(afterFork).toBe(control.next());
  });
});
