import type { World } from "koota";
import type { Grid } from "./grid";
import { Terrains, type TerrainKind } from "./terrain";
import { ResourceBaseline, ResourceDelta, Resources } from "./traits";

/**
 * Voxel resources: the substrate creatures draw from and give back to.
 *
 * All four are normalised to [0, 1] so scoring functions can treat them
 * uniformly and so `suitability()` never has to know their units.
 */
export const RESOURCE_KEYS = ["light", "oxygen", "nutrients", "moisture"] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];
export type ResourceLevels = Record<ResourceKey, number>;

export const MAX_RESOURCE = 1;

/** Fraction of the gap to baseline recovered each turn. */
export const REGEN_RATE = 0.1;

/** Resting levels a voxel drifts back toward, by terrain. Light is positional. */
const TERRAIN_BASELINE: Record<string, Omit<ResourceLevels, "light">> = {
  ROCK: { oxygen: 0, nutrients: 0.1, moisture: 0.2 },
  SOIL: { oxygen: 0.2, nutrients: 0.8, moisture: 0.6 },
  WATER: { oxygen: 0.5, nutrients: 0.4, moisture: 1 },
  AIR: { oxygen: 0.9, nutrients: 0.05, moisture: 0.15 },
};

/** Fraction of incoming light a voxel passes down to the one below it. */
const TRANSMISSION: Record<string, number> = {
  ROCK: 0,
  SOIL: 0,
  WATER: 0.72,
  AIR: 0.98,
};

export function clampResource(value: number): number {
  return value < 0 ? 0 : value > MAX_RESOURCE ? MAX_RESOURCE : value;
}

/**
 * Light reaching each voxel, computed top-down per column.
 *
 * Water attenuates sharply and ground blocks entirely, so depth alone creates
 * distinct niches: surface water is bright enough for algae, the pond floor is
 * not. This is geometry only — creature shading (a canopy dimming the
 * understorey) would arrive later as a per-turn delta, not a change here.
 */
export function computeLight(grid: Grid, kinds: readonly TerrainKind[]): number[] {
  const light = new Array<number>(grid.count).fill(0);

  for (let z = 0; z < grid.size.z; z++) {
    for (let x = 0; x < grid.size.x; x++) {
      let incoming = MAX_RESOURCE;
      for (let y = grid.size.y - 1; y >= 0; y--) {
        const index = grid.indexOf(x, y, z);
        light[index] = incoming;
        const [name] = Terrains.toNames(kinds[index]!);
        incoming *= TRANSMISSION[name!] ?? 0;
      }
    }
  }

  return light;
}

/** The resting levels for a voxel of `kind` receiving `light`. */
export function baselineFor(kind: TerrainKind, light: number): ResourceLevels {
  const [name] = Terrains.toNames(kind);
  const base = TERRAIN_BASELINE[name!];
  if (!base) throw new Error(`baselineFor: ${kind} is not a terrain bit`);
  return { light, ...base };
}

/**
 * Close out a simulation phase's environmental bookkeeping.
 *
 * Creatures never write `Resources` directly — they accumulate into
 * `ResourceDelta`, which is applied here in one pass. That is what keeps the
 * environment independent of the order creatures happened to be simulated in.
 */
export function applyEnvironment(world: World): void {
  world
    .query(Resources, ResourceBaseline, ResourceDelta)
    .updateEach(([levels, baseline, delta]) => {
      for (const key of RESOURCE_KEYS) {
        const applied = clampResource(levels[key] + delta[key]);
        levels[key] = clampResource(applied + (baseline[key] - applied) * REGEN_RATE);
        delta[key] = 0;
      }
    });
}
