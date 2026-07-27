import type { Entity, World } from "koota";
import { beforeEach, describe, expect, it } from "vitest";
import { ACTION_LIST, ACTIONS, chooseAndPerformAction, explainActions } from "./index";
import { ACTION_NAMES } from "./ids";
import { createEventLog, type EventLog } from "../events";
import { readSpecies, spawnCreature, spawnSpecies, type SpeciesDefinition } from "../species";
import { createContext } from "../step";
import { Terrains } from "../terrain";
import { Creature, Resources, Terrain, Voxel } from "../traits";
import { getGrid, getRng, voxelAt } from "../world";
import { createTestWorld } from "../../testing/world";

const SWIMMER: SpeciesDefinition = {
  id: "swimmer",
  name: "Swimmer",
  colorHex: 0,
  tags: ["AQUATIC", "MOTILE", "DECOMPOSER"],
  actions: ["SWIM", "DECOMPOSE", "REPRODUCE", "IDLE"],
  habitat: ["WATER"],
  needs: { moisture: 0.5 },
  locomotion: 1,
};

interface Fixture {
  world: World;
  log: EventLog;
  context(definition: SpeciesDefinition, energy?: number): ReturnType<typeof createContext>;
}

function fixture(): Fixture {
  const world = createTestWorld({ seed: 1 });
  const log = createEventLog();

  return {
    world,
    log,
    context(definition, energy) {
      const species = spawnSpecies(world, definition);
      const voxel = firstVoxelOfKind(world, Terrains.bit.WATER);
      const creature = spawnCreature(world, species, voxel, energy);
      return createContext(world, getRng(world), 1, creature, readSpecies(species), voxel, log);
    },
  };
}

function firstVoxelOfKind(world: World, kind: number): Entity {
  const grid = getGrid(world);
  for (let index = 0; index < grid.count; index++) {
    const entity = voxelAt(world, index);
    if (entity?.get(Terrain)?.kind === kind) return entity;
  }
  throw new Error(`no voxel of kind ${kind}`);
}

describe("the action registry", () => {
  it("registers every declared action exactly once", () => {
    expect(ACTION_LIST).toHaveLength(ACTION_NAMES.length);
    expect(ACTION_LIST.map((action) => action.id)).toEqual([...ACTION_NAMES]);
  });

  it("keys every entry by its own id, so the tie-break order is real", () => {
    for (const name of ACTION_NAMES) expect(ACTIONS[name].id).toBe(name);
  });
});

describe("tag gating", () => {
  let f: Fixture;
  beforeEach(() => {
    f = fixture();
  });

  it("blocks an owned action when the species lacks its tags", () => {
    // Owns SWIM, but a mutation took AQUATIC away.
    const landlocked: SpeciesDefinition = {
      ...SWIMMER,
      id: "landlocked",
      tags: ["TERRESTRIAL", "MOTILE", "DECOMPOSER"],
      habitat: ["WATER"],
    };
    const ctx = f.context(landlocked)!;

    const swim = explainActions(ctx).candidates.find((c) => c.id === "SWIM")!;
    expect(swim.owned).toBe(true);
    expect(swim.gated).toBe(true);
    expect(swim.eligible).toBe(false);
  });

  it("names the missing tag, so the loss is explainable", () => {
    const landlocked: SpeciesDefinition = {
      ...SWIMMER,
      id: "landlocked",
      tags: ["TERRESTRIAL", "MOTILE", "DECOMPOSER"],
    };
    const swim = explainActions(f.context(landlocked)!).candidates.find((c) => c.id === "SWIM")!;
    expect(swim.missingTags).toEqual(["AQUATIC"]);
  });

  it("never performs a gated action", () => {
    const landlocked: SpeciesDefinition = {
      ...SWIMMER,
      id: "landlocked",
      tags: ["TERRESTRIAL", "MOTILE", "DECOMPOSER"],
    };
    const ctx = f.context(landlocked)!;
    for (let turn = 0; turn < 20; turn++) {
      expect(chooseAndPerformAction({ ...ctx, turn })).not.toBe("SWIM");
    }
  });

  it("marks an unowned action as unowned rather than gated", () => {
    const ctx = f.context(SWIMMER)!;
    const fly = explainActions(ctx).candidates.find((c) => c.id === "FLY")!;
    expect(fly.owned).toBe(false);
    expect(fly.eligible).toBe(false);
  });

  it("reports every action, owned or not, so nothing is invisible", () => {
    const ctx = f.context(SWIMMER)!;
    expect(explainActions(ctx).candidates.map((c) => c.id)).toEqual([...ACTION_NAMES]);
  });
});

