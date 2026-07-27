import { describe, expect, it } from "vitest";
import { createGrid } from "./grid";

describe("createGrid", () => {
  const grid = createGrid({ x: 4, y: 3, z: 5 });

  it("counts every voxel", () => {
    expect(grid.count).toBe(60);
  });

  it("round-trips every index through coordinates", () => {
    for (let index = 0; index < grid.count; index++) {
      const { x, y, z } = grid.coordsOf(index);
      expect(grid.indexOf(x, y, z)).toBe(index);
    }
  });

  it("assigns a unique index to every coordinate", () => {
    const seen = new Set<number>();
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < 5; z++)
        for (let x = 0; x < 4; x++) seen.add(grid.indexOf(x, y, z));
    expect(seen.size).toBe(grid.count);
  });

  it("rejects out-of-bounds access rather than wrapping", () => {
    expect(grid.inBounds(-1, 0, 0)).toBe(false);
    expect(grid.inBounds(4, 0, 0)).toBe(false);
    expect(grid.inBounds(3, 2, 4)).toBe(true);
    expect(() => grid.indexOf(4, 0, 0)).toThrow(/outside/);
    expect(() => grid.coordsOf(60)).toThrow(/outside/);
  });

  it("rejects a degenerate grid", () => {
    expect(() => createGrid({ x: 0, y: 1, z: 1 })).toThrow(/>= 1/);
  });

  describe("inRange", () => {
    it("returns the full 26-cell shell at range 1 in open space", () => {
      const big = createGrid({ x: 5, y: 5, z: 5 });
      const centre = big.indexOf(2, 2, 2);
      const neighbours = big.inRange(centre, 1);
      expect(neighbours).toHaveLength(26);
      expect(neighbours).not.toContain(centre);
    });

    it("clips at the world edge", () => {
      const big = createGrid({ x: 5, y: 5, z: 5 });
      // A corner has only the 2x2x2 block minus itself.
      expect(big.inRange(big.indexOf(0, 0, 0), 1)).toHaveLength(7);
    });

    it("grows with range and never repeats an index", () => {
      const big = createGrid({ x: 9, y: 9, z: 9 });
      const neighbours = big.inRange(big.indexOf(4, 4, 4), 2);
      expect(neighbours).toHaveLength(5 ** 3 - 1);
      expect(new Set(neighbours).size).toBe(neighbours.length);
    });
  });

  it("walks a column from the floor upward", () => {
    const column = grid.column(1, 2);
    expect(column).toHaveLength(3);
    expect(column.map((i) => grid.coordsOf(i).y)).toEqual([0, 1, 2]);
    expect(column.every((i) => grid.coordsOf(i).x === 1)).toBe(true);
  });
});
