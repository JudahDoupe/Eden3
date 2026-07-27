import { createWorld, type World } from "koota";
import { Rng } from "./rng";
import { Clock, RngSource, RunState } from "./traits";

export interface SimConfig {
  /** Seeds every random decision in the run. Same seed, same run. */
  seed: number;
  /** Voxel grid dimensions. */
  size: { x: number; y: number; z: number };
}

export const DEFAULT_CONFIG: SimConfig = {
  seed: 1,
  size: { x: 8, y: 5, z: 8 },
};

/**
 * Build an empty simulation world: world-level singletons only, no terrain and
 * no creatures. Later milestones layer generation on top of this.
 *
 * Deliberately free of three.js and React — this must be constructible in a
 * bare node test environment, which `architecture.test.ts` enforces.
 */
export function createSimWorld(config: SimConfig = DEFAULT_CONFIG): World {
  const world = createWorld();

  world.add(Clock);
  world.add(RngSource);
  world.add(RunState);

  world.set(RngSource, new Rng(config.seed));

  return world;
}

/** The world's random stream. Throws rather than silently seeding a new one. */
export function getRng(world: World): Rng {
  const rng = world.get(RngSource);
  if (!rng) throw new Error("world has no RngSource — was it built by createSimWorld?");
  return rng;
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
