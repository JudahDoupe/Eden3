import { defineFlags } from "./bitmask";

/**
 * Species tags — the vocabulary the whole game is built on.
 *
 * Tags do three jobs at once:
 *  1. Gate which mutation cards can target a species.
 *  2. Gate which actions a species can actually perform (see `actions/ids.ts`).
 *  3. Describe prey to predators, via `Diet.preyTagMask`.
 *
 * Because of (2), removing a tag silently removes behaviour. That is the
 * intended design, and it is why `Tags.missing()` exists.
 */
export const TAG_NAMES = [
  // Where it can live.
  "AQUATIC",
  "TERRESTRIAL",
  "AERIAL",
  // How it moves, if at all.
  "MOTILE",
  "SESSILE",
  // How it gets energy.
  "PHOTOSYNTHETIC",
  "HETEROTROPH",
  "DECOMPOSER",
  // What kind of thing it is.
  "MICROBIAL",
  "VERTEBRATE",
  "PLANT",
  "FUNGUS",
] as const;

export type TagName = (typeof TAG_NAMES)[number];

export const Tags = defineFlags(TAG_NAMES);

/** Convenience alias so signatures read as intent rather than `number`. */
export type TagMask = number;
