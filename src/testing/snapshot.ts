import type { World } from "koota";
import { RESOURCE_KEYS } from "../sim/resources";
import {
  Creature,
  InVoxel,
  OfSpecies,
  Resources,
  Species,
  Voxel,
} from "../sim/traits";

/**
 * A stable textual digest of everything the simulation owns.
 *
 * Used to assert that two runs from the same seed stayed identical. Values are
 * rounded before hashing so genuinely equal float paths are not separated by
 * last-bit noise, but the precision is high enough that a real divergence in
 * behaviour still shows up.
 */
export function hashWorld(world: World): string {
  const creatures: string[] = [];
  world.query(Creature).forEach((creature) => {
    const state = creature.get(Creature)!;
    const speciesId = creature.targetFor(OfSpecies)?.get(Species)?.id ?? "?";
    const voxelIndex = creature.targetFor(InVoxel)?.get(Voxel)?.index ?? -1;
    creatures.push(`${speciesId}@${voxelIndex}:${state.age}:${state.energy.toFixed(6)}`);
  });

  const voxels: string[] = [];
  world.query(Voxel, Resources).readEach(([voxel, levels]) => {
    const values = RESOURCE_KEYS.map((key) => levels[key].toFixed(6)).join(",");
    voxels.push(`${voxel.index}:${values}`);
  });

  return [creatures.sort().join("|"), voxels.sort().join("|")].join("\n");
}

/** Every creature's (species, voxel) pair, for invariant checks. */
export function occupancy(world: World): Map<string, number> {
  const counts = new Map<string, number>();
  world.query(Creature).forEach((creature) => {
    const speciesId = creature.targetFor(OfSpecies)?.get(Species)?.id ?? "?";
    const voxelIndex = creature.targetFor(InVoxel)?.get(Voxel)?.index ?? -1;
    const key = `${speciesId}@${voxelIndex}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}
