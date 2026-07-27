import { describe, expect, it } from "vitest";
import { CARDS } from "./cards";
import { createGameStore, type GameStore } from "./store";
import { createTestStore } from "../testing/world";

/**
 * End-to-end runs through the store, the surface the UI actually drives.
 *
 * The important question a prototype has to answer is whether a run can be
 * completed at all, so the headline test plays whole games rather than
 * asserting on individual rules.
 */

/** A greedy player: play any legal card, otherwise alternate cycling and passing. */
function autoplay(store: GameStore, maxTurns = 600) {
  const played: string[] = [];

  for (let step = 0; step < maxTurns; step++) {
    const snapshot = store.getSnapshot();
    if (snapshot.phase === "won" || snapshot.phase === "lost") break;

    const playable = snapshot.hand.find((cardId) => store.playability(cardId).playable);
    if (playable) {
      const [target] = store.playability(playable).targets;
      store.play(playable, target!.voxelIndex);
      played.push(playable);
      continue;
    }

    // Stuck: cycling is the escape hatch, passing lets the world change.
    if (step % 2 === 0 && snapshot.hand.length > 0) store.cycleCard(snapshot.hand[0]!);
    else store.pass();
  }

  return { played, snapshot: store.getSnapshot() };
}

describe("a complete run", () => {
  it("is winnable, and winning means every card was played", () => {
    // Not every seed is winnable by a player with no strategy — that is the
    // point of the game — but the deck must not be impossible.
    const wins = [];
    for (const seed of [4, 5, 6, 7]) {
      const store = createTestStore({ seed });
      const { played, snapshot } = autoplay(store);
      if (snapshot.phase === "won") wins.push({ seed, played, snapshot });
    }

    expect(wins.length, "no seed was winnable by a greedy player").toBeGreaterThan(0);
    for (const win of wins) {
      expect(win.snapshot.deckRemaining).toBe(0);
      expect(win.snapshot.cardsPlayed).toBe(CARDS.length);
      expect(win.played).toHaveLength(CARDS.length);
    }
  });

  it("is losable, so the ecosystem can actually be destroyed", () => {
    const losses = [];
    for (const seed of [1, 2, 3, 8]) {
      const store = createTestStore({ seed });
      const { snapshot } = autoplay(store);
      if (snapshot.phase === "lost") losses.push(snapshot);
    }

    expect(losses.length, "no seed was losable").toBeGreaterThan(0);
    for (const loss of losses) {
      expect(loss.outcome).toBeTruthy();
      expect(loss.deckRemaining).toBeGreaterThan(0);
    }
  });

  it("always terminates rather than running forever", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const store = createTestStore({ seed });
      const { snapshot } = autoplay(store);
      expect(["won", "lost"], `seed ${seed} never resolved`).toContain(snapshot.phase);
    }
  });

  it("opens with a hand the player can actually act on", () => {
    // The mulligan guarantee. Without it roughly a fifth of runs start dead.
    // Stores are released as we go: koota allows only 16 live worlds, and the
    // pooled teardown does not run until the test ends.
    for (let seed = 1; seed <= 20; seed++) {
      const store = createGameStore({ seed });
      const { hand } = store.getSnapshot();
      const anyPlayable = hand.some((cardId) => store.playability(cardId).playable);
      store.dispose();
      expect(anyPlayable, `seed ${seed} opened with a dead hand`).toBe(true);
    }
  });
});

describe("the player turn", () => {
  it("advances the simulation when a card is played", () => {
    const store = createTestStore({ seed: 4 });
    const before = store.getSnapshot();
    const cardId = before.hand.find((id) => store.playability(id).playable)!;

    store.play(cardId, store.playability(cardId).targets[0]!.voxelIndex);

    expect(store.getSnapshot().turn).toBe(before.turn + 1);
    expect(store.getSnapshot().livingSpecies).toBeGreaterThan(before.livingSpecies);
  });

  it("refuses a card that is not in hand", () => {
    const store = createTestStore({ seed: 4 });
    const absent = CARDS.map((card) => card.id).find(
      (id) => !store.getSnapshot().hand.includes(id),
    )!;
    expect(store.play(absent, 0)).toBe(false);
    expect(store.getSnapshot().turn).toBe(0);
  });

  it("refuses an illegal target", () => {
    const store = createTestStore({ seed: 4 });
    const cardId = store.getSnapshot().hand.find((id) => store.playability(id).playable)!;
    // 99_999 is outside the world entirely.
    expect(store.play(cardId, 99_999)).toBe(false);
    expect(store.getSnapshot().turn).toBe(0);
  });

  it("costs a turn to cycle, so escaping a dead hand is never free", () => {
    const store = createTestStore({ seed: 4 });
    const before = store.getSnapshot();

    expect(store.cycleCard(before.hand[0]!)).toBe(true);
    expect(store.getSnapshot().turn).toBe(before.turn + 1);
    expect(store.getSnapshot().deckRemaining).toBe(before.deckRemaining);
  });

  it("highlights exactly the legal targets of the aimed card", () => {
    const store = createTestStore({ seed: 4 });
    expect(store.highlightedVoxels()).toEqual([]);

    const cardId = store.getSnapshot().hand.find((id) => store.playability(id).playable)!;
    store.selectCard(cardId);

    expect(store.highlightedVoxels()).toEqual(
      store.playability(cardId).targets.map((target) => target.voxelIndex),
    );
  });

  it("ignores input once the run has ended", () => {
    const store = createTestStore({ seed: 4 });
    autoplay(store);
    const ended = store.getSnapshot();

    store.pass();
    expect(store.getSnapshot().turn).toBe(ended.turn);
  });
});

describe("restarting", () => {
  it("returns to turn zero with a full deck", () => {
    const store = createTestStore({ seed: 4 });
    autoplay(store, 20);

    store.reset();
    const fresh = store.getSnapshot();

    expect(fresh.turn).toBe(0);
    expect(fresh.deckRemaining).toBe(CARDS.length);
    expect(fresh.cardsPlayed).toBe(0);
    expect(fresh.livingSpecies).toBe(1);
    expect(fresh.phase).toBe("player");
  });

  it("survives more restarts than koota allows live worlds", () => {
    // koota caps live worlds at 16; a leaked world per restart would throw here.
    const store = createTestStore({ seed: 4 });
    for (let i = 0; i < 25; i++) store.reset();
    expect(store.getSnapshot().turn).toBe(0);
  });
});
