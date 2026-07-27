import { defineFlags } from "../bitmask";

/**
 * The action vocabulary.
 *
 * A species owns a *set* of these (inherited from its parent species, plus
 * whatever its mutation card granted), stored as a mask. Ownership alone is not
 * enough to perform one — see `requiresTags` on each `ActionDef`.
 *
 * Declaration order is stable and doubles as the deterministic tie-break order
 * during utility selection, so new actions get appended, never inserted.
 */
export const ACTION_NAMES = [
  "PHOTOSYNTHESIZE",
  "DECOMPOSE",
  "EAT",
  "SWIM",
  "WALK",
  "FLY",
  "REPRODUCE",
  "SEED",
  "IDLE",
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];

export const ActionIds = defineFlags(ACTION_NAMES);

/** Convenience alias so signatures read as intent rather than `number`. */
export type ActionMask = number;
