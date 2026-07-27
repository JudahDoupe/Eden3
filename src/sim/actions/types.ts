import type { Entity, World } from "koota";
import type { EventLog } from "../events";
import type { Rng } from "../rng";
import type { SpeciesView } from "../species";
import type { ActionName } from "./ids";

/**
 * Everything an action needs to score and perform itself.
 *
 * Species data is read once per phase and handed in, rather than re-read per
 * action evaluation — there are up to nine evaluations per creature per turn.
 */
export interface ActionContext {
  world: World;
  rng: Rng;
  turn: number;
  creature: Entity;
  /** Creature state, read once before scoring. */
  age: number;
  energy: number;
  species: SpeciesView;
  voxel: Entity;
  voxelIndex: number;
  /** Voxel entities within `range` of the creature, nearest ring outward. */
  inRange(range: number): Entity[];
  /** Other creatures in this voxel. */
  coLocated(): Entity[];
  log: EventLog;
}

export interface ActionDef {
  id: ActionName;
  /**
   * Tags the species must have for this action to be available at all.
   *
   * This is where a mutation that drops a tag silently removes a behaviour —
   * the intended design, and the reason `explainActions` reports missing tags.
   */
  requiresTags: number;
  /**
   * Desirability in [0, 1] given current state; <= 0 means unavailable now.
   * Must be free of side effects: `explainActions` calls it to build the
   * inspector table without advancing the simulation.
   */
  score(ctx: ActionContext): number;
  perform(ctx: ActionContext): void;
}
