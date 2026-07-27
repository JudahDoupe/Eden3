import type { World } from "koota";
import { describe, expect, it } from "vitest";
import { inspectSpecies, inspectVoxel, type VoxelInfo } from "./inspect";
import { ACTION_NAMES } from "../sim/actions/ids";
import { RESOURCE_KEYS } from "../sim/resources";
import { spawnCreature, spawnSpecies, type SpeciesDefinition } from "../sim/species";
import { seedStartingLife } from "../sim/starters";
import { Terrains } from "../sim/terrain";
import { Resources, Terrain, Voxel } from "../sim/traits";
import { getGrid, voxelAt } from "../sim/world";
import { createTestWorld } from "../testing/world";

function waterVoxel(world: World) {
  const grid = getGrid(world);
  for (let index = 0; index < grid.count; index++) {
    const entity = voxelAt(world, index);
    if (entity?.get(Terrain)?.kind === Terrains.bit.WATER) return entity;
  }
  throw new Error("no water voxel");
}

/** Every voxel that currently holds life. */
function inhabited(world: World): VoxelInfo[] {
  return [...world.query(Voxel)]
    .map((voxel) => inspectVoxel(world, voxel.get(Voxel)!.index)!)
    .filter((info) => info.creatures.length > 0);
}

describe("inspectVoxel", () => {
  it("reports coordinates matching the requested index", () => {
    const world = createTestWorld({ seed: 3 });
    const index = getGrid(world).indexOf(2, 1, 3);

    const info = inspectVoxel(world, index)!;
    expect(info.index).toBe(index);
    expect(info.coords).toEqual({ x: 2, y: 1, z: 3 });
  });

  it("names the terrain and reports every resource", () => {
    const world = createTestWorld({ seed: 3 });
    const info = inspectVoxel(world, getGrid(world).indexOf(0, 0, 0))!;

    expect(info.terrain).toBe("ROCK");
    for (const key of RESOURCE_KEYS) {
      expect(typeof info.resources[key]).toBe("number");
      expect(typeof info.baseline[key]).toBe("number");
    }
  });

  it("returns a copy, so the UI cannot write through to the simulation", () => {
    const world = createTestWorld({ seed: 3 });
    const index = getGrid(world).indexOf(1, 1, 1);

    const info = inspectVoxel(world, index)!;
    info.resources.nutrients = 999;

    expect(voxelAt(world, index)!.get(Resources)!.nutrients).not.toBe(999);
  });

  it("returns null for an index outside the world", () => {
    const world = createTestWorld({ seed: 3 });
    expect(inspectVoxel(world, 99_999)).toBeNull();
    expect(inspectVoxel(world, -1)).toBeNull();
  });

  it("lists the creatures living in the voxel", () => {
    const world = createTestWorld({ seed: 3 });
    seedStartingLife(world);

    const occupied = inhabited(world);
    expect(occupied).toHaveLength(1);
    expect(occupied[0]!.creatures[0]!.speciesName).toBe("Amoeba");
  });

  it("reports an empty voxel as empty rather than omitting the field", () => {
    const world = createTestWorld({ seed: 3 });
    expect(inspectVoxel(world, 0)!.creatures).toEqual([]);
  });
});

describe("creature action tables", () => {
  const GATED: SpeciesDefinition = {
    id: "stranded",
    name: "Stranded",
    colorHex: 0x445566,
    // Owns SWIM but has lost AQUATIC — the emergent case the inspector exists for.
    tags: ["TERRESTRIAL", "MOTILE", "DECOMPOSER"],
    actions: ["SWIM", "DECOMPOSE", "IDLE"],
    habitat: ["WATER"],
    locomotion: 1,
  };

  function gatedCreature(energy?: number) {
    const world = createTestWorld({ seed: 3 });
    const voxel = waterVoxel(world);
    spawnCreature(world, spawnSpecies(world, GATED), voxel, energy);
    return inspectVoxel(world, voxel.get(Voxel)!.index)!.creatures[0]!;
  }

  it("includes every action, owned or not, so nothing is invisible", () => {
    expect(gatedCreature().actions.map((candidate) => candidate.id)).toEqual([...ACTION_NAMES]);
  });

  it("names the tag that gates an owned action out", () => {
    const swim = gatedCreature().actions.find((candidate) => candidate.id === "SWIM")!;

    expect(swim.owned).toBe(true);
    expect(swim.gated).toBe(true);
    expect(swim.missingTags).toEqual(["AQUATIC"]);
  });

  it("distinguishes an unowned action from a gated one", () => {
    const fly = gatedCreature().actions.find((candidate) => candidate.id === "FLY")!;
    expect(fly.owned).toBe(false);
    expect(fly.gated).toBe(false);
  });

  it("reports what the creature would do next", () => {
    expect(gatedCreature(0.1).chosen).toBe("DECOMPOSE");
  });

  it("carries vitals for the energy and age readouts", () => {
    const world = createTestWorld({ seed: 3 });
    const { creature } = seedStartingLife(world);

    const info = inhabited(world)[0]!.creatures[0]!;
    expect(info.id).toBe(creature.id());
    expect(info.maxAge).toBeGreaterThan(0);
    expect(info.maxEnergy).toBeGreaterThan(0);
    expect(info.tags).toContain("AQUATIC");
  });
});

describe("inspectSpecies", () => {
  it("counts the living population of each species", () => {
    const world = createTestWorld({ seed: 3 });
    seedStartingLife(world);

    const [amoeba] = inspectSpecies(world);
    expect(amoeba!.id).toBe("amoeba");
    expect(amoeba!.population).toBe(1);
    expect(amoeba!.extinctTurn).toBeNull();
  });
});
