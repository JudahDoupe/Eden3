import type { Entity, World } from "koota";
import { ActionIds, type ActionName } from "./actions/ids";
import type { ResourceLevels } from "./resources";
import { Tags, type TagName } from "./tags";
import { Terrains, type TerrainName } from "./terrain";
import {
  ActionWeights,
  Creature,
  DescendedFrom,
  Diet,
  Habitat,
  InVoxel,
  Life,
  Locomotion,
  Needs,
  OfSpecies,
  Provides,
  Species,
  SpeciesActions,
  SpeciesTags,
} from "./traits";

export interface LifeConfig {
  maxAge: number;
  metabolism: number;
  maxEnergy: number;
  startingEnergy: number;
  reproduceThreshold: number;
  reproduceCost: number;
}

/**
 * The data a species is built from. Mutation cards produce these, which is why
 * this lives in `sim/` while the card library lives in `game/`.
 */
export interface SpeciesDefinition {
  id: string;
  name: string;
  colorHex: number;
  /** The card that produced this species, if any. */
  cardId?: string;
  tags: readonly TagName[];
  actions: readonly ActionName[];
  habitat: readonly TerrainName[];
  needs?: Partial<ResourceLevels>;
  provides?: Partial<ResourceLevels>;
  /** Tags this species can eat. */
  diet?: readonly TagName[];
  locomotion?: number;
  life?: Partial<LifeConfig>;
  actionWeights?: Partial<Record<ActionName, number>>;
}

/** A species' data, read once per phase rather than per action evaluation. */
export interface SpeciesView {
  entity: Entity;
  id: string;
  name: string;
  colorHex: number;
  tags: number;
  actions: number;
  habitat: number;
  diet: number;
  locomotion: number;
  needs: ResourceLevels;
  provides: ResourceLevels;
  life: LifeConfig;
  weights: Partial<Record<ActionName, number>>;
}

const NO_RESOURCES: ResourceLevels = { light: 0, oxygen: 0, nutrients: 0, moisture: 0 };

export const DEFAULT_LIFE: LifeConfig = {
  maxAge: 20,
  metabolism: 0.05,
  maxEnergy: 1,
  startingEnergy: 0.5,
  reproduceThreshold: 0.7,
  reproduceCost: 0.35,
};

/**
 * Create a species entity.
 *
 * `parent` records the lineage and is what makes a mutation a *branch*: the
 * parent species is untouched and keeps its own creatures.
 */
export function spawnSpecies(
  world: World,
  definition: SpeciesDefinition,
  parent?: Entity,
): Entity {
  const life = { ...DEFAULT_LIFE, ...definition.life };

  const entity = world.spawn(
    Species({
      id: definition.id,
      name: definition.name,
      colorHex: definition.colorHex,
      cardId: definition.cardId ?? "",
    }),
    SpeciesTags({ mask: Tags.maskOf(definition.tags) }),
    SpeciesActions({ mask: ActionIds.maskOf(definition.actions) }),
    Habitat({ terrainMask: Terrains.maskOf(definition.habitat) }),
    Diet({ preyTagMask: Tags.maskOf(definition.diet ?? []) }),
    Locomotion({ range: definition.locomotion ?? 0 }),
    Needs({ ...NO_RESOURCES, ...definition.needs }),
    Provides({ ...NO_RESOURCES, ...definition.provides }),
    Life(life),
  );

  entity.add(ActionWeights);
  entity.set(ActionWeights, { ...definition.actionWeights });

  if (parent) entity.add(DescendedFrom(parent));

  return entity;
}

/** Read a species entity into the flat shape actions consume. */
export function readSpecies(entity: Entity): SpeciesView {
  const species = entity.get(Species);
  const tags = entity.get(SpeciesTags);
  const actions = entity.get(SpeciesActions);
  const habitat = entity.get(Habitat);
  const diet = entity.get(Diet);
  const locomotion = entity.get(Locomotion);
  const needs = entity.get(Needs);
  const provides = entity.get(Provides);
  const life = entity.get(Life);
  const weights = entity.get(ActionWeights);

  if (!species || !tags || !actions || !habitat || !diet || !locomotion || !needs || !provides || !life) {
    throw new Error("readSpecies: entity is not a species — was it built by spawnSpecies?");
  }

  return {
    entity,
    id: species.id,
    name: species.name,
    colorHex: species.colorHex,
    tags: tags.mask,
    actions: actions.mask,
    habitat: habitat.terrainMask,
    diet: diet.preyTagMask,
    locomotion: locomotion.range,
    needs: { ...needs },
    provides: { ...provides },
    life: { ...life },
    weights: weights ?? {},
  };
}

/** Place one creature of `species` into `voxel`. */
export function spawnCreature(
  world: World,
  species: Entity,
  voxel: Entity,
  energy?: number,
): Entity {
  const life = species.get(Life) ?? DEFAULT_LIFE;
  return world.spawn(
    Creature({ age: 0, energy: energy ?? life.startingEnergy }),
    OfSpecies(species),
    InVoxel(voxel),
  );
}

export function creaturesOf(world: World, species: Entity): Entity[] {
  return [...world.query(Creature, OfSpecies(species))];
}

export function creaturesIn(world: World, voxel: Entity): Entity[] {
  return [...world.query(Creature, InVoxel(voxel))];
}

export function allSpecies(world: World): Entity[] {
  return [...world.query(Species)];
}
