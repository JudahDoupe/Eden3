import type { ActionDef } from "./types";

/**
 * The floor of the utility ladder.
 *
 * Every species owns it and nothing gates it, so there is always exactly one
 * candidate available and selection never has to handle an empty set. A
 * creature choosing Idle is meaningful information, not a failure: it means
 * nothing it can do was worth more than doing nothing.
 */
export const IDLE_SCORE = 0.05;

export const Idle: ActionDef = {
  id: "IDLE",
  requiresTags: 0,
  score: () => IDLE_SCORE,
  perform: () => {},
};
