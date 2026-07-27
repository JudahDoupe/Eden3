import type { World } from "koota";
import { Clock, RunState, type Phase } from "../sim/traits";
import { bumpVersion, createSimWorld, DEFAULT_CONFIG, type SimConfig } from "../sim/world";

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
}

export interface GameStore {
  /** The live simulation world. Read freely; mutate only through this store. */
  readonly world: World;
  subscribe(listener: () => void): () => void;
  /** Referentially stable between version bumps, as `useSyncExternalStore` requires. */
  getSnapshot(): GameSnapshot;
  /** Advance the simulation one phase. */
  step(): void;
  /** Abandon the current run and start a fresh one. */
  reset(config?: SimConfig): void;
}

export function createGameStore(config: SimConfig = DEFAULT_CONFIG): GameStore {
  let world = createSimWorld(config);
  const listeners = new Set<() => void>();
  let snapshot: GameSnapshot = readSnapshot(world);

  function readSnapshot(w: World): GameSnapshot {
    const clock = w.get(Clock);
    const run = w.get(RunState);
    return {
      turn: clock?.turn ?? 0,
      phase: run?.phase ?? "player",
      version: run?.version ?? 0,
    };
  }

  /**
   * Recompute only when the version actually moved. Returning a fresh object
   * on every call would make `useSyncExternalStore` re-render forever.
   */
  function publish(): void {
    const next = readSnapshot(world);
    if (next.version === snapshot.version) return;
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

    step() {
      // TODO(M3): replace with `runSimulationPhase(world)`. Until the action
      // registry exists this only advances the clock, which is enough to prove
      // the sim -> store -> React path end to end.
      const clock = world.get(Clock);
      if (clock) world.set(Clock, { turn: clock.turn + 1 });
      bumpVersion(world);
      publish();
    },

    reset(next = config) {
      world = createSimWorld(next);
      snapshot = readSnapshot(world);
      for (const listener of listeners) listener();
    },
  };
}
