import { describe, expect, it } from "vitest";
import { createGrid } from "./grid";
import {
  applyEnvironment,
  baselineFor,
  clampResource,
  computeLight,
  MAX_RESOURCE,
  REGEN_RATE,
  RESOURCE_KEYS,
} from "./resources";
import { Terrains } from "./terrain";
import { ResourceBaseline, ResourceDelta, Resources, Voxel } from "./traits";
import { createSimWorld, voxelAt } from "./world";

describe("computeLight", () => {
  const grid = createGrid({ x: 1, y: 4, z: 1 });

  it("gives the top voxel full light", () => {
    const kinds = [Terrains.bit.ROCK, Terrains.bit.WATER, Terrains.bit.WATER, Terrains.bit.AIR];
    expect(computeLight(grid, kinds)[3]).toBe(MAX_RESOURCE);
  });

  it("attenuates through water, so depth creates distinct niches", () => {
    const kinds = [Terrains.bit.ROCK, Terrains.bit.WATER, Terrains.bit.WATER, Terrains.bit.AIR];
    const light = computeLight(grid, kinds);
    // Surface water is bright; the voxel below it is measurably dimmer.
    expect(light[2]!).toBeGreaterThan(light[1]!);
    expect(light[1]!).toBeGreaterThan(0);
  });

  it("blocks light entirely below solid ground", () => {
    const kinds = [Terrains.bit.ROCK, Terrains.bit.SOIL, Terrains.bit.SOIL, Terrains.bit.AIR];
    const light = computeLight(grid, kinds);
    expect(light[1]).toBe(0);
    expect(light[0]).toBe(0);
  });

  it("never exceeds the resource ceiling", () => {
    const kinds = [Terrains.bit.AIR, Terrains.bit.AIR, Terrains.bit.AIR, Terrains.bit.AIR];
    for (const value of computeLight(grid, kinds)) {
      expect(value).toBeLessThanOrEqual(MAX_RESOURCE);
    }
  });
});

describe("baselineFor", () => {
  it("makes water wet and air oxygen-rich", () => {
    expect(baselineFor(Terrains.bit.WATER, 0.5).moisture).toBe(1);
    expect(baselineFor(Terrains.bit.AIR, 1).oxygen).toBeGreaterThan(
      baselineFor(Terrains.bit.WATER, 1).oxygen,
    );
  });

  it("carries the supplied light through", () => {
    expect(baselineFor(Terrains.bit.SOIL, 0.25).light).toBe(0.25);
  });
});

describe("clampResource", () => {
  it("holds values inside [0, MAX]", () => {
    expect(clampResource(-5)).toBe(0);
    expect(clampResource(5)).toBe(MAX_RESOURCE);
    expect(clampResource(0.4)).toBe(0.4);
  });
});

describe("applyEnvironment", () => {
  it("starts every voxel at its baseline, so a run opens settled", () => {
    const world = createSimWorld({ seed: 2 });
    world.query(Resources, ResourceBaseline).readEach(([levels, baseline]) => {
      for (const key of RESOURCE_KEYS) expect(levels[key]).toBeCloseTo(baseline[key], 10);
    });
  });

  it("applies accumulated deltas and then clears them", () => {
    const world = createSimWorld({ seed: 2 });
    const voxel = voxelAt(world, 0)!;
    const before = voxel.get(Resources)!.nutrients;

    voxel.set(ResourceDelta, { nutrients: -0.5 });
    applyEnvironment(world);

    expect(voxel.get(Resources)!.nutrients).toBeLessThan(before);
    expect(voxel.get(ResourceDelta)!.nutrients).toBe(0);
  });

  it("drifts a depleted voxel back toward baseline", () => {
    const world = createSimWorld({ seed: 2 });
    const voxel = voxelAt(world, 0)!;
    const baseline = voxel.get(ResourceBaseline)!.moisture;
    voxel.set(Resources, { moisture: 0 });

    applyEnvironment(world);
    const after = voxel.get(Resources)!.moisture;

    expect(after).toBeCloseTo(baseline * REGEN_RATE, 10);
    expect(after).toBeLessThan(baseline);
  });

  it("clamps rather than letting a large delta escape the range", () => {
    const world = createSimWorld({ seed: 2 });
    const voxel = voxelAt(world, 0)!;

    voxel.set(ResourceDelta, { oxygen: 99, nutrients: -99 });
    applyEnvironment(world);

    const levels = voxel.get(Resources)!;
    expect(levels.oxygen).toBeLessThanOrEqual(MAX_RESOURCE);
    expect(levels.nutrients).toBeGreaterThanOrEqual(0);
  });

  it("is order-independent: deltas are batched, not applied as they arrive", () => {
    const world = createSimWorld({ seed: 2 });
    const voxel = voxelAt(world, 0)!;
    voxel.set(Resources, { nutrients: 0.5 });
    voxel.set(ResourceBaseline, { nutrients: 0.5 });

    // Two creatures draw from the same voxel in one phase.
    voxel.set(ResourceDelta, { nutrients: -0.2 });
    const delta = voxel.get(ResourceDelta)!;
    voxel.set(ResourceDelta, { nutrients: delta.nutrients - 0.1 });
    applyEnvironment(world);

    // 0.5 - 0.3 = 0.2, then regression back toward the 0.5 baseline.
    expect(voxel.get(Resources)!.nutrients).toBeCloseTo(0.2 + (0.5 - 0.2) * REGEN_RATE, 10);
  });

  it("leaves every voxel in range after many turns", () => {
    const world = createSimWorld({ seed: 4 });
    for (let turn = 0; turn < 200; turn++) applyEnvironment(world);

    world.query(Voxel, Resources).readEach(([, levels]) => {
      for (const key of RESOURCE_KEYS) {
        expect(Number.isNaN(levels[key])).toBe(false);
        expect(levels[key]).toBeGreaterThanOrEqual(0);
        expect(levels[key]).toBeLessThanOrEqual(MAX_RESOURCE);
      }
    });
  });
});
