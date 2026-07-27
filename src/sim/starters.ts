import type { Entity, World } from "koota";
import { spawnCreature, spawnSpecies, type SpeciesDefinition } from "./species";
import { Terrains } from "./terrain";
import { Resources, Terrain, Voxel } from "./traits";
import { getGrid, voxelAt } from "./world";

/**
 * The organism every run begins with: a single amoeba in a pond.
 *
 * It is deliberately capable of very little — it feeds on suspended matter,
 * drifts, and divides. Everything else in a run is built on top of it by
 * mutation cards, so anything it can already do is something a card cannot be
 * about.
 */
export const AMOEBA: SpeciesDefinition = {
  id: "amoeba",
  name: "Amoeba",
  colorHex: 0x9ad9c0,
  tags: ["AQUATIC", "MOTILE", "MICROBIAL", "DECOMPOSER"],
  actions: ["DECOMPOSE", "SWIM", "REPRODUCE", "IDLE"],
  habitat: ["WATER"],
  needs: { moisture: 0.8, oxygen: 0.2, nutrients: 0.2 },
  provides: { nutrients: 0.05 },
  locomotion: 1,
  life: {
    maxAge: 25,
    metabolism: 0.04,
    maxEnergy: 1,
    startingEnergy: 0.6,
    reproduceThreshold: 0.65,
    reproduceCost: 0.3,
  },
};

/**
 * Seed a world with its starting population.
 *
 * Placed in the brightest, deepest water available so run 1 opens from a viable
 * position rather than one the player has to rescue.
 */
export function seedStartingLife(world: World): { species: Entity; creature: Entity } {
  const species = spawnSpecies(world, AMOEBA);
  const voxel = bestStartingVoxel(world);
  const creature = spawnCreature(world, species, voxel);
  return { species, creature };
}

function bestStartingVoxel(world: World): Entity {
  const grid = getGrid(world);
  let best: { entity: Entity; score: number } | null = null;

  for (let index = 0; index < grid.count; index++) {
    const entity = voxelAt(world, index);
    if (!entity) continue;
    if (entity.get(Terrain)?.kind !== Terrains.bit.WATER) continue;

    const levels = entity.get(Resources);
    const position = entity.get(Voxel);
    if (!levels || !position) continue;

    // Prefer wet, oxygenated, well-lit water near the middle of the pond.
    const score = levels.moisture + levels.oxygen + levels.light;
    if (!best || score > best.score) best = { entity, score };
  }

  if (!best) throw new Error("seedStartingLife: the generated world has no water");
  return best.entity;
}
