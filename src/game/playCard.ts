import type { Entity, World } from "koota";
import { ACTION_LIST } from "../sim/actions";
import { ActionIds, type ActionName } from "../sim/actions/ids";
import type { EventLog } from "../sim/events";
import { spawnCreature, spawnSpecies, type SpeciesDefinition } from "../sim/species";
import { Tags, type TagName } from "../sim/tags";
import { Life, Species, SpeciesActions, SpeciesTags, Voxel } from "../sim/traits";
import { getTurn } from "../sim/world";
import type { CardDefinition } from "./cards";
import type { CardTarget } from "./legality";

/**
 * Playing a mutation branches a new species off the target.
 *
 * The parent is left completely untouched — same tags, same actions, same
 * creatures. That is what makes a run build a tree rather than a chain, and
 * what keeps the base of the food web alive after you evolve past it.
 */

export interface GatingLoss {
  action: ActionName;
  missingTags: TagName[];
}

export interface CardPreview {
  speciesName: string;
  addsTags: TagName[];
  removesTags: TagName[];
  grantsActions: ActionName[];
  /**
   * Actions the child inherits but can no longer use, because the card removed
   * a tag they require.
   *
   * Surfacing this is not optional. Tag gating is implicit by design, so
   * without a preview a card that removes AQUATIC silently strips SWIM and the
   * player has no way to see it coming.
   */
  disablesActions: GatingLoss[];
}

/** What playing `card` on `species` would produce, without changing anything. */
export function previewCard(card: CardDefinition, species: Entity): CardPreview {
  const parentTags = species.get(SpeciesTags)?.mask ?? 0;
  const parentActions = species.get(SpeciesActions)?.mask ?? 0;

  const childTags = resultingTags(parentTags, card);
  const childActions = parentActions | ActionIds.maskOf(card.grantsActions);

  const disablesActions: GatingLoss[] = [];
  for (const action of ACTION_LIST) {
    if ((childActions & ActionIds.bit[action.id]) === 0) continue;
    // Was usable before the mutation, is not after it.
    if (!Tags.has(parentTags, action.requiresTags)) continue;
    const missingTags = Tags.missing(childTags, action.requiresTags);
    if (missingTags.length > 0) disablesActions.push({ action: action.id, missingTags });
  }

  return {
    speciesName: card.name,
    addsTags: [...card.addsTags],
    removesTags: [...(card.removesTags ?? [])],
    grantsActions: [...card.grantsActions],
    disablesActions,
  };
}

export function resultingTags(parentTags: number, card: CardDefinition): number {
  return (parentTags | Tags.maskOf(card.addsTags)) & ~Tags.maskOf(card.removesTags ?? []);
}

/**
 * Apply a card. Returns the species it created.
 *
 * Tags and actions inherit from the parent and are then modified; physiology
 * (habitat, needs, diet, life) comes wholesale from the card, because it
 * describes a different organism rather than an adjustment to the old one.
 */
export function playCard(
  world: World,
  card: CardDefinition,
  target: CardTarget,
  log: EventLog,
): Entity {
  const parent = target.speciesEntity;
  const parentTags = parent.get(SpeciesTags)?.mask ?? 0;
  const parentActions = parent.get(SpeciesActions)?.mask ?? 0;

  const definition: SpeciesDefinition = {
    id: uniqueSpeciesId(world, card.id),
    name: card.name,
    colorHex: card.colorHex,
    cardId: card.id,
    tags: Tags.toNames(resultingTags(parentTags, card)),
    actions: ActionIds.toNames(parentActions | ActionIds.maskOf(card.grantsActions)),
    habitat: card.habitat,
    needs: card.needs,
    provides: card.provides,
    diet: card.diet,
    locomotion: card.locomotion,
    life: card.life,
    actionWeights: card.actionWeights,
  };

  const species = spawnSpecies(world, definition, parent);

  // The founding population starts at full strength: a mutation that died on
  // the turn it was played would make the whole card feel like a coin flip.
  const startingEnergy = species.get(Life)?.maxEnergy ?? 1;
  spawnCreature(world, species, target.voxelEntity, startingEnergy);

  const at = target.voxelEntity.get(Voxel);
  log.push({
    turn: getTurn(world),
    kind: "mutated",
    message: `${card.name} evolved from ${target.speciesName} at (${at?.x}, ${at?.y}, ${at?.z})`,
    speciesId: definition.id,
    voxelIndex: at?.index,
  });

  return species;
}

/**
 * Species ids must stay unique because the same card can be played more than
 * once across a run, on different lineages.
 */
function uniqueSpeciesId(world: World, cardId: string): string {
  const taken = new Set<string>();
  for (const species of world.query(Species)) taken.add(species.get(Species)!.id);

  if (!taken.has(cardId)) return cardId;
  let suffix = 2;
  while (taken.has(`${cardId}-${suffix}`)) suffix++;
  return `${cardId}-${suffix}`;
}
