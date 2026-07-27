import { trait } from "koota";
import { Rng } from "./rng";

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
