import { describe, expect, it } from "vitest";
import { inspectVoxel } from "./inspect";
import { RESOURCE_KEYS } from "../sim/resources";
import { Resources } from "../sim/traits";
import { createSimWorld, getGrid, voxelAt } from "../sim/world";

describe("inspectVoxel", () => {
  it("reports coordinates matching the requested index", () => {
    const world = createSimWorld({ seed: 3 });
    const grid = getGrid(world);
    const index = grid.indexOf(2, 1, 3);

    const info = inspectVoxel(world, index)!;
    expect(info.index).toBe(index);
    expect(info.coords).toEqual({ x: 2, y: 1, z: 3 });
  });

  it("names the terrain and reports every resource", () => {
    const world = createSimWorld({ seed: 3 });
    const info = inspectVoxel(world, getGrid(world).indexOf(0, 0, 0))!;

    expect(info.terrain).toBe("ROCK");
    for (const key of RESOURCE_KEYS) {
      expect(typeof info.resources[key]).toBe("number");
      expect(typeof info.baseline[key]).toBe("number");
    }
  });

  it("returns a copy, so the UI cannot write through to the simulation", () => {
    const world = createSimWorld({ seed: 3 });
    const index = getGrid(world).indexOf(1, 1, 1);

    const info = inspectVoxel(world, index)!;
    info.resources.nutrients = 999;

    expect(voxelAt(world, index)!.get(Resources)!.nutrients).not.toBe(999);
  });

  it("returns null for an index outside the world", () => {
    const world = createSimWorld({ seed: 3 });
    expect(inspectVoxel(world, 99_999)).toBeNull();
    expect(inspectVoxel(world, -1)).toBeNull();
  });
});
