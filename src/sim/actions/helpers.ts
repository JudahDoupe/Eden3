import type { Entity, World } from "koota";
import { clampResource, type ResourceKey } from "../resources";
import type { SpeciesView } from "../species";
import { suitabilityOf } from "../suitability";
import { Creature, InVoxel, OfSpecies, ResourceDelta, Resources, Terrain } from "../traits";
import type { ActionContext } from "./types";

/** How far below full a creature's energy is, in [0, 1]. Drives every feeding score. */
export function hunger(ctx: ActionContext): number {
  const max = ctx.species.life.maxEnergy;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, 1 - ctx.energy / max));
}

/**
 * How well the voxel covers a species' need for one resource, in [0, 1].
 * A species with no stated need is unconstrained, hence 1.
 */
export function coverage(ctx: ActionContext, key: ResourceKey): number {
  const levels = ctx.voxel.get(Resources);
  if (!levels) return 0;
  const need = ctx.species.needs[key];
  if (need <= 0) return levels[key];
  return Math.min(1, levels[key] / need);
}

/** Add energy, capped at the species maximum. Returns the amount actually gained. */
export function gainEnergy(ctx: ActionContext, amount: number): number {
  const max = ctx.species.life.maxEnergy;
  const next = Math.min(max, ctx.energy + amount);
  const gained = next - ctx.energy;
  ctx.energy = next;
  ctx.creature.set(Creature, { energy: next });
  return gained;
}

/**
 * Accumulate an environmental change. Creatures never write `Resources`
 * directly — batching through the delta is what keeps the environment
 * independent of the order creatures were simulated in.
 */
export function addDelta(voxel: Entity, key: ResourceKey, amount: number): void {
  const delta = voxel.get(ResourceDelta);
  if (!delta) return;
  voxel.set(ResourceDelta, { [key]: delta[key] + amount });
}

export function voxelHasSpecies(world: World, voxel: Entity, species: Entity): boolean {
  return world.query(Creature, InVoxel(voxel), OfSpecies(species)).length > 0;
}

export interface Target {
  voxel: Entity;
  score: number;
}

/**
 * The best voxel within range, restricted to terrain the action can traverse.
 *
 * Ties resolve to the first candidate, and `inRange` returns a stable order, so
 * two identical worlds always pick the same target.
 */
export function bestTarget(
  ctx: ActionContext,
  traverseMask: number,
  range: number,
  options: { mustBeVacant?: boolean } = {},
): Target | null {
  let best: Target | null = null;

  for (const voxel of ctx.inRange(range)) {
    const terrain = voxel.get(Terrain);
    if (!terrain || (traverseMask & terrain.kind) === 0) continue;
    if ((ctx.species.habitat & terrain.kind) === 0) continue;
    if (options.mustBeVacant && voxelHasSpecies(ctx.world, voxel, ctx.species.entity)) continue;

    const score = suitabilityOf(ctx.species, voxel);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { voxel, score };
  }

  return best;
}

/** Return a creature's energy, or 0 if it has died. */
export function energyOf(creature: Entity): number {
  return creature.get(Creature)?.energy ?? 0;
}

/** Deposit a dead creature's biomass into its voxel, closing the nutrient loop. */
export function depositDetritus(voxel: Entity, amount: number): void {
  addDelta(voxel, "nutrients", clampResource(amount));
}

/** Whether a species' tags mark it as edible by a given diet mask. */
export function matchesDiet(preyTags: number, dietMask: number): boolean {
  return dietMask !== 0 && (preyTags & dietMask) !== 0;
}

/** Resolve the species view of another creature, for predation checks. */
export function speciesEntityOf(creature: Entity): Entity | undefined {
  return creature.targetFor(OfSpecies);
}

export function voxelEntityOf(creature: Entity): Entity | undefined {
  return creature.targetFor(InVoxel);
}

export function speciesTagsOf(species: SpeciesView): number {
  return species.tags;
}
