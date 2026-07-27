import type { World } from "koota";
import { describe, expect, it } from "vitest";
import { cardById } from "./cards";
import { inspectSpecies } from "./inspect";
import { cardPlayability } from "./legality";
import { playCard } from "./playCard";
import { createEventLog, type EventLog } from "../sim/events";
import { seedStartingLife } from "../sim/starters";
import { Creature, Extinct } from "../sim/traits";
import { createTestWorld } from "../testing/world";

function startedWorld(): { world: World; log: EventLog } {
  const world = createTestWorld({ seed: 1 });
  seedStartingLife(world);
  return { world, log: createEventLog() };
}

function play(world: World, log: EventLog, cardId: string) {
  const card = cardById(cardId);
  const [target] = cardPlayability(world, card).targets;
  if (!target) throw new Error(`${cardId} has no legal target`);
  return playCard(world, card, target, log);
}

describe("inspectSpecies", () => {
  it("reports the starting organism as a root", () => {
    const { world } = startedWorld();
    const [amoeba] = inspectSpecies(world);

    expect(amoeba!.id).toBe("amoeba");
    expect(amoeba!.parentId).toBeNull();
    expect(amoeba!.depth).toBe(0);
    expect(amoeba!.population).toBe(1);
    expect(amoeba!.extinctTurn).toBeNull();
  });

  it("nests a mutation under the species it branched from", () => {
    const { world, log } = startedWorld();
    play(world, log, "algae");

    const species = inspectSpecies(world);
    const algae = species.find((entry) => entry.id === "algae")!;

    expect(algae.parentId).toBe("amoeba");
    expect(algae.depth).toBe(1);
  });

  it("orders the tree depth-first, so indenting alone renders it", () => {
    const { world, log } = startedWorld();
    play(world, log, "algae");
    play(world, log, "fish");

    const order = inspectSpecies(world).map((entry) => entry.id);
    // Both branch off the amoeba, so it must come first.
    expect(order[0]).toBe("amoeba");
    expect(order).toContain("algae");
    expect(order).toContain("fish");
    expect(order).toHaveLength(3);
  });

  it("tracks depth down a chain of mutations", () => {
    const { world, log } = startedWorld();
    play(world, log, "fish");
    play(world, log, "salamander");

    const byId = new Map(inspectSpecies(world).map((entry) => [entry.id, entry]));
    expect(byId.get("fish")!.depth).toBe(1);
    expect(byId.get("salamander")!.depth).toBe(2);
    expect(byId.get("salamander")!.parentId).toBe("fish");
  });

  it("keeps an extinct branch in the tree", () => {
    // A lineage you lost is part of the run's story, and usually the reason a
    // later card is stuck.
    const { world, log } = startedWorld();
    const algae = play(world, log, "algae");
    for (const creature of world.query(Creature)) creature.destroy();
    algae.add(Extinct);
    algae.set(Extinct, { turn: 7 });

    const entry = inspectSpecies(world).find((row) => row.id === "algae")!;
    expect(entry.extinctTurn).not.toBeNull();
    expect(entry.parentId).toBe("amoeba");
  });

  it("carries colour and tags for the swatch and tooltip", () => {
    const { world, log } = startedWorld();
    play(world, log, "algae");

    const algae = inspectSpecies(world).find((entry) => entry.id === "algae")!;
    expect(algae.colorHex).toBe(cardById("algae").colorHex);
    expect(algae.tags).toContain("PHOTOSYNTHETIC");
  });
});
