import { describe, expect, it } from "vitest";
import { bumpVersion, getRng, getTurn } from "./world";
import { createTestWorld } from "../testing/world";
import { RunState } from "./traits";

describe("createSimWorld", () => {
  it("builds a world with its singletons in place", () => {
    const world = createTestWorld();
    expect(getTurn(world)).toBe(0);
    expect(world.get(RunState)?.phase).toBe("player");
  });

  it("seeds the RNG from config, so a seed fully determines the run", () => {
    const a = getRng(createTestWorld({ seed: 1234, size: { x: 2, y: 2, z: 2 } }));
    const b = getRng(createTestWorld({ seed: 1234, size: { x: 2, y: 2, z: 2 } }));
    const c = getRng(createTestWorld({ seed: 4321, size: { x: 2, y: 2, z: 2 } }));

    const draw = (n: number) => Array.from({ length: 8 }, () => n);
    expect(draw(0).map(() => a.next())).toEqual(draw(0).map(() => b.next()));
    expect(c.next()).not.toBe(getRng(createTestWorld({ seed: 1234, size: { x: 2, y: 2, z: 2 } })).next());
  });

  it("gives each world an independent RNG stream", () => {
    const a = createTestWorld({ seed: 5, size: { x: 2, y: 2, z: 2 } });
    const b = createTestWorld({ seed: 5, size: { x: 2, y: 2, z: 2 } });
    getRng(a).next();
    // Advancing one world must not move the other.
    expect(getRng(b).snapshot()).not.toBe(getRng(a).snapshot());
  });

  it("bumps the version so the UI learns a phase completed", () => {
    const world = createTestWorld();
    const before = world.get(RunState)!.version;
    bumpVersion(world);
    expect(world.get(RunState)!.version).toBe(before + 1);
  });
});
