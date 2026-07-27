import type { World } from "koota";
import { createSimWorld, type SimConfig } from "../sim/world";
import { createGameStore, type GameStore } from "../game/store";

/**
 * World factories for tests.
 *
 * Koota allows at most 16 live worlds per process, so a suite that builds one
 * per test exhausts the pool partway through. Everything created here is
 * registered for teardown by the global `afterEach` in `test-setup.ts`.
 */

const worlds: World[] = [];
const stores: GameStore[] = [];

export function createTestWorld(overrides: Partial<SimConfig> = {}): World {
  const world = createSimWorld(overrides);
  worlds.push(world);
  return world;
}

export function createTestStore(overrides: Partial<SimConfig> = {}): GameStore {
  const store = createGameStore(overrides);
  stores.push(store);
  return store;
}

export function destroyTestWorlds(): void {
  for (const store of stores.splice(0)) store.dispose();
  for (const world of worlds.splice(0)) world.destroy();
}
