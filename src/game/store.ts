import type { World } from "koota";
import { createEventLog, type EventLog, type SimEvent } from "../sim/events";
import { seedStartingLife } from "../sim/starters";
import { runSimulationPhase } from "../sim/step";
import { Creature, Extinct, RunState, Species, type Phase } from "../sim/traits";
import { createSimWorld, getRng, getTurn, type SimConfig } from "../sim/world";
import { cardById, type CardDefinition } from "./cards";
import { createDeck, cycle, discardPlayed, remaining, type DeckState } from "./deck";
import { cardPlayability, type CardTarget } from "./legality";
import { playCard } from "./playCard";
import { evaluateRun, hasLegalPlay } from "./runState";

/**
 * The single bridge between the simulation and everything that watches it.
 *
 * React subscribes here via `useSyncExternalStore` rather than to individual
 * koota traits. The simulation only mutates during a discrete phase step, so
 * one coarse notification per turn is both sufficient and far cheaper than
 * fine-grained reactivity across thousands of creatures.
 */
export interface GameSnapshot {
  turn: number;
  phase: Phase;
  version: number;
  /** Voxel the player is inspecting, or null. */
  selectedVoxel: number | null;
  /** Card the player is aiming, or null. Its legal targets are highlighted. */
  selectedCard: string | null;
  hand: string[];
  deckRemaining: number;
  cardsPlayed: number;
  population: number;
  livingSpecies: number;
  extinctSpecies: number;
  deadlockTurns: number;
  /** Set once the run ends. */
  outcome: string | null;
}

export interface GameStore {
  /** The live simulation world. Read freely; mutate only through this store. */
  readonly world: World;
  subscribe(listener: () => void): () => void;
  /** Referentially stable while nothing has changed, as `useSyncExternalStore` requires. */
  getSnapshot(): GameSnapshot;
  events(limit?: number): readonly SimEvent[];

  /** Legal targets for a card, plus the reason when there are none. */
  playability(cardId: string): ReturnType<typeof cardPlayability>;
  /** Voxel indices the currently aimed card could be played on. */
  highlightedVoxels(): number[];

  selectCard(cardId: string | null): void;
  selectVoxel(index: number | null): void;

  /** Play the aimed card at a voxel, then run a simulation phase. */
  play(cardId: string, voxelIndex: number): boolean;
  /** Skip the player turn and run a simulation phase. */
  pass(): void;
  /** Bottom-deck a stuck card and run a simulation phase. */
  cycleCard(cardId: string): boolean;

  reset(config?: Partial<SimConfig>): void;
  /** Release the underlying world. Koota allows only 16 live at once. */
  dispose(): void;
}

