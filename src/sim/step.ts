import type { Entity, World } from "koota";
import { chooseAndPerformAction } from "./actions";
import type { ActionContext } from "./actions/types";
import type { EventLog } from "./events";
import { applyEnvironment } from "./resources";
import type { Rng } from "./rng";
import { readSpecies, type SpeciesView } from "./species";
import { Tags } from "./tags";
import {
  Clock,
  Creature,
  Extinct,
  InVoxel,
  OfSpecies,
  Species,
  SpeciesTags,
  Voxel,
} from "./traits";
import { runUpkeep } from "./upkeep";
import { bumpVersion, getGrid, getRng, getTurn, voxelAt } from "./world";

/**
 * One full simulation phase: every creature of every species takes a turn, then
 * the environment settles and extinctions are recorded.
 */
export function runSimulationPhase(world: World, log: EventLog): void {
  const turn = getTurn(world) + 1;
  world.set(Clock, { turn });

  const rng = getRng(world);

  for (const speciesEntity of speciesInTrophicOrder(world)) {
    const species = readSpecies(speciesEntity);

    // Snapshot before iterating: creatures spawn and die during the pass, and a
    // live query would let a newborn act on the turn it was born.
    const creatures = [...world.query(Creature, OfSpecies(speciesEntity))];
    rng.shuffle(creatures);

    for (const creature of creatures) {
      if (!creature.isAlive()) continue;

      const voxel = creature.targetFor(InVoxel);
      if (!voxel) continue;

      if (runUpkeep(creature, species, voxel, turn, log) !== "alive") continue;

      const ctx = createContext(world, rng, turn, creature, species, voxel, log);
      if (ctx) chooseAndPerformAction(ctx);
    }
  }

  applyEnvironment(world);
  recordExtinctions(world, turn, log);
  bumpVersion(world);
}

/**
 * Producers before consumers, so a food web resolves in the direction energy
 * flows within a single turn rather than lagging one turn behind.
 * Ties break on species id, which keeps the order stable across runs.
 */
export function speciesInTrophicOrder(world: World): Entity[] {
  return [...world.query(Species, SpeciesTags)]
    .map((entity) => ({
      entity,
      level: trophicLevel(entity.get(SpeciesTags)?.mask ?? 0),
      id: entity.get(Species)?.id ?? "",
    }))
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
    .map((row) => row.entity);
}

function trophicLevel(tags: number): number {
  if (Tags.hasAny(tags, Tags.mask("PHOTOSYNTHETIC", "DECOMPOSER"))) return 0;
  if (Tags.hasAny(tags, Tags.mask("HETEROTROPH"))) return 1;
  return 2;
}

/** Flag species that have just lost their last creature. */
function recordExtinctions(world: World, turn: number, log: EventLog): void {
  for (const speciesEntity of world.query(Species)) {
    if (speciesEntity.has(Extinct)) continue;
    if (world.query(Creature, OfSpecies(speciesEntity)).length > 0) continue;

    speciesEntity.add(Extinct);
    speciesEntity.set(Extinct, { turn });
    log.push({
      turn,
      kind: "extinct",
      message: `${speciesEntity.get(Species)?.name ?? "a species"} went extinct`,
      speciesId: speciesEntity.get(Species)?.id,
    });
  }
}

/**
 * Assemble the context an action scores and acts against.
 *
 * Exported so the UI can build one for `explainActions` without stepping the
 * simulation — that read-only path is what powers the action inspector.
 */
export function createContext(
  world: World,
  rng: Rng,
  turn: number,
  creature: Entity,
  species: SpeciesView,
  voxel: Entity,
  log: EventLog,
): ActionContext | null {
  const state = creature.get(Creature);
  const position = voxel.get(Voxel);
  if (!state || !position) return null;

  const grid = getGrid(world);
  const rangeCache = new Map<number, Entity[]>();

  return {
    world,
    rng,
    turn,
    creature,
    age: state.age,
    energy: state.energy,
    species,
    voxel,
    voxelIndex: position.index,
    log,

    inRange(range) {
      // Several actions ask for the same radius in one turn; the neighbourhood
      // is fixed for the duration of a single creature's turn.
      const cached = rangeCache.get(range);
      if (cached) return cached;

      const entities: Entity[] = [];
      for (const index of grid.inRange(position.index, range)) {
        const neighbour = voxelAt(world, index);
        if (neighbour) entities.push(neighbour);
      }
      rangeCache.set(range, entities);
      return entities;
    },

    coLocated() {
      return [...world.query(Creature, InVoxel(voxel))].filter((other) => other !== creature);
    },
  };
}
