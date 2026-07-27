import { trait, type Entity } from "koota";
import { createGrid, type Grid } from "./grid";
import { Rng } from "./rng";
import { Terrains } from "./terrain";

/**
 * Koota traits for Eden.
 *
 * Storage convention: schema traits (Structure-of-Arrays, primitives only) for
 * anything there may be thousands of — creatures, voxels. AoS traits
 * (`trait(() => obj)`) for the handful of singletons and per-species config
 * objects, where ergonomics matter more than layout.
 *
 * Voxel, species, and creature traits arrive with the milestones that need
 * them; this file currently holds the world-level singletons.
 */

/** Simulation turn counter. One increment per simulation phase. */
export const Clock = trait({ turn: 0 });

/**
 * The world's random stream. Held in the world (rather than beside it) so that
 * a world is self-contained: snapshotting it captures the RNG position too,
 * which is what makes the determinism test meaningful.
 */
export const RngSource = trait(() => new Rng(0));

export type Phase = "simulation" | "player" | "won" | "lost";

/**
 * Run-level state.
 *
 * `version` increments once per completed phase and is the *only* thing the
 * React layer subscribes to. Keeping the UI coarse-grained like this means
 * React re-renders once per turn instead of participating in the render loop.
 */
export const RunState = trait({
  phase: "player" as Phase,
  /** Consecutive player turns with no legal play; drives the deadlock loss. */
  deadlockTurns: 0,
  version: 0,
});

/**
 * The voxel grid plus a linear index -> entity lookup.
 *
 * Held on the world so a world remains self-contained, and so movement and
 * neighbourhood queries can resolve a voxel entity without a query per lookup —
 * this is on the hot path for every creature that moves.
 */
export const GridIndex = trait(() => ({
  grid: createGrid({ x: 1, y: 1, z: 1 }) as Grid,
  entities: [] as Entity[],
}));

// --- Voxel entities ---------------------------------------------------------

export const Voxel = trait({ x: 0, y: 0, z: 0, index: 0 });

/** Exactly one terrain bit. See `terrain.ts` for why it is a bit, not an ordinal. */
export const Terrain = trait({ kind: Terrains.bit.AIR });

/** Current levels, all normalised to [0, 1]. */
export const Resources = trait({ light: 0, oxygen: 0, nutrients: 0, moisture: 0 });

/** Resting levels this voxel drifts back toward. Fixed by terrain and depth. */
export const ResourceBaseline = trait({ light: 0, oxygen: 0, nutrients: 0, moisture: 0 });

/**
 * Per-turn changes accumulated by creatures and applied in one pass at the end
 * of the phase, so results do not depend on simulation order.
 */
export const ResourceDelta = trait({ light: 0, oxygen: 0, nutrients: 0, moisture: 0 });
