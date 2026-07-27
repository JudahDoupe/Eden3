import type { World } from "koota";
import { createEventLog, type EventLog, type SimEvent } from "../sim/events";
import { seedStartingLife } from "../sim/starters";
import { runSimulationPhase } from "../sim/step";
import { Creature, Extinct, RunState, Species, type Phase } from "../sim/traits";
import { createSimWorld, getTurn, type SimConfig } from "../sim/world";

/**
 * The single bridge between the simulation and everything that watches it.
 *
 * React subscribes here via `useSyncExternalStore` rather than to individual
 * koota traits. The simulation only mutates during a discrete phase step, so
 * one coarse notification per turn is both sufficient and far cheaper than
 * fine-grained reactivity across thousands of creatures.
 */
export interface GameSnapshot {
  turn: number;
  phase: Phase;
  version: number;
  /** Voxel the player is inspecting, or null. Drives targeting from M4 on. */
  selectedVoxel: number | null;
  population: number;
  livingSpecies: number;
  extinctSpecies: number;
}

export interface GameStore {
  /** The live simulation world. Read freely; mutate only through this store. */
  readonly world: World;
  subscribe(listener: () => void): () => void;
  /** Referentially stable while nothing has changed, as `useSyncExternalStore` requires. */
  getSnapshot(): GameSnapshot;
  /** Most recent events first. */
  events(limit?: number): readonly SimEvent[];
  /** Advance the simulation one phase. */
  step(): void;
  selectVoxel(index: number | null): void;
  /** Abandon the current run and start a fresh one. */
  reset(config?: Partial<SimConfig>): void;
  /** Release the underlying world. Koota allows only 16 live at once. */
  dispose(): void;
}

export function createGameStore(config: Partial<SimConfig> = {}): GameStore {
  let world = start(config);
  let log: EventLog = createEventLog();
  const listeners = new Set<() => void>();
  let selectedVoxel: number | null = null;
  let snapshot: GameSnapshot = read();

  function start(next: Partial<SimConfig>): World {
    const created = createSimWorld(next);
    seedStartingLife(created);
    return created;
  }

  function read(): GameSnapshot {
    const run = world.get(RunState);
    let living = 0;
    let extinct = 0;
    for (const species of world.query(Species)) {
      if (species.has(Extinct)) extinct++;
      else living++;
    }

    return {
      turn: getTurn(world),
      phase: run?.phase ?? "player",
      version: run?.version ?? 0,
      selectedVoxel,
      population: world.query(Creature).length,
      livingSpecies: living,
      extinctSpecies: extinct,
    };
  }

  function same(a: GameSnapshot, b: GameSnapshot): boolean {
    return (
      a.turn === b.turn &&
      a.phase === b.phase &&
      a.version === b.version &&
      a.selectedVoxel === b.selectedVoxel &&
      a.population === b.population &&
      a.livingSpecies === b.livingSpecies &&
      a.extinctSpecies === b.extinctSpecies
    );
  }

  /**
   * Swap in a new snapshot only when something actually changed. Returning a
   * fresh object on every call would make `useSyncExternalStore` re-render
   * forever, and pointer movement calls `selectVoxel` constantly.
   */
  function publish(): void {
    const next = read();
    if (same(next, snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }

  return {
    get world() {
      return world;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    events(limit) {
      return log.recent(limit);
    },

    step() {
      runSimulationPhase(world, log);
      publish();
    },

    selectVoxel(index) {
      selectedVoxel = index;
      publish();
    },

    reset(next = config) {
      // Koota caps live worlds at 16, so the old one must go or the 17th
      // restart of a session throws.
      world.destroy();
      world = start(next);
      log = createEventLog();
      selectedVoxel = null;
      snapshot = read();
      for (const listener of listeners) listener();
    },

    dispose() {
      listeners.clear();
      world.destroy();
    },
  };
}
