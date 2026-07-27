import type { Entity, World } from "koota";
import type { ActionCandidate } from "../sim/actions";
import type { ActionName } from "../sim/actions/ids";
import type { Coords } from "../sim/grid";
import { explainCreature } from "../sim/inspectCreature";
import type { ResourceLevels } from "../sim/resources";
import { creaturesIn } from "../sim/species";
import { terrainName, type TerrainName } from "../sim/terrain";
import {
  Creature,
  DescendedFrom,
  Extinct,
  Life,
  OfSpecies,
  ResourceBaseline,
  Resources,
  Species,
  SpeciesTags,
  Terrain,
  Voxel,
} from "../sim/traits";
import { Tags, type TagName } from "../sim/tags";
import { voxelAt } from "../sim/world";

/**
 * Read-only view models for the UI.
 *
 * The UI never queries koota directly; it asks here. That keeps trait layout an
 * implementation detail of `sim/` and gives every panel one shape to render.
 */

export interface CreatureInfo {
  id: number;
  speciesId: string;
  speciesName: string;
  colorHex: number;
  tags: TagName[];
  age: number;
  maxAge: number;
  energy: number;
  maxEnergy: number;
  /** Full candidate table from explain mode — owned, gated, scored. */
  actions: ActionCandidate[];
  /** What it would do if the simulation stepped now. */
  chosen: ActionName | null;
}

export interface VoxelInfo {
  index: number;
  coords: Coords;
  terrain: TerrainName;
  resources: ResourceLevels;
  /** What the voxel drifts back toward — the reference for reading depletion. */
  baseline: ResourceLevels;
  creatures: CreatureInfo[];
}

export interface SpeciesInfo {
  id: string;
  name: string;
  colorHex: number;
  tags: TagName[];
  population: number;
  extinctTurn: number | null;
  /** The species this one mutated from, or null for the starting organism. */
  parentId: string | null;
  /** Generations from the root, for indenting the lineage tree. */
  depth: number;
}

export function inspectVoxel(world: World, index: number): VoxelInfo | null {
  const entity = voxelAt(world, index);
  if (!entity) return null;

  const voxel = entity.get(Voxel);
  const terrain = entity.get(Terrain);
  const resources = entity.get(Resources);
  const baseline = entity.get(ResourceBaseline);
  if (!voxel || !terrain || !resources || !baseline) return null;

  return {
    index,
    coords: { x: voxel.x, y: voxel.y, z: voxel.z },
    terrain: terrainName(terrain.kind),
    resources: { ...resources },
    baseline: { ...baseline },
    creatures: creaturesIn(world, entity)
      .map((creature) => inspectCreature(world, creature))
      .filter((info): info is CreatureInfo => info !== null),
  };
}

/**
 * One creature, including *why* it will do what it does next.
 *
 * The action table is the point: with utility selection and implicit tag
 * gating, nothing else explains a species that quietly stopped reproducing.
 */
export function inspectCreature(world: World, creature: Entity): CreatureInfo | null {
  const state = creature.get(Creature);
  const speciesEntity = creature.targetFor(OfSpecies);
  if (!state || !speciesEntity) return null;

  const species = speciesEntity.get(Species);
  const life = speciesEntity.get(Life);
  const tags = speciesEntity.get(SpeciesTags);
  if (!species || !life || !tags) return null;

  const explanation = explainCreature(world, creature);

  return {
    id: creature.id(),
    speciesId: species.id,
    speciesName: species.name,
    colorHex: species.colorHex,
    tags: Tags.toNames(tags.mask),
    age: state.age,
    maxAge: life.maxAge,
    energy: state.energy,
    maxEnergy: life.maxEnergy,
    actions: explanation?.candidates ?? [],
    chosen: explanation?.chosen ?? null,
  };
}

/**
 * Every species in the run, living or extinct, ordered as a depth-first walk of
 * the evolutionary tree so the UI can render it by indenting on `depth`.
 *
 * Watching the tree branch is a large part of what a run *is*; a flat list of
 * species names loses the thing the player was actually building.
 */
export function inspectSpecies(world: World): SpeciesInfo[] {
  const entities = [...world.query(Species)];

  const parentOf = new Map<string, string | null>();
  const byId = new Map<string, (typeof entities)[number]>();
  for (const entity of entities) {
    const id = entity.get(Species)!.id;
    byId.set(id, entity);
    const parent = entity.targetFor(DescendedFrom);
    parentOf.set(id, parent?.get(Species)?.id ?? null);
  }

  const childrenOf = new Map<string | null, string[]>();
  for (const [id, parentId] of parentOf) {
    const siblings = childrenOf.get(parentId) ?? [];
    siblings.push(id);
    childrenOf.set(parentId, siblings);
  }

  const out: SpeciesInfo[] = [];
  const visit = (id: string, depth: number): void => {
    const entity = byId.get(id)!;
    const species = entity.get(Species)!;

    out.push({
      id,
      name: species.name,
      colorHex: species.colorHex,
      tags: Tags.toNames(entity.get(SpeciesTags)?.mask ?? 0),
      population: world.query(Creature, OfSpecies(entity)).length,
      extinctTurn: entity.has(Extinct) ? (entity.get(Extinct)?.turn ?? 0) : null,
      parentId: parentOf.get(id) ?? null,
      depth,
    });

    for (const child of childrenOf.get(id) ?? []) visit(child, depth + 1);
  };

  for (const root of childrenOf.get(null) ?? []) visit(root, 0);
  return out;
}
