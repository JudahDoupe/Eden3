import type { World } from "koota";
import { describe, expect, it } from "vitest";
import { cardById } from "./cards";
import { cardPlayability, legalTargets } from "./legality";
import { playCard } from "./playCard";
import { createEventLog } from "../sim/events";
import { spawnCreature, spawnSpecies } from "../sim/species";
import { seedStartingLife } from "../sim/starters";
import { Terrains } from "../sim/terrain";
import { Creature, Species, Terrain } from "../sim/traits";
import { getGrid, voxelAt } from "../sim/world";
import { createTestWorld } from "../testing/world";

function startedWorld(): World {
  const world = createTestWorld({ seed: 1 });
  seedStartingLife(world);
  return world;
}

function firstVoxelOfKind(world: World, kind: number) {
  const grid = getGrid(world);
  for (let index = 0; index < grid.count; index++) {
    const entity = voxelAt(world, index);
    if (entity?.get(Terrain)?.kind === kind) return entity;
  }
  throw new Error(`no voxel of kind ${kind}`);
}

describe("cardPlayability", () => {
  it("accepts a card whose tag requirements the target meets", () => {
    const world = startedWorld();
    const result = cardPlayability(world, cardById("algae"));
    expect(result.playable).toBe(true);
    expect(result.targets.length).toBeGreaterThan(0);
    expect(result.reason).toBeNull();
  });

  it("rejects a card whose required tags no species has, and says so", () => {
    const world = startedWorld();
    const result = cardPlayability(world, cardById("flower"));

    expect(result.playable).toBe(false);
    expect(result.targets).toEqual([]);
    expect(result.reason).toMatch(/needs a species that is plant/i);
  });

  it("rejects a card the target already is", () => {
    // `algae` forbids PHOTOSYNTHETIC, so it cannot be played on itself.
    const world = startedWorld();
    const log = createEventLog();
    const card = cardById("algae");
    playCard(world, card, cardPlayability(world, card).targets[0]!, log);

    const onlyPhotosynthetic = cardPlayability(world, card).targets.filter(
      (target) => target.speciesId === "algae",
    );
    expect(onlyPhotosynthetic).toEqual([]);
  });

  it("checks habitat against the resulting creature, not the parent", () => {
    // The subtle rule: pond algae satisfies `plant`'s PHOTOSYNTHETIC
    // requirement, but a plant cannot live in water, so water voxels are not
    // legal targets even though the algae is standing in them.
    const world = startedWorld();
    const log = createEventLog();
    const algaeCard = cardById("algae");
    playCard(world, algaeCard, cardPlayability(world, algaeCard).targets[0]!, log);

    for (const target of legalTargets(world, cardById("plant"))) {
      expect(voxelAt(world, target.voxelIndex)!.get(Terrain)!.kind).toBe(Terrains.bit.SOIL);
    }
  });

  it("explains a species that lives nowhere the card could survive", () => {
    const world = createTestWorld({ seed: 1 });
    // A photosynthetic species confined to deep water: `plant` matches its tags
    // but has nowhere to go.
    const species = spawnSpecies(world, {
      id: "deepweed",
      name: "Deepweed",
      colorHex: 0,
      tags: ["AQUATIC", "SESSILE", "PHOTOSYNTHETIC"],
      actions: ["PHOTOSYNTHESIZE"],
      habitat: ["WATER"],
    });
    spawnCreature(world, species, firstVoxelOfKind(world, Terrains.bit.WATER));

    const result = cardPlayability(world, cardById("plant"));
    expect(result.playable).toBe(false);
    expect(result.reason).toMatch(/Deepweed lives nowhere/i);
    expect(result.reason).toMatch(/soil/i);
  });

  it("offers no target for a species with no living creatures", () => {
    const world = createTestWorld({ seed: 1 });
    // A species definition with no population is not a legal target.
    spawnSpecies(world, {
      id: "ghost",
      name: "Ghost",
      colorHex: 0,
      tags: ["AQUATIC"],
      actions: ["IDLE"],
      habitat: ["WATER"],
    });
    expect(cardPlayability(world, cardById("algae")).targets).toEqual([]);
  });

  it("names every voxel the species occupies, so all are highlightable", () => {
    const world = createTestWorld({ seed: 1 });
    const species = spawnSpecies(world, {
      id: "spread",
      name: "Spread",
      colorHex: 0,
      tags: ["AQUATIC", "MOTILE"],
      actions: ["SWIM"],
      habitat: ["WATER"],
    });

    const grid = getGrid(world);
    let placed = 0;
    for (let index = 0; index < grid.count && placed < 3; index++) {
      const entity = voxelAt(world, index);
      if (entity?.get(Terrain)?.kind !== Terrains.bit.WATER) continue;
      spawnCreature(world, species, entity);
      placed++;
    }

    const targets = legalTargets(world, cardById("algae"));
    expect(targets).toHaveLength(placed);
    expect(new Set(targets.map((t) => t.voxelIndex)).size).toBe(placed);
  });

  it("names the species each target belongs to", () => {
    const world = startedWorld();
    const [target] = legalTargets(world, cardById("algae"));
    expect(target!.speciesName).toBe("Amoeba");
    expect(target!.speciesId).toBe("amoeba");
  });

  it("finds nothing once every creature is dead", () => {
    const world = startedWorld();
    for (const creature of world.query(Creature)) creature.destroy();
    expect(cardPlayability(world, cardById("algae")).playable).toBe(false);
  });

  it("still reports the species that exist when explaining a rejection", () => {
    const world = startedWorld();
    expect(world.query(Species).length).toBe(1);
    expect(cardPlayability(world, cardById("fungus")).reason).toMatch(/fungus/i);
  });
});
