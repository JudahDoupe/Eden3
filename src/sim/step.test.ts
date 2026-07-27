import { describe, expect, it } from "vitest";
import { createEventLog } from "./events";
import { runSimulationPhase, speciesInTrophicOrder } from "./step";
import { spawnCreature, spawnSpecies, type SpeciesDefinition } from "./species";
import { seedStartingLife } from "./starters";
import { Terrains } from "./terrain";
import { Creature, Extinct, OfSpecies, Species, Terrain } from "./traits";
import { getGrid, getTurn, voxelAt } from "./world";
import { createTestWorld } from "../testing/world";

const PRODUCER: SpeciesDefinition = {
  id: "algae",
  name: "Algae",
  colorHex: 0,
  tags: ["AQUATIC", "SESSILE", "PHOTOSYNTHETIC"],
  actions: ["PHOTOSYNTHESIZE", "SEED", "IDLE"],
  habitat: ["WATER"],
  needs: { light: 0.4, moisture: 0.5 },
};

const CONSUMER: SpeciesDefinition = {
  id: "fish",
  name: "Fish",
  colorHex: 0,
  tags: ["AQUATIC", "MOTILE", "HETEROTROPH", "VERTEBRATE"],
  actions: ["EAT", "SWIM", "REPRODUCE", "IDLE"],
  habitat: ["WATER"],
  diet: ["PHOTOSYNTHETIC"],
  needs: { oxygen: 0.3, moisture: 0.5 },
  locomotion: 1,
};

function waterVoxel(world: ReturnType<typeof createTestWorld>, skip = 0) {
  const grid = getGrid(world);
  let seen = 0;
  for (let index = 0; index < grid.count; index++) {
    const entity = voxelAt(world, index);
    if (entity?.get(Terrain)?.kind !== Terrains.bit.WATER) continue;
    if (seen++ < skip) continue;
    return entity;
  }
  throw new Error("no water voxel");
}

describe("speciesInTrophicOrder", () => {
  it("puts producers before consumers so energy flows within one turn", () => {
    const world = createTestWorld({ seed: 1 });
    spawnSpecies(world, CONSUMER);
    spawnSpecies(world, PRODUCER);

    const ids = speciesInTrophicOrder(world).map((entity) => entity.get(Species)!.id);
    expect(ids.indexOf("algae")).toBeLessThan(ids.indexOf("fish"));
  });

  it("is stable regardless of creation order", () => {
    const a = createTestWorld({ seed: 1 });
    spawnSpecies(a, PRODUCER);
    spawnSpecies(a, CONSUMER);

    const b = createTestWorld({ seed: 1 });
    spawnSpecies(b, CONSUMER);
    spawnSpecies(b, PRODUCER);

    expect(speciesInTrophicOrder(a).map((e) => e.get(Species)!.id)).toEqual(
      speciesInTrophicOrder(b).map((e) => e.get(Species)!.id),
    );
  });
});

describe("runSimulationPhase", () => {
  it("advances the clock exactly once per phase", () => {
    const world = createTestWorld({ seed: 1 });
    const log = createEventLog();
    seedStartingLife(world);

    runSimulationPhase(world, log);
    runSimulationPhase(world, log);
    expect(getTurn(world)).toBe(2);
  });

  it("ages every surviving creature by one", () => {
    const world = createTestWorld({ seed: 1 });
    const log = createEventLog();
    const { creature } = seedStartingLife(world);

    runSimulationPhase(world, log);
    expect(creature.get(Creature)!.age).toBe(1);
  });

  it("kills a creature that runs out of energy and logs why", () => {
    const world = createTestWorld({ seed: 1 });
    const log = createEventLog();
    const species = spawnSpecies(world, {
      ...PRODUCER,
      id: "doomed",
      name: "Doomed",
      actions: ["IDLE"],
      life: { metabolism: 1, startingEnergy: 0.5 },
    });
    const creature = spawnCreature(world, species, waterVoxel(world));

    runSimulationPhase(world, log);

    expect(creature.isAlive()).toBe(false);
    expect(log.recent().some((event) => event.kind === "died" && /starved/.test(event.message))).toBe(true);
  });

  it("marks a species extinct once when its last creature dies", () => {
    const world = createTestWorld({ seed: 1 });
    const log = createEventLog();
    const species = spawnSpecies(world, {
      ...PRODUCER,
      id: "doomed",
      name: "Doomed",
      actions: ["IDLE"],
      life: { metabolism: 1, startingEnergy: 0.5 },
    });
    spawnCreature(world, species, waterVoxel(world));

    runSimulationPhase(world, log);
    expect(species.has(Extinct)).toBe(true);
    expect(species.get(Extinct)!.turn).toBe(1);

    const extinctions = () => log.recent(500).filter((event) => event.kind === "extinct").length;
    const before = extinctions();
    runSimulationPhase(world, log);
    // Extinction is announced once, not every turn thereafter.
    expect(extinctions()).toBe(before);
  });

  it("lets a predator convert prey into its own energy", () => {
    const world = createTestWorld({ seed: 1 });
    const log = createEventLog();
    const voxel = waterVoxel(world);

    const algae = spawnSpecies(world, PRODUCER);
    const fish = spawnSpecies(world, CONSUMER);
    spawnCreature(world, algae, voxel, 1);
    const predator = spawnCreature(world, fish, voxel, 0.3);

    const before = predator.get(Creature)!.energy;
    runSimulationPhase(world, log);

    expect(predator.get(Creature)!.energy).toBeGreaterThan(before);
    expect(log.recent().some((event) => event.kind === "ate")).toBe(true);
  });

  it("does not let a creature born this turn also act this turn", () => {
    // The species list is snapshotted before iterating, so newborns wait.
    const world = createTestWorld({ seed: 1 });
    const log = createEventLog();
    const species = spawnSpecies(world, { ...PRODUCER, id: "spreader" });
    spawnCreature(world, species, waterVoxel(world), 1);

    runSimulationPhase(world, log);

    for (const creature of world.query(Creature, OfSpecies(species))) {
      expect(creature.get(Creature)!.age).toBeLessThanOrEqual(1);
    }
  });
});