export function createGameStore(config: Partial<SimConfig> = {}): GameStore {
  let world = createSimWorld(config);
  let log: EventLog = createEventLog();
  let deck: DeckState = createDeck(getRng(world));
  let deadlockTurns = 0;
  let outcome: { phase: Phase; reason: string | null } = { phase: "player", reason: null };
  let selectedVoxel: number | null = null;
  let selectedCard: string | null = null;
  let totalCards = remaining(deck);

  seedStartingLife(world);
  mulligan();

  const listeners = new Set<() => void>();
  let snapshot: GameSnapshot = read();

  /**
   * Guarantee the opening hand contains at least one playable card.
   *
   * Only three cards can be played on a lone amoeba, so a random five-card hand
   * is dead on arrival about a fifth of the time. Cycling out of that is
   * possible but costs turns the player did nothing to deserve — an opening
   * they cannot act on is a wasted run, not a challenge.
   */
  function mulligan(): void {
    for (let attempt = 0; attempt < totalCards; attempt++) {
      if (hasLegalPlay(world, deck)) return;
      cycle(deck, deck.hand[0]!);
    }
  }

  function read(): GameSnapshot {
    let living = 0;
    let extinct = 0;
    for (const species of world.query(Species)) {
      if (species.has(Extinct)) extinct++;
      else living++;
    }

    return {
      turn: getTurn(world),
      phase: outcome.phase,
      version: world.get(RunState)?.version ?? 0,
      selectedVoxel,
      selectedCard,
      hand: [...deck.hand],
      deckRemaining: remaining(deck),
      cardsPlayed: totalCards - remaining(deck),
      population: world.query(Creature).length,
      livingSpecies: living,
      extinctSpecies: extinct,
      deadlockTurns,
      outcome: outcome.reason,
    };
  }

  function same(a: GameSnapshot, b: GameSnapshot): boolean {
    return (
      a.turn === b.turn &&
      a.phase === b.phase &&
      a.version === b.version &&
      a.selectedVoxel === b.selectedVoxel &&
      a.selectedCard === b.selectedCard &&
      a.deckRemaining === b.deckRemaining &&
      a.population === b.population &&
      a.livingSpecies === b.livingSpecies &&
      a.extinctSpecies === b.extinctSpecies &&
      a.deadlockTurns === b.deadlockTurns &&
      a.outcome === b.outcome &&
      a.hand.join() === b.hand.join()
    );
  }

  /**
   * Swap in a new snapshot only when something actually changed. Returning a
   * fresh object on every call would make `useSyncExternalStore` re-render
   * forever, and pointer movement calls `selectVoxel` constantly.
   */
  function publish(): void {
    const next = read();
    if (same(next, snapshot)) return;
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function ended(): boolean {
    return outcome.phase === "won" || outcome.phase === "lost";
  }

  /**
   * Advance the world, then re-evaluate the run.
   *
   * The deadlock streak is counted *after* the step, against the world the
   * player will actually face on their next turn.
   */
  function advance(): void {
    runSimulationPhase(world, log);
    deadlockTurns = hasLegalPlay(world, deck) ? 0 : deadlockTurns + 1;
    outcome = evaluateRun(world, deck, deadlockTurns);
    publish();
  }

  function card(cardId: string): CardDefinition {
    return cardById(cardId);
  }

  return {
    get world() {
      return world;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    events(limit) {
      return log.recent(limit);
    },

    playability(cardId) {
      return cardPlayability(world, card(cardId));
    },

    highlightedVoxels() {
      if (!selectedCard) return [];
      return cardPlayability(world, card(selectedCard)).targets.map((t) => t.voxelIndex);
    },

    selectCard(cardId) {
      selectedCard = cardId;
      publish();
    },

    selectVoxel(index) {
      selectedVoxel = index;
      publish();
    },

    play(cardId, voxelIndex) {
      if (ended()) return false;

      const definition = card(cardId);
      if (!deck.hand.includes(cardId)) return false;

      const target: CardTarget | undefined = cardPlayability(world, definition).targets.find(
        (candidate) => candidate.voxelIndex === voxelIndex,
      );
      if (!target) return false;

      playCard(world, definition, target, log);
      discardPlayed(deck, cardId);
      selectedCard = null;

      // Winning is checked before stepping: emptying the deck ends the run, and
      // a final simulation phase could kill the species you just created.
      if (remaining(deck) === 0) {
        outcome = evaluateRun(world, deck, deadlockTurns);
        publish();
        return true;
      }

      advance();
      return true;
    },

    pass() {
      if (ended()) return;
      advance();
    },

    cycleCard(cardId) {
      if (ended()) return false;
      if (!cycle(deck, cardId)) return false;
      selectedCard = null;
      advance();
      return true;
    },

    reset(next = config) {
      // Koota caps live worlds at 16, so the old one must go or the 17th
      // restart of a session throws.
      world.destroy();
      world = createSimWorld(next);
      log = createEventLog();
      deck = createDeck(getRng(world));
      totalCards = remaining(deck);
      seedStartingLife(world);
      mulligan();
      deadlockTurns = 0;
      outcome = { phase: "player", reason: null };
      selectedVoxel = null;
      selectedCard = null;
      snapshot = read();
      for (const listener of listeners) listener();
    },

    dispose() {
      listeners.clear();
      world.destroy();
    },
  };
}
