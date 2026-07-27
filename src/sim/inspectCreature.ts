import type { Entity, World } from "koota";
import { explainActions, type ActionExplanation } from "./actions";
import { createEventLog } from "./events";
import { readSpecies } from "./species";
import { createContext } from "./step";
import { Creature, InVoxel, OfSpecies } from "./traits";
import { getRng, getTurn } from "./world";

/**
 * Ask a creature why it would do what it is about to do.
 *
 * The read-only counterpart of the step loop, and the primary debugging surface
 * for the whole simulation: with utility selection and implicit tag gating,
 * reading a species definition tells you almost nothing about its behaviour.
 *
 * Safe to call at any time and any number of times — it neither mutates the
 * world nor advances the RNG, so opening the inspector cannot change the run.
 */
export function explainCreature(world: World, creature: Entity): ActionExplanation | null {
  if (!creature.isAlive()) return null;

  const speciesEntity = creature.targetFor(OfSpecies);
  const voxel = creature.targetFor(InVoxel);
  if (!speciesEntity || !voxel || !creature.has(Creature)) return null;

  const ctx = createContext(
    world,
    getRng(world),
    getTurn(world) + 1, // the turn these scores would apply to
    creature,
    readSpecies(speciesEntity),
    voxel,
    // Actions only write to the log when performed, never when scored; this
    // sink exists solely to satisfy the shared context shape.
    createEventLog(0),
  );

  return ctx ? explainActions(ctx) : null;
}
