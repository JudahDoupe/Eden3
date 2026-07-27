import { describe, expect, it } from "vitest";
import { createDeck } from "./deck";
import { DEADLOCK_LIMIT, evaluateRun, hasLegalPlay } from "./runState";
import { Rng } from "../sim/rng";
import { seedStartingLife } from "../sim/starters";
import { Creature } from "../sim/traits";
import { createTestWorld } from "../testing/world";

function startedWorld() {
  const world = createTestWorld({ seed: 1 });
  seedStartingLife(world);
  return world;
}

describe("evaluateRun", () => {
  it("keeps playing while cards remain and life persists", () => {
    const world = startedWorld();
    expect(evaluateRun(world, createDeck(new Rng(1)), 0).phase).toBe("player");
  });

  it("wins when the deck and hand are both empty", () => {
    const world = startedWorld();
    const outcome = evaluateRun(world, { draw: [], hand: [] }, 0);
    expect(outcome.phase).toBe("won");
    expect(outcome.reason).toBeTruthy();
  });

  it("does not win on an empty hand while the deck still holds cards", () => {
    const world = startedWorld();
    expect(evaluateRun(world, { draw: ["algae"], hand: [] }, 0).phase).toBe("player");
  });

  it("loses on total extinction", () => {
    const world = startedWorld();
    for (const creature of world.query(Creature)) creature.destroy();

    const outcome = evaluateRun(world, createDeck(new Rng(1)), 0);
    expect(outcome.phase).toBe("lost");
    expect(outcome.reason).toMatch(/died/i);
  });

  it("loses on a deadlock streak, not a single stuck turn", () => {
    const world = startedWorld();
    const deck = createDeck(new Rng(1));

    expect(evaluateRun(world, deck, DEADLOCK_LIMIT - 1).phase).toBe("player");
    expect(evaluateRun(world, deck, DEADLOCK_LIMIT).phase).toBe("lost");
    expect(evaluateRun(world, deck, DEADLOCK_LIMIT).reason).toMatch(/playable/i);
  });

  it("prefers the win when the deck empties on the same turn life ends", () => {
    // Emptying the deck is the goal; it should not be overridden by a
    // simultaneous extinction.
    const world = startedWorld();
    for (const creature of world.query(Creature)) creature.destroy();
    expect(evaluateRun(world, { draw: [], hand: [] }, 99).phase).toBe("won");
  });
});

describe("hasLegalPlay", () => {
  it("is true at the start of a run", () => {
    expect(hasLegalPlay(startedWorld(), createDeck(new Rng(1)))).toBe(true);
  });

  it("is false for a hand of cards nothing satisfies", () => {
    const world = startedWorld();
    expect(hasLegalPlay(world, { draw: [], hand: ["flower", "tree", "fungus"] })).toBe(false);
  });

  it("is false for an empty hand", () => {
    expect(hasLegalPlay(startedWorld(), { draw: ["algae"], hand: [] })).toBe(false);
  });
});
