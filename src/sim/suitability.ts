import type { Entity } from "koota";
import { RESOURCE_KEYS, type ResourceLevels } from "./resources";
import type { SpeciesView } from "./species";
import { Resources, Terrain } from "./traits";

/**
 * How well a voxel suits a species, in [0, 1].
 *
 * This feeds every movement score and the reproduction target choice, so it is
 * the single function that most determines whether ecosystems feel alive or
 * feel like a spreadsheet. Kept pure and separately tested for exactly that
 * reason — it is the first thing to reach for when tuning.
 *
 * Habitat is a hard gate (0), not a penalty: a fish in air is not "a poor fit",
 * it is impossible. Beyond that, the score is how well the voxel covers the
 * species' needs, using the *worst* covered need rather than the average — a
 * voxel with abundant everything and no oxygen should not read as decent.
 */
export function suitability(species: SpeciesView, terrainKind: number, levels: ResourceLevels): number {
  if ((species.habitat & terrainKind) === 0) return 0;

  let worst = 1;
  let constrained = false;

  for (const key of RESOURCE_KEYS) {
    const need = species.needs[key];
    if (need <= 0) continue;
    constrained = true;
    const coverage = Math.min(1, levels[key] / need);
    if (coverage < worst) worst = coverage;
  }

  return constrained ? worst : 1;
}

/** `suitability` for a voxel entity, or 0 if it is not a voxel. */
export function suitabilityOf(species: SpeciesView, voxel: Entity): number {
  const terrain = voxel.get(Terrain);
  const levels = voxel.get(Resources);
  if (!terrain || !levels) return 0;
  return suitability(species, terrain.kind, levels);
}

/** Whether a species could exist in a voxel at all, ignoring resource levels. */
export function habitable(species: SpeciesView, voxel: Entity): boolean {
  const terrain = voxel.get(Terrain);
  return terrain ? (species.habitat & terrain.kind) !== 0 : false;
}
