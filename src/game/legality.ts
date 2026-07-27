import type { Entity, World } from "koota";
import { Tags, type TagName } from "../sim/tags";
import { Terrains } from "../sim/terrain";
import { Creature, InVoxel, OfSpecies, Species, SpeciesTags, Terrain, Voxel } from "../sim/traits";
import type { CardDefinition } from "./cards";

/**
 * Where a card may be played, and — just as importantly — why it may not be.
 *
 * "No legal play" is a loss condition, so an unexplained rejection makes losing
 * feel arbitrary. Every path here produces a reason the UI can show.
 */

export interface CardTarget {
  speciesEntity: Entity;
  speciesId: string;
  speciesName: string;
  voxelEntity: Entity;
  voxelIndex: number;
}

export interface CardPlayability {
  playable: boolean;
  targets: CardTarget[];
  /** Null when playable; otherwise a plain-language explanation. */
  reason: string | null;
}

/**
 * A card is playable on a (species, voxel) pair when:
 *  1. the species carries every `requiresTags` and none of `forbidsTags`;
 *  2. it has a living creature in that voxel; and
 *  3. the *resulting* creature's habitat admits that voxel's terrain.
 *
 * (3) is the subtle one: the check is against what the card would create, not
 * against the parent. Playing `plant` on pond algae has to fail, because a
 * plant cannot live in water even though the algae can.
 */
export function cardPlayability(world: World, card: CardDefinition): CardPlayability {
  const required = Tags.maskOf(card.requiresTags);
  const forbidden = Tags.maskOf(card.forbidsTags ?? []);
  const resultingHabitat = Terrains.maskOf(card.habitat);

  const eligibleSpecies: Entity[] = [];
  for (const species of world.query(Species, SpeciesTags)) {
    const tags = species.get(SpeciesTags)!.mask;
    if (!Tags.has(tags, required)) continue;
    if (Tags.hasAny(tags, forbidden)) continue;
    eligibleSpecies.push(species);
  }

  if (eligibleSpecies.length === 0) {
    return { playable: false, targets: [], reason: describeMissingSpecies(world, card) };
  }

  const targets: CardTarget[] = [];
  for (const species of eligibleSpecies) {
    for (const creature of world.query(Creature, OfSpecies(species))) {
      const voxel = creature.targetFor(InVoxel);
      const terrain = voxel?.get(Terrain);
      const position = voxel?.get(Voxel);
      if (!voxel || !terrain || !position) continue;
      if ((resultingHabitat & terrain.kind) === 0) continue;

      targets.push({
        speciesEntity: species,
        speciesId: species.get(Species)!.id,
        speciesName: species.get(Species)!.name,
        voxelEntity: voxel,
        voxelIndex: position.index,
      });
    }
  }

  if (targets.length === 0) {
    const names = eligibleSpecies.map((species) => species.get(Species)!.name).join(" or ");
    const where = card.habitat.map((kind) => kind.toLowerCase()).join(" or ");
    return {
      playable: false,
      targets: [],
      reason: `${names} lives nowhere a ${card.name.toLowerCase()} could survive (needs ${where})`,
    };
  }

  return { playable: true, targets, reason: null };
}

export function legalTargets(world: World, card: CardDefinition): CardTarget[] {
  return cardPlayability(world, card).targets;
}

/** Distinguishes "nothing has the tag yet" from "everything already has it". */
function describeMissingSpecies(world: World, card: CardDefinition): string {
  const required = Tags.maskOf(card.requiresTags);
  const forbidden = Tags.maskOf(card.forbidsTags ?? []);

  let anyWithRequired = false;
  for (const species of world.query(Species, SpeciesTags)) {
    if (Tags.has(species.get(SpeciesTags)!.mask, required)) {
      anyWithRequired = true;
      break;
    }
  }

  if (!anyWithRequired) {
    return `needs a species that is ${describeTags(card.requiresTags)}`;
  }
  return `every ${describeTags(card.requiresTags)} species is already ${describeTags(
    Tags.toNames(forbidden),
  )}`;
}

function describeTags(tags: readonly TagName[]): string {
  if (tags.length === 0) return "anything";
  return tags.map((tag) => tag.toLowerCase()).join(" and ");
}
