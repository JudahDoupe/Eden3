import { describe, expect, it } from "vitest";
import { createEventLog } from "./events";
import { explainCreature } from "./inspectCreature";
import { MAX_RESOURCE, RESOURCE_KEYS } from "./resources";
import { seedStartingLife } from "./starters";
import { runSimulationPhase } from "./step";
import { Creature, Resources, Voxel } from "./traits";
import { createTestWorld } from "../testing/world";
import { hashWorld, occupancy } from "../testing/snapshot";

/**
 * The long-run health check, and the harness the balance pass is tuned against.
 *
 * These assertions are deliberately about *shape* rather than exact numbers —
 * populations are meant to move. What must never happen is a NaN, a resource
 * escaping its range, two creatures of one species sharing a voxel, or the
 * starting world dying instantly or exploding without bound.
 */

const TURNS = 500;

function run(seed: number, turns = TURNS) {
  const world = createTestWorld({ seed });
  const log = createEventLog();
  seedStartingLife(world);
  for (let turn = 0; turn < turns; turn++) runSimulationPhase(world, log);
  return { world, log };
}

describe(`a ${TURNS}-turn unattended run`, () => {
  it("never produces NaN or escapes the resource range", () => {
    const { world } = run(1);
    world.query(Voxel, Resources).readEach(([voxel, levels]) => {
      for (const key of RESOURCE_KEYS) {
        expect(Number.isFinite(levels[key]), `voxel ${voxel.index} ${key}`).toBe(true);
        expect(levels[key]).toBeGreaterThanOrEqual(0);
        expect(levels[key]).toBeLessThanOrEqual(MAX_RESOURCE);
      }
    });
  });

  it("keeps creature energy and age finite and non-negative", () => {
    const { world } = run(1);
    world.query(Creature).forEach((creature) => {
      const state = creature.get(Creature)!;
      expect(Number.isFinite(state.energy)).toBe(true);
      expect(Number.isFinite(state.age)).toBe(true);
      expect(state.age).toBeGreaterThanOrEqual(0);
    });
  });

  it("never puts two creatures of one species in the same voxel", () => {
    // The core invariant of the model: a creature entity *is* the local
    // population of its species in that voxel.
    for (const seed of [1, 2, 3]) {
      const { world } = run(seed, 200);
      for (const [key, count] of occupancy(world)) {
        expect(count, `${key} held ${count} creatures`).toBe(1);
      }
    }
  });

  it("does not collapse immediately or grow without bound", () => {
    for (const seed of [1, 2, 3, 4]) {
      const { world } = run(seed, 200);
      const population = world.query(Creature).length;
      expect(population, `seed ${seed} went extinct`).toBeGreaterThan(0);
      // Carrying capacity is one creature per habitable voxel per species.
      expect(population, `seed ${seed} exploded`).toBeLessThanOrEqual(world.query(Voxel).length);
    }
  });

  it("keeps the population turning over rather than freezing", () => {
    // A world where nothing is born or dies is stable in the wrong way.
    const { log } = run(1, 200);
    const recent = log.recent(200);
    expect(recent.some((event) => event.kind === "born")).toBe(true);
    expect(recent.some((event) => event.kind === "died")).toBe(true);
  });
});

describe("determinism", () => {
  it("produces byte-identical worlds from the same seed", () => {
    // Catches a stray Math.random(), an unstable sort, and any dependence on
    // object iteration order.
    const a = run(7, 100);
    const b = run(7, 100);
    expect(hashWorld(a.world)).toBe(hashWorld(b.world));
  });

  it("produces different worlds from different seeds", () => {
    expect(hashWorld(run(7, 100).world)).not.toBe(hashWorld(run(8, 100).world));
  });

  it("stays identical when the inspector is consulted mid-run", () => {
    // `explainActions` must not touch the RNG, or opening a panel would change
    // the run. This exercises that end to end.
    const plain = run(11, 60);

    const world = createTestWorld({ seed: 11 });
    const log = createEventLog();
    seedStartingLife(world);
    for (let turn = 0; turn < 60; turn++) {
      runSimulationPhase(world, log);
      inspectEveryCreature(world);
    }

    expect(hashWorld(world)).toBe(hashWorld(plain.world));
  });
});

/** Mirrors what the action inspector does when a creature is selected. */
function inspectEveryCreature(world: ReturnType<typeof createTestWorld>): void {
  for (const creature of world.query(Creature)) {
    explainCreature(world, creature);
  }
}

