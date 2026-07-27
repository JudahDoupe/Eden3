import type { World } from "koota";
import { applyEnvironment } from "../sim/resources";
import { Clock, RunState, type Phase } from "../sim/traits";
import { bumpVersion, createSimWorld, type SimConfig } from "../sim/world";

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
}

export interface GameStore {
  /** The live simulation world. Read freely; mutate only through this store. */
  readonly world: World;
  subscribe(listener: () => void): () => void;
  /** Referentially stable while nothing has changed, as `useSyncExternalStore` requires. */
  getSnapshot(): GameSnapshot;
  /** Advance the simulation one phase. */
  step(): void;
  selectVoxel(index: number | null): void;
  /** Abandon the current run and start a fresh one. */
  reset(config?: Partial<SimConfig>): void;
}

export function createGameStore(config: Partial<SimConfig> = {}): GameStore {
  let world = createSimWorld(config);
  const listeners = new Set<() => void>();
  let selectedVoxel: number | null = null;
  let snapshot: GameSnapshot = read();

  function read(): GameSnapshot {
    const clock = world.get(Clock);
    const run = world.get(RunState);
    return {
      turn: clock?.turn ?? 0,
      phase: run?.phase ?? "player",
      version: run?.version ?? 0,
      selectedVoxel,
    };
  }

  function same(a: GameSnapshot, b: GameSnapshot): boolean {
    return (
      a.turn === b.turn &&
      a.phase === b.phase &&
      a.version === b.version &&
      a.selectedVoxel === b.selectedVoxel
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

    step() {
      // TODO(M3): replace with `runSimulationPhase(world)`. Until creatures
      // exist there is nothing to simulate before the environment settles.
      const clock = world.get(Clock);
      if (clock) world.set(Clock, { turn: clock.turn + 1 });
      applyEnvironment(world);
      bumpVersion(world);
      publish();
    },

    selectVoxel(index) {
      selectedVoxel = index;
      publish();
    },

    reset(next = config) {
      world = createSimWorld(next);
      selectedVoxel = null;
      snapshot = read();
      for (const listener of listeners) listener();
    },
  };
}
