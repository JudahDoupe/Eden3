import type { Entity } from "koota";
import { addDelta, depositDetritus } from "./actions/helpers";
import type { EventLog } from "./events";
import { RESOURCE_KEYS } from "./resources";
import type { SpeciesView } from "./species";
import { habitable } from "./suitability";
import { Creature, Species, Voxel } from "./traits";

/** Biomass a corpse returns to its voxel, as a fraction of the species' maximum energy. */
const DETRITUS_YIELD = 0.4;

export type UpkeepOutcome = "alive" | "starved" | "aged" | "stranded";

/**
 * Per-turn bookkeeping that is not a decision: ageing, metabolism, resource
 * draw, and death.
 *
 * Keeping these out of the action registry is the whole point of the
 * upkeep/action split. If "die" and "grow" were actions they would compete for
 * utility against real choices, and a starving creature could out-score its own
 * death by deciding to reproduce instead.
 *
 * Returns whether the creature survived; a dead creature must not then act.
 */
export function runUpkeep(
  creature: Entity,
  species: SpeciesView,
  voxel: Entity,
  turn: number,
  log: EventLog,
): UpkeepOutcome {
  const state = creature.get(Creature);
  if (!state) return "starved";

  const age = state.age + 1;
  const energy = state.energy - species.life.metabolism;
  creature.set(Creature, { age, energy });

  // Living in a voxel draws on it whether or not the creature acts.
  for (const key of RESOURCE_KEYS) {
    const need = species.needs[key];
    if (need > 0) addDelta(voxel, key, -need * 0.1);
    const gives = species.provides[key];
    if (gives > 0) addDelta(voxel, key, gives * 0.1);
  }

  const outcome = causeOfDeath(age, energy, species, voxel);
  if (outcome === "alive") return "alive";

  die(creature, species, voxel, turn, log, outcome);
  return outcome;
}

function causeOfDeath(
  age: number,
  energy: number,
  species: SpeciesView,
  voxel: Entity,
): UpkeepOutcome {
  if (energy <= 0) return "starved";
  if (age > species.life.maxAge) return "aged";
  // Defensive: terrain does not change during a run, but a future mutation that
  // narrows a habitat could strand an existing creature.
  if (!habitable(species, voxel)) return "stranded";
  return "alive";
}

const REASON: Record<Exclude<UpkeepOutcome, "alive">, string> = {
  starved: "starved",
  aged: "died of old age",
  stranded: "could not survive here",
};

function die(
  creature: Entity,
  species: SpeciesView,
  voxel: Entity,
  turn: number,
  log: EventLog,
  outcome: Exclude<UpkeepOutcome, "alive">,
): void {
  // A corpse feeds the decomposers, closing the nutrient loop.
  depositDetritus(voxel, species.life.maxEnergy * DETRITUS_YIELD);

  const at = voxel.get(Voxel);
  log.push({
    turn,
    kind: "died",
    message: `${species.name} ${REASON[outcome]} at (${at?.x}, ${at?.y}, ${at?.z})`,
    speciesId: species.id,
    voxelIndex: at?.index,
  });

  creature.destroy();
}

/** Read a species entity's display name without a full `readSpecies`. */
export function speciesName(species: Entity): string {
  return species.get(Species)?.name ?? "unknown";
}
