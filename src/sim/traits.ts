import { relation, trait, type Entity } from "koota";
import type { ActionName } from "./actions/ids";
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

// --- Species entities -------------------------------------------------------
//
// A species is a definition, not an organism: it carries no position and no
// energy. Creatures reference it through the `OfSpecies` relation.

export const Species = trait({ id: "", name: "", colorHex: 0x888888, cardId: "" });

/** What the species *is*. Gates card targeting, action availability, and predation. */
export const SpeciesTags = trait({ mask: 0 });

/**
 * Which actions the species owns — inherited from its parent plus whatever its
 * mutation card granted. Ownership is necessary but not sufficient: each action
 * also demands tags, so losing a tag disables it without touching this mask.
 */
export const SpeciesActions = trait({ mask: 0 });

/** Resources drawn from the voxel each turn. Zero means indifferent. */
export const Needs = trait({ light: 0, oxygen: 0, nutrients: 0, moisture: 0 });

/** Resources returned to the voxel each turn. */
export const Provides = trait({ light: 0, oxygen: 0, nutrients: 0, moisture: 0 });

/** Terrain kinds this species can occupy. A mask, so amphibians are expressible. */
export const Habitat = trait({ terrainMask: 0 });

/** Tags this species can eat. Zero for autotrophs. */
export const Diet = trait({ preyTagMask: 0 });

/** Voxel radius reachable in one move. Zero for sessile species. */
export const Locomotion = trait({ range: 0 });

export const Life = trait({
  maxAge: 20,
  /** Energy burned per turn regardless of what the creature does. */
  metabolism: 0.05,
  maxEnergy: 1,
  startingEnergy: 0.5,
  /** Energy above which reproducing becomes attractive. */
  reproduceThreshold: 0.7,
  reproduceCost: 0.35,
});

/**
 * Per-action utility multipliers — the primary tuning knob for species
 * behaviour. AoS because there are few species and a real object reads better
 * than a dozen parallel columns; missing entries default to 1.
 */
export const ActionWeights = trait(() => ({}) as Partial<Record<ActionName, number>>);

/** Marks a species that has lost its last creature. */
export const Extinct = trait({ turn: 0 });

/** The evolutionary tree: a species points at the one it mutated from. */
export const DescendedFrom = relation({ exclusive: true });

// --- Creature entities ------------------------------------------------------

/** One entity per (species, voxel) — "the worms in this voxel", not one worm. */
export const Creature = trait({ age: 0, energy: 0 });

export const OfSpecies = relation({ exclusive: true });
export const InVoxel = relation({ exclusive: true });