describe("utility selection", () => {
  let f: Fixture;
  beforeEach(() => {
    f = fixture();
  });

  it("always has a candidate, because Idle is ungated", () => {
    const inert: SpeciesDefinition = {
      id: "inert",
      name: "Inert",
      colorHex: 0,
      tags: [],
      actions: ["IDLE"],
      habitat: ["WATER"],
    };
    expect(chooseAndPerformAction(f.context(inert)!)).toBe("IDLE");
  });

  it("prefers feeding when hungry over idling", () => {
    const ctx = f.context(SWIMMER, 0.05)!;
    expect(chooseAndPerformAction(ctx)).toBe("DECOMPOSE");
  });

  it("prefers reproducing when full", () => {
    const ctx = f.context(SWIMMER, 1)!;
    expect(chooseAndPerformAction(ctx)).toBe("REPRODUCE");
  });

  it("respects per-species weights", () => {
    const lazy: SpeciesDefinition = { ...SWIMMER, id: "lazy", actionWeights: { DECOMPOSE: 0.01 } };
    // Starving, but weighted so far down that idling wins instead.
    expect(chooseAndPerformAction(f.context(lazy, 0.05)!)).toBe("IDLE");
  });

  it("is deterministic for identical state", () => {
    const a = fixture().context(SWIMMER, 0.4)!;
    const b = fixture().context(SWIMMER, 0.4)!;
    expect(explainActions(a).chosen).toBe(explainActions(b).chosen);
  });

  it("produces identical scores on repeated evaluation", () => {
    const ctx = f.context(SWIMMER, 0.4)!;
    const first = explainActions(ctx).candidates.map((c) => c.weightedScore);
    const second = explainActions(ctx).candidates.map((c) => c.weightedScore);
    expect(second).toEqual(first);
  });
});

describe("explainActions", () => {
  it("does not mutate the world or advance the RNG", () => {
    // The UI calls this freely between turns; if it consumed randomness the act
    // of opening an inspector would change the run.
    const f = fixture();
    const ctx = f.context(SWIMMER, 0.4)!;

    const rngBefore = getRng(f.world).snapshot();
    const energyBefore = ctx.creature.get(Creature)!.energy;
    const resourcesBefore = ctx.voxel.get(Resources)!.nutrients;

    for (let i = 0; i < 5; i++) explainActions(ctx);

    expect(getRng(f.world).snapshot()).toBe(rngBefore);
    expect(ctx.creature.get(Creature)!.energy).toBe(energyBefore);
    expect(ctx.voxel.get(Resources)!.nutrients).toBe(resourcesBefore);
  });

  it("agrees with what chooseAndPerformAction actually does", () => {
    const f = fixture();
    const ctx = f.context(SWIMMER, 0.4)!;
    expect(chooseAndPerformAction(ctx)).toBe(explainActions(ctx).chosen);
  });
});

describe("upkeep isolation", () => {
  it("no action ages or kills the creature performing it", () => {
    // Ageing and death belong to upkeep alone. If an action could do either,
    // a starving creature could out-score its own death.
    for (const action of ACTION_LIST) {
      const f = fixture();
      const permissive: SpeciesDefinition = {
        ...SWIMMER,
        id: `probe-${action.id}`,
        tags: ["AQUATIC", "TERRESTRIAL", "AERIAL", "MOTILE", "SESSILE", "PHOTOSYNTHETIC", "HETEROTROPH", "DECOMPOSER"],
        actions: [...ACTION_NAMES],
        habitat: ["WATER", "SOIL", "AIR"],
      };
      const ctx = f.context(permissive, 0.9)!;
      const ageBefore = ctx.creature.get(Creature)!.age;

      action.perform(ctx);

      expect(ctx.creature.isAlive(), `${action.id} destroyed its own creature`).toBe(true);
      expect(ctx.creature.get(Creature)!.age, `${action.id} changed age`).toBe(ageBefore);
    }
  });
});

describe("movement", () => {
  it("never moves onto a voxel already holding the same species", () => {
    // A creature entity is the local population of its species, so two of the
    // same species in one voxel is incoherent.
    const f = fixture();
    const species = spawnSpecies(f.world, SWIMMER);
    const view = readSpecies(species);
    const water = firstVoxelOfKind(f.world, Terrains.bit.WATER);

    const grid = getGrid(f.world);
    const neighbours = grid
      .inRange(water.get(Voxel)!.index, 1)
      .map((index) => voxelAt(f.world, index)!)
      .filter((entity) => entity.get(Terrain)?.kind === Terrains.bit.WATER);

    // Fill every reachable water voxel with this species.
    for (const neighbour of neighbours) spawnCreature(f.world, species, neighbour, 0.5);
    const mover = spawnCreature(f.world, species, water, 0.5);

    const ctx = createContext(f.world, getRng(f.world), 1, mover, view, water, f.log)!;
    expect(explainActions(ctx).candidates.find((c) => c.id === "SWIM")!.rawScore).toBe(0);
  });
});
