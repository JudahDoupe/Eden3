import type { Rng } from "../sim/rng";
import { CARDS, cardById, type CardDefinition } from "./cards";

/**
 * Deck and hand.
 *
 * The win condition is playing every card, so cards are only ever removed from
 * circulation by being played. Cycling a stuck card puts it back on the bottom
 * rather than discarding it — you still have to find a home for it eventually.
 */

export const HAND_SIZE = 5;

export interface DeckState {
  /** Face-down, drawn from the front. */
  draw: string[];
  hand: string[];
}

export function createDeck(rng: Rng, cardIds: readonly string[] = CARDS.map((c) => c.id)): DeckState {
  const draw = rng.shuffle([...cardIds]);
  const state: DeckState = { draw, hand: [] };
  refill(state);
  return state;
}

/** Draw up to `HAND_SIZE`, or until the deck runs out. */
export function refill(state: DeckState): void {
  while (state.hand.length < HAND_SIZE && state.draw.length > 0) {
    state.hand.push(state.draw.shift()!);
  }
}

/** Remove a played card from the hand and draw a replacement. */
export function discardPlayed(state: DeckState, cardId: string): boolean {
  const index = state.hand.indexOf(cardId);
  if (index === -1) return false;
  state.hand.splice(index, 1);
  refill(state);
  return true;
}

/**
 * Send a card to the bottom of the deck and draw a replacement.
 *
 * The escape hatch from a dead hand. It costs a turn (the caller still steps
 * the simulation), so escaping is never free.
 */
export function cycle(state: DeckState, cardId: string): boolean {
  const index = state.hand.indexOf(cardId);
  if (index === -1) return false;
  state.hand.splice(index, 1);
  state.draw.push(cardId);
  refill(state);
  return true;
}

/** Every card still in play — the win condition is emptying both. */
export function remaining(state: DeckState): number {
  return state.draw.length + state.hand.length;
}

export function handCards(state: DeckState): CardDefinition[] {
  return state.hand.map(cardById);
}
