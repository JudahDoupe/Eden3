import { defineFlags } from "./bitmask";
import type { Grid } from "./grid";
import type { Rng } from "./rng";

/**
 * Terrain kinds.
 *
 * A voxel has exactly one kind, but it is stored as that kind's *bit* rather
 * than an ordinal, because a species' `Habitat` is a set of acceptable kinds.
 * One representation serves both: `habitatMask & voxel.kind` is the membership
 * test, no lookup table required.
 */
export const TERRAIN_NAMES = ["ROCK", "SOIL", "WATER", "AIR"] as const;

export type TerrainName = (typeof TERRAIN_NAMES)[number];

export const Terrains = defineFlags(TERRAIN_NAMES);

/** The single-bit value stored on a voxel. */
export type TerrainKind = number;

/** Anything a creature cannot pass through or occupy. */
export const SOLID_TERRAIN = Terrains.mask("ROCK", "SOIL");

export function terrainName(kind: TerrainKind): TerrainName {
  const [name] = Terrains.toNames(kind);
  if (!name) throw new Error(`terrainName: ${kind} is not a terrain bit`);
  return name;
}

export interface TerrainConfig {
  /** Highest y that water fills, when the ground is below it. */
  waterLevel: number;
  /** Target ground height at the pond's centre, before rounding. */
  basinDepth: number;
  /** Additional ground height at the rim. */
  rimHeight: number;
  /** Height variation amplitude, in voxels. */
  roughness: number;
  /** Noise lattice resolution. Lower is smoother; too high returns to speckle. */
  noiseCells: number;
}

export const DEFAULT_TERRAIN: TerrainConfig = {
  waterLevel: 2,
  // Below 1 so the centre floors out at bedrock, giving the pond two layers of
  // water. That depth matters: light attenuates through water, so a deep pond
  // has a bright surface and a dim floor — two distinct niches rather than one.
  basinDepth: 0.3,
  rimHeight: 3,
  roughness: 0.9,
  noiseCells: 2,
};

const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Coherent 2D value noise over the unit square.
 *
 * Independent per-column randomness produces high-frequency speckle that swamps
 * the basin gradient — a pond full of one-voxel soil islands. Interpolating a
 * coarse lattice instead keeps neighbouring columns correlated, so the shoreline
 * comes out as a shoreline.
 */
function createNoise(rng: Rng, cells: number): (u: number, v: number) => number {
  const dim = cells + 1;
  const lattice = Array.from({ length: dim * dim }, () => rng.next());

  return (u, v) => {
    const fx = u * cells;
    const fz = v * cells;
    const x0 = Math.min(Math.floor(fx), cells - 1);
    const z0 = Math.min(Math.floor(fz), cells - 1);
    const tx = smoothstep(fx - x0);
    const tz = smoothstep(fz - z0);

    const v00 = lattice[z0 * dim + x0]!;
    const v10 = lattice[z0 * dim + x0 + 1]!;
    const v01 = lattice[(z0 + 1) * dim + x0]!;
    const v11 = lattice[(z0 + 1) * dim + x0 + 1]!;

    return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), tz);
  };
}

/**
 * Generate the starting world: a pond in a shallow bowl.
 *
 * Ground height rises from the centre outward, so the middle columns sit below
 * the water level and flood while the rim stays dry. That single gradient is
 * what gives run 1 both an aquatic niche for the starting amoeba and dry land
 * for later terrestrial mutations to colonise.
 *
 * Deterministic given `rng`; the same seed always yields the same pond.
 */
export function generateTerrain(
  grid: Grid,
  rng: Rng,
  config: TerrainConfig = DEFAULT_TERRAIN,
): TerrainKind[] {
  const { size } = grid;
  const kinds = new Array<TerrainKind>(grid.count);

  const centreX = (size.x - 1) / 2;
  const centreZ = (size.z - 1) / 2;
  const maxDistance = Math.hypot(centreX, centreZ) || 1;
  const noise = createNoise(rng, config.noiseCells);

  for (let z = 0; z < size.z; z++) {
    for (let x = 0; x < size.x; x++) {
      const distance = Math.hypot(x - centreX, z - centreZ) / maxDistance;
      const relief = (noise(x / Math.max(size.x - 1, 1), z / Math.max(size.z - 1, 1)) - 0.5) * 2;
      const groundHeight = Math.max(
        1,
        Math.min(
          size.y - 1,
          Math.round(config.basinDepth + distance * config.rimHeight + relief * config.roughness),
        ),
      );

      for (let y = 0; y < size.y; y++) {
        kinds[grid.indexOf(x, y, z)] =
          y === 0
            ? Terrains.bit.ROCK // bedrock floor, never colonisable
            : y < groundHeight
              ? Terrains.bit.SOIL
              : y <= config.waterLevel
                ? Terrains.bit.WATER
                : Terrains.bit.AIR;
      }
    }
  }

  return kinds;
}
