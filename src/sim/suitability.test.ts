import { describe, expect, it } from "vitest";
import { spawnSpecies, readSpecies, type SpeciesDefinition } from "./species";
import { suitability } from "./suitability";
import { Terrains } from "./terrain";
import { createTestWorld } from "../testing/world";

const FISH: SpeciesDefinition = {
  id: "fish",
  name: "Fish",
  colorHex: 0,
  tags: ["AQUATIC", "MOTILE"],
  actions: ["SWIM"],
  habitat: ["WATER"],
  needs: { oxygen: 0.5, moisture: 0.8 },
};

function view(definition: SpeciesDefinition) {
  return readSpecies(spawnSpecies(createTestWorld({ seed: 1 }), definition));
}

const levels = (over: Partial<Record<string, number>> = {}) => ({
  light: 1,
  oxygen: 1,
  nutrients: 1,
  moisture: 1,
  ...over,
});

describe("suitability", () => {
  it("scores a fully-provisioned home voxel at 1", () => {
    expect(suitability(view(FISH), Terrains.bit.WATER, levels())).toBe(1);
  });

  it("gates on habitat absolutely — a fish in air is impossible, not merely poor", () => {
    expect(suitability(view(FISH), Terrains.bit.AIR, levels())).toBe(0);
    expect(suitability(view(FISH), Terrains.bit.SOIL, levels())).toBe(0);
  });

  it("scores by the worst-covered need, not the average", () => {
    // Abundant moisture must not paper over absent oxygen.
    const starved = suitability(view(FISH), Terrains.bit.WATER, levels({ oxygen: 0 }));
    expect(starved).toBe(0);

    const half = suitability(view(FISH), Terrains.bit.WATER, levels({ oxygen: 0.25 }));
    expect(half).toBeCloseTo(0.5, 10);
  });

  it("treats a species with no needs as indifferent", () => {
    const rock: SpeciesDefinition = { ...FISH, id: "r", needs: {}, habitat: ["WATER"] };
    expect(suitability(view(rock), Terrains.bit.WATER, levels({ oxygen: 0 }))).toBe(1);
  });

  it("never exceeds 1 when a voxel over-provides", () => {
    const modest: SpeciesDefinition = { ...FISH, id: "m", needs: { oxygen: 0.1 } };
    expect(suitability(view(modest), Terrains.bit.WATER, levels())).toBe(1);
  });

  it("accepts either terrain for an amphibian habitat mask", () => {
    const salamander: SpeciesDefinition = {
      ...FISH,
      id: "sal",
      habitat: ["WATER", "SOIL"],
      needs: { moisture: 0.5 },
    };
    const it_ = view(salamander);
    expect(suitability(it_, Terrains.bit.WATER, levels())).toBe(1);
    expect(suitability(it_, Terrains.bit.SOIL, levels())).toBe(1);
    expect(suitability(it_, Terrains.bit.AIR, levels())).toBe(0);
  });
});
