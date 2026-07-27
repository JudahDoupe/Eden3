import { createWorld, type Entity, type World } from "koota";
import { createGrid, type Grid, type GridSize } from "./grid";
import { baselineFor, computeLight } from "./resources";
import { Rng } from "./rng";
import { DEFAULT_TERRAIN, generateTerrain, type TerrainConfig } from "./terrain";
import {
  Clock,
  GridIndex,
  ResourceBaseline,
  ResourceDelta,
  Resources,
  RngSource,
  RunState,
  Terrain,
  Voxel,
} from "./traits";

export interface SimConfig {
  /** Seeds every random decision in the run. Same seed, same run. */
  seed: number;
  /** Voxel grid dimensions; `y` is vertical. */
  size: GridSize;
  terrain: TerrainConfig;
}

export const DEFAULT_CONFIG: SimConfig = {
  seed: 1,
  size: { x: 8, y: 5, z: 8 },
  terrain: DEFAULT_TERRAIN,
};

/** Fill in defaults so callers only state what they care about. */
export function resolveConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    size: { ...DEFAULT_CONFIG.size, ...overrides.size },
    terrain: { ...DEFAULT_CONFIG.terrain, ...overrides.terrain },
  };
}

/**
 * Build a simulation world: world singletons, then a generated voxel grid.
 * No creatures yet — those arrive with the species system.
 *
 * Deliberately free of three.js and React so it is constructible in a bare node
 * test environment, which `architecture.test.ts` enforces.
 */
export function createSimWorld(overrides: Partial<SimConfig> = {}): World {
  const config = resolveConfig(overrides);
  const world = createWorld();

  world.add(Clock);
  world.add(RngSource);
  world.add(RunState);
  world.add(GridIndex);

  const rng = new Rng(config.seed);
  world.set(RngSource, rng);

  const grid = createGrid(config.size);
  const kinds = generateTerrain(grid, rng, config.terrain);
  const light = computeLight(grid, kinds);

  const entities = new Array<Entity>(grid.count);
  for (let index = 0; index < grid.count; index++) {
    const { x, y, z } = grid.coordsOf(index);
    const kind = kinds[index]!;
    const baseline = baselineFor(kind, light[index]!);

    entities[index] = world.spawn(
      Voxel({ x, y, z, index }),
      Terrain({ kind }),
      // Voxels start at rest, so a run opens from a settled environment rather
      // than a transient the player has to wait out.
      Resources({ ...baseline }),
      ResourceBaseline({ ...baseline }),
      ResourceDelta,
    );
  }

  world.set(GridIndex, { grid, entities });

  return world;
}

/** The world's random stream. Throws rather than silently seeding a new one. */
export function getRng(world: World): Rng {
  const rng = world.get(RngSource);
  if (!rng) throw new Error("world has no RngSource — was it built by createSimWorld?");
  return rng;
}

export function getGrid(world: World): Grid {
  const index = world.get(GridIndex);
  if (!index) throw new Error("world has no GridIndex — was it built by createSimWorld?");
  return index.grid;
}

/** The voxel entity at a linear grid index. */
export function voxelAt(world: World, index: number): Entity | undefined {
  return world.get(GridIndex)?.entities[index];
}

/** Every voxel entity, ordered by grid index. */
export function voxelEntities(world: World): readonly Entity[] {
  return world.get(GridIndex)?.entities ?? [];
}

/** Current simulation turn. */
export function getTurn(world: World): number {
  return world.get(Clock)?.turn ?? 0;
}

/**
 * Mark a phase as complete. The version bump is what wakes the React layer, so
 * every mutation batch must end here or the UI will silently show stale state.
 */
export function bumpVersion(world: World): void {
  const state = world.get(RunState);
  if (!state) throw new Error("world has no RunState — was it built by createSimWorld?");
  world.set(RunState, { version: state.version + 1 });
}
