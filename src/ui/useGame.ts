import { createContext, useContext, useSyncExternalStore } from "react";
import type { GameSnapshot, GameStore } from "../game/store";

export const GameStoreContext = createContext<GameStore | null>(null);

export function useGameStore(): GameStore {
  const store = useContext(GameStoreContext);
  if (!store) throw new Error("useGameStore must be used inside a GameStoreContext provider");
  return store;
}

/**
 * Re-renders once per completed phase, never per frame. The store guarantees a
 * referentially stable snapshot between version bumps.
 */
export function useGameSnapshot(): GameSnapshot {
  const store = useGameStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
