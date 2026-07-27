import type { World } from "koota";
import { Creature, type Phase } from "../sim/traits";
import { cardById } from "./cards";
import { remaining, type DeckState } from "./deck";
import { cardPlayability } from "./legality";

/**
 * Win and loss.
 *
 * Win: every card played.
 * Lose: total extinction, or deadlock — too many consecutive turns in which no
 * card in hand can be played anywhere.
 *
 * Deadlock is a *streak*, not a single turn. The world changes every step, so a
 * momentarily unplayable hand is normal and often resolves itself; only a hand
 * the ecosystem has stopped being able to accommodate should end a run.
 */
export const DEADLOCK_LIMIT = 10;

export interface RunOutcome {
  phase: Phase;
  /** Why the run ended, for the end screen. Null while it continues. */
  reason: string | null;
}

export function evaluateRun(
  world: World,
  deck: DeckState,
  deadlockTurns: number,
): RunOutcome {
  if (remaining(deck) === 0) {
    return { phase: "won", reason: "Every mutation found a home. The ecosystem holds." };
  }

  if (world.query(Creature).length === 0) {
    return { phase: "lost", reason: "Everything died. There is nothing left to mutate." };
  }

  if (deadlockTurns >= DEADLOCK_LIMIT) {
    return {
      phase: "lost",
      reason: `No card has been playable for ${DEADLOCK_LIMIT} turns. The ecosystem cannot support what is left in your deck.`,
    };
  }

  return { phase: "player", reason: null };
}

/** Whether any card in hand has at least one legal target right now. */
export function hasLegalPlay(world: World, deck: DeckState): boolean {
  return deck.hand.some((id) => cardPlayability(world, cardById(id)).playable);
}
