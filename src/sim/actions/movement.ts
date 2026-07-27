import { Tags } from "../tags";
import { Terrains } from "../terrain";
import { suitabilityOf } from "../suitability";
import { InVoxel, Voxel } from "../traits";
import { bestTarget } from "./helpers";
import type { ActionContext, ActionDef } from "./types";

/**
 * Movement is one action per medium rather than one generic "move".
 *
 * That is what makes the tag gate do real work: a salamander that owns both
 * SWIM and WALK can leave the pond, and a fish that loses AQUATIC loses the
 * only way it had to get anywhere — without either rule being written down.
 */

/** Improvement below this is not worth a turn; prevents dithering between equals. */
const MIN_GAIN = 0.05;

function createMoveAction(
  id: "SWIM" | "WALK" | "FLY",
  requiresTags: number,
  traverseMask: number,
  rangeBonus = 0,
): ActionDef {
  // Vacancy is required, not preferred: a creature entity *is* the local
  // population of its species in a voxel, so two of the same species sharing
  // one is incoherent. Without this every creature converges on whichever
  // voxel currently scores highest.
  const targetFor = (ctx: ActionContext) =>
    bestTarget(ctx, traverseMask, Math.max(1, ctx.species.locomotion + rangeBonus), {
      mustBeVacant: true,
    });

  return {
    id,
    requiresTags,

    score(ctx) {
      if (ctx.species.locomotion <= 0) return 0;
      const target = targetFor(ctx);
      if (!target) return 0;
      const gain = target.score - suitabilityOf(ctx.species, ctx.voxel);
      return gain >= MIN_GAIN ? Math.min(1, gain) : 0;
    },

    perform(ctx) {
      const target = targetFor(ctx);
      if (!target) return;

      ctx.creature.remove(InVoxel(ctx.voxel));
      ctx.creature.add(InVoxel(target.voxel));

      const to = target.voxel.get(Voxel);
      ctx.log.push({
        turn: ctx.turn,
        kind: "moved",
        message: `${ctx.species.name} ${verb[id]} to (${to?.x}, ${to?.y}, ${to?.z})`,
        speciesId: ctx.species.id,
        voxelIndex: to?.index,
      });
    },
  };
}

const verb = { SWIM: "swam", WALK: "walked", FLY: "flew" } as const;

export const Swim = createMoveAction("SWIM", Tags.mask("AQUATIC", "MOTILE"), Terrains.bit.WATER);

export const Walk = createMoveAction("WALK", Tags.mask("TERRESTRIAL", "MOTILE"), Terrains.bit.SOIL);

/** Fliers range further and are not confined to a single medium. */
export const Fly = createMoveAction(
  "FLY",
  Tags.mask("AERIAL", "MOTILE"),
  Terrains.mask("AIR", "SOIL", "WATER"),
  1,
);
