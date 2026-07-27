import { describe, expect, it } from "vitest";
import { createDeck, cycle, discardPlayed, HAND_SIZE, remaining } from "./deck";
import { CARDS } from "./cards";
import { Rng } from "../sim/rng";

const ALL = CARDS.map((card) => card.id);

describe("createDeck", () => {
  it("deals a full hand and keeps the rest face down", () => {
    const deck = createDeck(new Rng(1));
    expect(deck.hand).toHaveLength(HAND_SIZE);
    expect(remaining(deck)).toBe(ALL.length);
  });

  it("shuffles deterministically for a seed", () => {
    expect(createDeck(new Rng(4)).hand).toEqual(createDeck(new Rng(4)).hand);
    expect(createDeck(new Rng(4)).hand).not.toEqual(createDeck(new Rng(99)).hand);
  });

  it("loses no cards in the shuffle", () => {
    const deck = createDeck(new Rng(2));
    expect([...deck.hand, ...deck.draw].sort()).toEqual([...ALL].sort());
  });

  it("copes with a deck smaller than a hand", () => {
    const deck = createDeck(new Rng(1), ["algae", "worm"]);
    expect(deck.hand).toHaveLength(2);
    expect(deck.draw).toHaveLength(0);
  });
});

describe("discardPlayed", () => {
  it("removes the card and draws a replacement", () => {
    const deck = createDeck(new Rng(3));
    const played = deck.hand[0]!;

    expect(discardPlayed(deck, played)).toBe(true);
    expect(deck.hand).toHaveLength(HAND_SIZE);
    expect(deck.hand).not.toContain(played);
    // A played card is gone for good — that is what winning means.
    expect(deck.draw).not.toContain(played);
    expect(remaining(deck)).toBe(ALL.length - 1);
  });

  it("shrinks the hand once the deck is exhausted", () => {
    const deck = createDeck(new Rng(1), ["algae", "worm"]);
    discardPlayed(deck, "algae");
    expect(deck.hand).toEqual(["worm"]);
  });

  it("ignores a card that is not in hand", () => {
    const deck = createDeck(new Rng(3));
    const absent = ALL.find((id) => !deck.hand.includes(id))!;
    expect(discardPlayed(deck, absent)).toBe(false);
  });

  it("empties completely when every card is played", () => {
    const deck = createDeck(new Rng(5));
    while (remaining(deck) > 0) discardPlayed(deck, deck.hand[0]!);
    expect(remaining(deck)).toBe(0);
    expect(deck.hand).toEqual([]);
  });
});

describe("cycle", () => {
  it("bottom-decks the card rather than discarding it", () => {
    // The win condition is playing every card, so cycling must not destroy one.
    const deck = createDeck(new Rng(6));
    const stuck = deck.hand[0]!;
    const before = remaining(deck);

    expect(cycle(deck, stuck)).toBe(true);
    expect(deck.hand).not.toContain(stuck);
    expect(deck.draw).toContain(stuck);
    expect(deck.draw[deck.draw.length - 1]).toBe(stuck);
    expect(remaining(deck)).toBe(before);
  });

  it("draws a replacement, keeping the hand full", () => {
    const deck = createDeck(new Rng(6));
    cycle(deck, deck.hand[0]!);
    expect(deck.hand).toHaveLength(HAND_SIZE);
  });

  it("comes back around after enough cycles", () => {
    const deck = createDeck(new Rng(7));
    const stuck = deck.hand[0]!;
    cycle(deck, stuck);

    let seen = false;
    for (let i = 0; i < ALL.length * 2 && !seen; i++) {
      if (deck.hand.includes(stuck)) seen = true;
      else cycle(deck, deck.hand[0]!);
    }
    expect(seen).toBe(true);
  });

  it("ignores a card that is not in hand", () => {
    const deck = createDeck(new Rng(6));
    const absent = ALL.find((id) => !deck.hand.includes(id))!;
    expect(cycle(deck, absent)).toBe(false);
  });
});
