import { describe, expect, it, vi } from "vitest";
import { createTestStore } from "../testing/world";
import { getRng, getTurn } from "../sim/world";

describe("createGameStore", () => {
  it("starts at turn 0 and advances one turn per step", () => {
    const store = createTestStore();
    expect(store.getSnapshot().turn).toBe(0);

    store.pass();
    expect(store.getSnapshot().turn).toBe(1);
    expect(getTurn(store.world)).toBe(1);
  });

  it("returns a referentially stable snapshot between steps", () => {
    // useSyncExternalStore re-renders forever if this ever fails.
    const store = createTestStore();
    expect(store.getSnapshot()).toBe(store.getSnapshot());

    const before = store.getSnapshot();
    store.pass();
    expect(store.getSnapshot()).not.toBe(before);
  });

  it("notifies subscribers on step and stops after unsubscribe", () => {
    const store = createTestStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.pass();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.pass();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("tracks voxel selection and notifies once per change", () => {
    const store = createTestStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.selectVoxel(12);
    expect(store.getSnapshot().selectedVoxel).toBe(12);
    expect(listener).toHaveBeenCalledTimes(1);

    // Pointer movement re-reports the same voxel constantly; that must not
    // turn into a React render per event.
    store.selectVoxel(12);
    store.selectVoxel(12);
    expect(listener).toHaveBeenCalledTimes(1);

    store.selectVoxel(null);
    expect(store.getSnapshot().selectedVoxel).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("clears selection on reset", () => {
    const store = createTestStore();
    store.selectVoxel(5);
    store.reset();
    expect(store.getSnapshot().selectedVoxel).toBeNull();
  });

  it("reseeds the world on reset", () => {
    const store = createTestStore({ seed: 1, size: { x: 2, y: 2, z: 2 } });
    store.pass();

    store.reset({ seed: 99, size: { x: 2, y: 2, z: 2 } });
    expect(store.getSnapshot().turn).toBe(0);
    expect(getRng(store.world).next()).toBe(getRng(createTestStore({ seed: 99, size: { x: 2, y: 2, z: 2 } }).world).next());
  });
});
