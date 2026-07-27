import type { World } from "koota";
import { describe, expect, it } from "vitest";
import { cardById } from "./cards";
import { cardPlayability } from "./legality";
import { playCard, previewCard, resultingTags } from "./playCard";
import { ActionIds } from "../sim/actions/ids";
import { createEventLog } from "../sim/events";
import { seedStartingLife } from "../sim/starters";
import { Tags } from "../sim/tags";
import {
  Creature,
  DescendedFrom,
  OfSpecies,
  Species,
  SpeciesActions,
  SpeciesTags,
} from "../sim/traits";
import { createTestWorld } from "../testing/world";

function startedWorld(): { world: World; log: ReturnType<typeof createEventLog> } {
  const world = createTestWorld({ seed: 1 });
  seedStartingLife(world);
  return { world, log: createEventLog() };
}

function play(world: World, log: ReturnType<typeof createEventLog>, cardId: string) {
  const card = cardById(cardId);
  const [target] = cardPlayability(world, card).targets;
  if (!target) throw new Error(`${cardId} has no legal target`);
  return playCard(world, card, target, log);
}

describe("playCard", () => {
  it("leaves the parent species completely untouched", () => {
    // Branching, not transforming: this is what keeps the base of the food web
    // alive after you evolve past it.
    const { world, log } = startedWorld();
    const [amoeba] = world.query(Species);
    const tagsBefore = amoeba!.get(SpeciesTags)!.mask;
    const actionsBefore = amoeba!.get(SpeciesActions)!.mask;
    const populationBefore = world.query(Creature, OfSpecies(amoeba!)).length;

    play(world, log, "algae");

    expect(amoeba!.get(SpeciesTags)!.mask).toBe(tagsBefore);
    expect(amoeba!.get(SpeciesActions)!.mask).toBe(actionsBefore);
    expect(world.query(Creature, OfSpecies(amoeba!)).length).toBe(populationBefore);
  });

  it("records the lineage", () => {
    const { world, log } = startedWorld();
    const [amoeba] = world.query(Species);
    const algae = play(world, log, "algae");
    expect(algae.targetFor(DescendedFrom)).toBe(amoeba);
  });

  it("inherits the parent's actions and adds the card's grants", () => {
    const { world, log } = startedWorld();
    const [amoeba] = world.query(Species);
    const parentActions = amoeba!.get(SpeciesActions)!.mask;

    const algae = play(world, log, "algae");
    const childActions = algae.get(SpeciesActions)!.mask;

    // Everything the parent had survives...
    expect(childActions & parentActions).toBe(parentActions);
    // ...plus what the card granted.
    expect(childActions & ActionIds.bit.PHOTOSYNTHESIZE).not.toBe(0);
    expect(childActions & ActionIds.bit.SEED).not.toBe(0);
  });

  it("applies tag additions and removals", () => {
    const { world, log } = startedWorld();
    const algae = play(world, log, "algae");
    const tags = algae.get(SpeciesTags)!.mask;

    expect(Tags.has(tags, Tags.mask("PHOTOSYNTHETIC", "SESSILE"))).toBe(true);
    expect(Tags.hasAny(tags, Tags.mask("MOTILE"))).toBe(false);
    // Inherited and untouched by this card.
    expect(Tags.hasAny(tags, Tags.mask("AQUATIC"))).toBe(true);
  });

  it("founds the new species with a living creature", () => {
    const { world, log } = startedWorld();
    const algae = play(world, log, "algae");
    expect(world.query(Creature, OfSpecies(algae)).length).toBe(1);
  });

  it("gives distinct ids when the same card is played twice", () => {
    const { world, log } = startedWorld();
    play(world, log, "algae");
    play(world, log, "worm");
    const second = play(world, log, "algae");
    expect(second.get(Species)!.id).not.toBe("algae");
  });

  it("logs the mutation", () => {
    const { world, log } = startedWorld();
    play(world, log, "algae");
    expect(log.recent().some((event) => event.kind === "mutated")).toBe(true);
  });
});

describe("resultingTags", () => {
  it("adds before removing, so a card cannot re-grant what it strips", () => {
    const parent = Tags.mask("AQUATIC", "MOTILE");
    const tags = resultingTags(parent, cardById("algae"));
    expect(Tags.hasAny(tags, Tags.mask("MOTILE"))).toBe(false);
    expect(Tags.has(tags, Tags.mask("PHOTOSYNTHETIC"))).toBe(true);
  });
});

describe("previewCard", () => {
  it("warns that removing a tag will disable an inherited action", () => {
    // The whole reason the preview exists: algae removes MOTILE, which silently
    // strips SWIM and REPRODUCE from anything that had them.
    const { world } = startedWorld();
    const [amoeba] = world.query(Species);

    const preview = previewCard(cardById("algae"), amoeba!);
    const disabled = preview.disablesActions.map((loss) => loss.action);

    expect(disabled).toContain("SWIM");
    expect(disabled).toContain("REPRODUCE");
    for (const loss of preview.disablesActions) {
      expect(loss.missingTags).toContain("MOTILE");
    }
  });

  it("reports nothing lost when a card only adds", () => {
    const { world } = startedWorld();
    const [amoeba] = world.query(Species);
    const preview = previewCard(cardById("fish"), amoeba!);
    // Fish removes MICROBIAL and DECOMPOSER, which gates DECOMPOSE but not SWIM.
    expect(preview.disablesActions.map((loss) => loss.action)).not.toContain("SWIM");
  });

  it("does not modify the species it previews", () => {
    const { world } = startedWorld();
    const [amoeba] = world.query(Species);
    const before = amoeba!.get(SpeciesTags)!.mask;

    previewCard(cardById("algae"), amoeba!);

    expect(amoeba!.get(SpeciesTags)!.mask).toBe(before);
    expect(world.query(Species).length).toBe(1);
  });
});
