import { Terrains } from "../terrain";
import { Tags } from "../tags";
import { spawnCreature } from "../species";
import { Creature, Voxel } from "../traits";
import { bestTarget } from "./helpers";
import type { ActionContext, ActionDef } from "./types";

/**
 * Reproduction is colonisation: a creature entity represents the whole local
 * population of its species, so "having offspring" means establishing that
 * species in a voxel where it is not yet present. Growth inside a voxel is
 * energy accumulation instead.
 */

/** Seeds scatter further than a parent could carry them. */
const DISPERSAL_BONUS = 1;

const ALL_TERRAIN = Terrains.mask("AIR", "SOIL", "WATER", "ROCK");

function createSpawnAction(
  id: "REPRODUCE" | "SEED",
  requiresTags: number,
  rangeBonus: number,
): ActionDef {
  const targetFor = (ctx: ActionContext) =>
    bestTarget(ctx, ALL_TERRAIN, Math.max(1, ctx.species.locomotion + rangeBonus), {
      mustBeVacant: true,
    });

  return {
    id,
    requiresTags,

    score(ctx) {
      const { reproduceThreshold, maxEnergy } = ctx.species.life;
      if (ctx.energy < reproduceThreshold) return 0;
      if (!targetFor(ctx)) return 0;
      // Scales with surplus above the threshold, so the well-fed spread fastest.
      const surplus = (ctx.energy - reproduceThreshold) / Math.max(maxEnergy - reproduceThreshold, 1e-6);
      return Math.min(1, 0.5 + 0.5 * surplus);
    },

    perform(ctx) {
      const target = targetFor(ctx);
      if (!target) return;

      const { reproduceCost, startingEnergy } = ctx.species.life;
      const invested = Math.min(reproduceCost, ctx.energy);
      ctx.energy -= invested;
      ctx.creature.set(Creature, { energy: ctx.energy });

      // The offspring is founded on what the parent actually spent.
      spawnCreature(ctx.world, ctx.species.entity, target.voxel, Math.min(startingEnergy, invested));

      const to = target.voxel.get(Voxel);
      ctx.log.push({
        turn: ctx.turn,
        kind: "born",
        message: `${ctx.species.name} spread to (${to?.x}, ${to?.y}, ${to?.z})`,
        speciesId: ctx.species.id,
        voxelIndex: to?.index,
      });
    },
  };
}

export const Reproduce = createSpawnAction("REPRODUCE", Tags.mask("MOTILE"), 0);

export const Seed = createSpawnAction("SEED", Tags.mask("SESSILE"), DISPERSAL_BONUS);
