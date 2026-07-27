import { describe, expect, it } from "vitest";
import { CARDS, cardById } from "./cards";
import { resultingTags } from "./playCard";
import { ACTION_LIST } from "../sim/actions";
import { ActionIds } from "../sim/actions/ids";
import { AMOEBA } from "../sim/starters";
import { Tags } from "../sim/tags";
import { Terrains } from "../sim/terrain";

describe("the card library", () => {
  it("has unique ids", () => {
    const ids = CARDS.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never both adds and removes the same tag", () => {
    for (const card of CARDS) {
      const overlap = (card.removesTags ?? []).filter((tag) => card.addsTags.includes(tag));
      expect(overlap, `${card.id} is contradictory`).toEqual([]);
    }
  });

  it("grants only actions the resulting species could ever use", () => {
    // A card that grants an action while withholding its tags would create a
    // species permanently unable to use what the card advertised.
    for (const card of CARDS) {
      const reachableTags = Tags.maskOf([...AMOEBA.tags, ...card.addsTags]);
      for (const actionName of card.grantsActions) {
        const action = ACTION_LIST.find((candidate) => candidate.id === actionName)!;
        const withoutRemoved = reachableTags & ~Tags.maskOf(card.removesTags ?? []);
        // Either the card supplies the tags itself, or a parent plausibly can.
        const suppliedByCard = Tags.has(withoutRemoved, action.requiresTags);
        const removedByCard = Tags.missing(withoutRemoved, action.requiresTags).some((tag) =>
          (card.removesTags ?? []).includes(tag),
        );
        expect(
          !removedByCard || suppliedByCard,
          `${card.id} grants ${actionName} but removes a tag it needs`,
        ).toBe(true);
      }
    }
  });
});

/**
 * Static reachability over the whole tech tree.
 *
 * This is the test that matters most in this file. An earlier card set left
 * `plant`, `mold`, `worm`, `fungus`, `flower`, `bush` and `tree` permanently
 * unplayable: they all needed a species standing on land, and nothing in the
 * deck could carry photosynthesis or decomposition out of the water. Every run
 * was unwinnable and nothing in the simulation complained — it just quietly
 * ran out of legal plays.
 *
 * The search is deliberately optimistic (it assumes any species can reach any
 * terrain in its own habitat, and ignores whether it survives there), so a
 * failure here means a card is unreachable by *construction*, not by bad luck.
 */
describe("tech tree reachability", () => {
  interface Reachable {
    tags: number;
    habitat: number;
  }

  function explore(): Set<string> {
    const start: Reachable = {
      tags: Tags.maskOf(AMOEBA.tags),
      habitat: Terrains.maskOf(AMOEBA.habitat),
    };

    const frontier: Reachable[] = [start];
    const seen = new Set<string>([`${start.tags}:${start.habitat}`]);
    const playable = new Set<string>();

    while (frontier.length > 0) {
      const species = frontier.pop()!;

      for (const card of CARDS) {
        const required = Tags.maskOf(card.requiresTags);
        const forbidden = Tags.maskOf(card.forbidsTags ?? []);
        const habitat = Terrains.maskOf(card.habitat);

        if (!Tags.has(species.tags, required)) continue;
        if (Tags.hasAny(species.tags, forbidden)) continue;
        // The target voxel must be terrain the parent occupies and the child
        // can live in — this is the constraint the broken card set violated.
        if ((habitat & species.habitat) === 0) continue;

        playable.add(card.id);

        const child: Reachable = { tags: resultingTags(species.tags, card), habitat };
        const key = `${child.tags}:${child.habitat}`;
        if (seen.has(key)) continue;
        seen.add(key);
        frontier.push(child);
      }
    }

    return playable;
  }

  it("can reach every card from the starting amoeba", () => {
    const reachable = explore();
    const unreachable = CARDS.map((card) => card.id).filter((id) => !reachable.has(id));
    expect(unreachable, "these cards can never be played in any run").toEqual([]);
  });

  it("offers at least one opening play on the lone amoeba", () => {
    const amoebaTags = Tags.maskOf(AMOEBA.tags);
    const amoebaHabitat = Terrains.maskOf(AMOEBA.habitat);

    const openers = CARDS.filter(
      (card) =>
        Tags.has(amoebaTags, Tags.maskOf(card.requiresTags)) &&
        !Tags.hasAny(amoebaTags, Tags.maskOf(card.forbidsTags ?? [])) &&
        (Terrains.maskOf(card.habitat) & amoebaHabitat) !== 0,
    );

    // Fewer than this and the opening mulligan has too little to work with.
    expect(openers.length).toBeGreaterThanOrEqual(3);
  });

  it("provides a route out of the water", () => {
    // Something must be playable on an aquatic species yet able to live in
    // soil, or the entire terrestrial half of the tree is stranded.
    const amphibious = CARDS.filter(
      (card) =>
        (Terrains.maskOf(card.habitat) & Terrains.bit.WATER) !== 0 &&
        (Terrains.maskOf(card.habitat) & Terrains.bit.SOIL) !== 0,
    );
    expect(amphibious.length).toBeGreaterThan(0);
  });
});

describe("cardById", () => {
  it("resolves a known id and rejects an unknown one", () => {
    expect(cardById("algae").name).toBe("Algae");
    expect(() => cardById("dragon")).toThrow(/unknown card/);
  });
});

describe("action ids", () => {
  it("only names actions that exist in the registry", () => {
    const known = new Set(ActionIds.names);
    for (const card of CARDS) {
      for (const action of card.grantsActions) {
        expect(known.has(action), `${card.id} grants unknown action ${action}`).toBe(true);
      }
    }
  });
});
