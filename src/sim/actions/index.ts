import { Tags, type TagName } from "../tags";
import { Decompose, Eat, Photosynthesize } from "./feeding";
import { ACTION_NAMES, ActionIds, type ActionName } from "./ids";
import { Idle } from "./idle";
import { Fly, Swim, Walk } from "./movement";
import { Reproduce, Seed } from "./reproduction";
import type { ActionContext, ActionDef } from "./types";

export type { ActionContext, ActionDef } from "./types";
export { ACTION_NAMES, ActionIds, type ActionName } from "./ids";

/**
 * The action registry.
 *
 * Keyed by name and ordered by `ACTION_NAMES`, whose declaration order is also
 * the deterministic tie-break order — so a new action must be appended, never
 * inserted, or existing runs change behaviour.
 */
export const ACTIONS: Record<ActionName, ActionDef> = {
  PHOTOSYNTHESIZE: Photosynthesize,
  DECOMPOSE: Decompose,
  EAT: Eat,
  SWIM: Swim,
  WALK: Walk,
  FLY: Fly,
  REPRODUCE: Reproduce,
  SEED: Seed,
  IDLE: Idle,
};

export const ACTION_LIST: readonly ActionDef[] = ACTION_NAMES.map((name) => ACTIONS[name]);

/**
 * Spread of the deterministic jitter added to each score.
 *
 * Small enough never to overturn a real preference, large enough to break ties
 * without a fixed winner. Derived from creature, turn and action rather than
 * drawn from the RNG stream, so `explainActions` can reproduce the exact
 * numbers without consuming randomness or perturbing the run.
 */
export const JITTER = 0.01;

export interface ActionCandidate {
  id: ActionName;
  /** The species has this action, whether or not it can currently use it. */
  owned: boolean;
  /**
   * Owned, but blocked by tags — the interesting case, and the one a mutation
   * can cause without mentioning it. Always false when unowned: gating an
   * action the species never had is not information.
   */
  gated: boolean;
  missingTags: TagName[];
  /** Raw desirability from the action itself, before weighting. */
  rawScore: number;
  weight: number;
  /** What selection actually compares. */
  weightedScore: number;
  /** Excluded because it is unowned, gated, or scored zero. */
  eligible: boolean;
}

export interface ActionExplanation {
  candidates: ActionCandidate[];
  chosen: ActionName | null;
}

/**
 * Score every action without performing any of them.
 *
 * This is the debugging surface for the entire simulation. Utility selection
 * plus implicit tag gating makes behaviour impossible to predict by reading the
 * species definition, so being able to ask a creature why it did what it did is
 * a requirement, not a convenience.
 *
 * Must stay free of side effects: it neither mutates the world nor advances the
 * RNG, so the UI can call it any number of times between turns.
 */
export function explainActions(ctx: ActionContext): ActionExplanation {
  const candidates: ActionCandidate[] = ACTION_LIST.map((action) => {
    const owned = (ctx.species.actions & ActionIds.bit[action.id]) !== 0;
    const missingTags = owned ? Tags.missing(ctx.species.tags, action.requiresTags) : [];
    const gated = owned && missingTags.length > 0;

    if (!owned || gated) {
      return {
        id: action.id,
        owned,
        gated,
        missingTags,
        rawScore: 0,
        weight: ctx.species.weights[action.id] ?? 1,
        weightedScore: 0,
        eligible: false,
      };
    }

    const rawScore = action.score(ctx);
    const weight = ctx.species.weights[action.id] ?? 1;
    const weightedScore = rawScore <= 0 ? 0 : rawScore * weight + jitterFor(ctx, action.id);

    return {
      id: action.id,
      owned,
      gated: false,
      missingTags,
      rawScore,
      weight,
      weightedScore,
      eligible: rawScore > 0,
    };
  });

  return { candidates, chosen: pick(candidates) };
}

/** Choose one action by utility and perform it. Returns what it chose. */
export function chooseAndPerformAction(ctx: ActionContext): ActionName | null {
  const { chosen } = explainActions(ctx);
  if (!chosen) return null;
  ACTIONS[chosen].perform(ctx);
  return chosen;
}

/**
 * Highest weighted score wins; ties fall to the earlier `ACTION_NAMES` entry so
 * the outcome never depends on object key order.
 */
function pick(candidates: readonly ActionCandidate[]): ActionName | null {
  let best: ActionCandidate | null = null;
  for (const candidate of candidates) {
    if (!candidate.eligible) continue;
    if (!best || candidate.weightedScore > best.weightedScore) best = candidate;
  }
  return best?.id ?? null;
}

/**
 * Deterministic per-(creature, turn, action) jitter in [0, JITTER).
 *
 * A hash rather than an RNG draw: `explainActions` must be callable from the UI
 * without shifting the random stream and changing the run.
 */
function jitterFor(ctx: ActionContext, id: ActionName): number {
  // `entity.id()` and not the raw entity value: the latter packs in generation
  // and world id, so two identical runs in different worlds would jitter
  // differently and diverge.
  let hash = ctx.creature.id() | 0;
  hash = Math.imul(hash ^ ctx.turn, 0x27d4eb2d);
  hash = Math.imul(hash ^ ActionIds.bit[id], 0x165667b1);
  hash ^= hash >>> 15;
  return ((hash >>> 0) / 4294967296) * JITTER;
}
