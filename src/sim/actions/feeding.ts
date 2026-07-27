import type { Entity } from "koota";
import { Tags } from "../tags";
import { Creature, Species, SpeciesTags } from "../traits";
import {
  addDelta,
  coverage,
  depositDetritus,
  energyOf,
  gainEnergy,
  hunger,
  matchesDiet,
  speciesEntityOf,
} from "./helpers";
import type { ActionContext, ActionDef } from "./types";

/** Energy a full-strength action yields before coverage is applied. */
const PHOTOSYNTHESIS_RATE = 0.35;
const DECOMPOSE_RATE = 0.3;
const EAT_RATE = 0.45;

/** Fraction of a meal's energy that fails to transfer and returns to the voxel. */
const TROPHIC_LOSS = 0.35;

export const Photosynthesize: ActionDef = {
  id: "PHOTOSYNTHESIZE",
  requiresTags: Tags.mask("PHOTOSYNTHETIC"),

  score(ctx) {
    return coverage(ctx, "light") * hunger(ctx);
  },

  perform(ctx) {
    const gained = gainEnergy(ctx, PHOTOSYNTHESIS_RATE * coverage(ctx, "light"));
    // Growing costs the soil/water something and returns oxygen to it.
    addDelta(ctx.voxel, "nutrients", -gained * 0.3);
    addDelta(ctx.voxel, "oxygen", gained * 0.5);
  },
};

export const Decompose: ActionDef = {
  id: "DECOMPOSE",
  requiresTags: Tags.mask("DECOMPOSER"),

  score(ctx) {
    return coverage(ctx, "nutrients") * hunger(ctx);
  },

  perform(ctx) {
    const gained = gainEnergy(ctx, DECOMPOSE_RATE * coverage(ctx, "nutrients"));
    // Breaking matter down consumes the matter and the oxygen to do it.
    addDelta(ctx.voxel, "nutrients", -gained * 0.8);
    addDelta(ctx.voxel, "oxygen", -gained * 0.2);
  },
};

export const Eat: ActionDef = {
  id: "EAT",
  requiresTags: Tags.mask("HETEROTROPH"),

  score(ctx) {
    return findPrey(ctx) ? hunger(ctx) : 0;
  },

  perform(ctx) {
    const prey = findPrey(ctx);
    if (!prey) return;

    const preyName = nameOf(prey) ?? "prey";
    const taken = Math.min(EAT_RATE, energyOf(prey));
    gainEnergy(ctx, taken * (1 - TROPHIC_LOSS));

    const remaining = energyOf(prey) - taken;
    if (remaining > 0) {
      prey.set(Creature, { energy: remaining });
      ctx.log.push({
        turn: ctx.turn,
        kind: "ate",
        message: `${ctx.species.name} fed on ${preyName}`,
        speciesId: ctx.species.id,
        voxelIndex: ctx.voxelIndex,
      });
      return;
    }

    // The prey is finished; what the predator could not use returns to the voxel.
    depositDetritus(ctx.voxel, taken * TROPHIC_LOSS);
    prey.destroy();
    ctx.log.push({
      turn: ctx.turn,
      kind: "ate",
      message: `${ctx.species.name} ate the last ${preyName} here`,
      speciesId: ctx.species.id,
      voxelIndex: ctx.voxelIndex,
    });
  },
};

/**
 * The weakest edible creature sharing this voxel, so predation thins the
 * struggling first. Deterministic: `coLocated` returns a stable order and ties
 * keep the earlier candidate.
 */
function findPrey(ctx: ActionContext): Entity | null {
  let prey: Entity | null = null;
  let weakest = Infinity;

  for (const other of ctx.coLocated()) {
    const otherSpecies = speciesEntityOf(other);
    if (!otherSpecies || otherSpecies === ctx.species.entity) continue;

    const tags = otherSpecies.get(SpeciesTags);
    if (!tags || !matchesDiet(tags.mask, ctx.species.diet)) continue;

    const energy = energyOf(other);
    if (energy <= 0 || energy >= weakest) continue;
    prey = other;
    weakest = energy;
  }

  return prey;
}

function nameOf(creature: Entity): string | undefined {
  return speciesEntityOf(creature)?.get(Species)?.name;
}
