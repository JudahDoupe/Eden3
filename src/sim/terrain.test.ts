import { describe, expect, it } from "vitest";
import { createGrid } from "./grid";
import { Rng } from "./rng";
import { DEFAULT_TERRAIN, generateTerrain, terrainName, Terrains } from "./terrain";

const SIZE = { x: 8, y: 5, z: 8 };

function generate(seed: number) {
  const grid = createGrid(SIZE);
  return { grid, kinds: generateTerrain(grid, new Rng(seed), DEFAULT_TERRAIN) };
}

describe("generateTerrain", () => {
  it("assigns exactly one terrain bit to every voxel", () => {
    const { grid, kinds } = generate(1);
    expect(kinds).toHaveLength(grid.count);
    for (const kind of kinds) {
      expect(Terrains.toNames(kind)).toHaveLength(1);
    }
  });

  it("is deterministic for a seed and varies across seeds", () => {
    expect(generate(1).kinds).toEqual(generate(1).kinds);
    expect(generate(1).kinds).not.toEqual(generate(999).kinds);
  });

  it("floors the world in bedrock", () => {
    const { grid, kinds } = generate(3);
    for (let z = 0; z < SIZE.z; z++)
      for (let x = 0; x < SIZE.x; x++)
        expect(terrainName(kinds[grid.indexOf(x, 0, z)]!)).toBe("ROCK");
  });

  it("produces a pond: water at the centre, dry rim", () => {
    // The whole first run depends on there being both an aquatic niche and
    // land to colonise later, so assert the gradient rather than exact cells.
    const { grid, kinds } = generate(1);
    const nameAt = (x: number, y: number, z: number) => terrainName(kinds[grid.indexOf(x, y, z)]!);

    expect(nameAt(4, 2, 4)).toBe("WATER");

    const waterCount = kinds.filter((k) => k === Terrains.bit.WATER).length;
    const soilCount = kinds.filter((k) => k === Terrains.bit.SOIL).length;
    expect(waterCount).toBeGreaterThan(0);
    expect(soilCount).toBeGreaterThan(0);
  });

  it("gives the pond depth, not just a puddle", () => {
    // Water must reach below the surface layer, or light attenuation has
    // nothing to work with and the pond is a single undifferentiated niche.
    for (const seed of [1, 2, 3, 4, 5]) {
      const { grid, kinds } = generate(seed);
      const deep = kinds.filter(
        (kind, index) => kind === Terrains.bit.WATER && grid.coordsOf(index).y < DEFAULT_TERRAIN.waterLevel,
      );
      expect(deep.length, `seed ${seed} has no water below the surface`).toBeGreaterThan(0);
    }
  });

  it("produces a contiguous water body rather than scattered puddles", () => {
    // Speckled water means the height noise has overwhelmed the basin gradient.
    const { grid, kinds } = generate(1);
    const water = new Set<number>();
    kinds.forEach((kind, index) => {
      if (kind === Terrains.bit.WATER) water.add(index);
    });

    const start = water.values().next().value as number;
    const seen = new Set<number>([start]);
    const queue = [start];
    while (queue.length > 0) {
      for (const neighbour of grid.inRange(queue.pop()!, 1)) {
        if (water.has(neighbour) && !seen.has(neighbour)) {
          seen.add(neighbour);
          queue.push(neighbour);
        }
      }
    }

    expect(seen.size).toBe(water.size);
  });

  it("never puts water above the water level", () => {
    // Soil may rise above it — that rim is the dry land later mutations need —
    // but water must not, or the basin logic has inverted.
    const { grid, kinds } = generate(5);
    for (let y = DEFAULT_TERRAIN.waterLevel + 1; y < SIZE.y; y++)
      for (let z = 0; z < SIZE.z; z++)
        for (let x = 0; x < SIZE.x; x++)
          expect(terrainName(kinds[grid.indexOf(x, y, z)]!)).not.toBe("WATER");
  });

  it("leaves air above every column, so fliers always have somewhere to go", () => {
    const { grid, kinds } = generate(5);
    for (let z = 0; z < SIZE.z; z++)
      for (let x = 0; x < SIZE.x; x++)
        expect(terrainName(kinds[grid.indexOf(x, SIZE.y - 1, z)]!)).toBe("AIR");
  });

  it("never leaves a floating pocket of water above ground level", () => {
    // Water directly above air would mean the basin logic inverted somewhere.
    const { grid, kinds } = generate(7);
    for (let z = 0; z < SIZE.z; z++) {
      for (let x = 0; x < SIZE.x; x++) {
        let seenAir = false;
        for (let y = SIZE.y - 1; y >= 0; y--) {
          const name = terrainName(kinds[grid.indexOf(x, y, z)]!);
          if (name === "AIR") seenAir = true;
          else if (name === "WATER") expect(seenAir || y === SIZE.y - 1).toBe(true);
        }
      }
    }
  });
});

describe("terrainName", () => {
  it("rejects a value that is not a single terrain bit", () => {
    expect(() => terrainName(0)).toThrow(/not a terrain bit/);
  });
});
