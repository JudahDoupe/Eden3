import type { ActionName } from "../sim/actions/ids";
import type { ResourceLevels } from "../sim/resources";
import type { LifeConfig } from "../sim/species";
import type { TagName } from "../sim/tags";
import type { TerrainName } from "../sim/terrain";

/**
 * A mutation card.
 *
 * Playing one branches a *new* species off the target; the parent survives, so
 * a run builds an evolutionary tree rather than a chain.
 *
 * Tags and actions are inherited from the parent and then modified. Everything
 * else — habitat, needs, diet, life — is stated outright by the card, because
 * it describes a different organism, not an adjustment to the old one.
 *
 * Note there is no `removesActions`: `removesTags` already does that job, since
 * every action requires tags. Two mechanisms for removing a behaviour would
 * make the rule impossible to reason about.
 */
export interface CardDefinition {
  id: string;
  name: string;
  colorHex: number;
  /** One line explaining the organism, for the card face. */
  blurb: string;

  /** The target species must have all of these. */
  requiresTags: readonly TagName[];
  /** The target species must have none of these. */
  forbidsTags?: readonly TagName[];

  addsTags: readonly TagName[];
  removesTags?: readonly TagName[];
  grantsActions: readonly ActionName[];

  habitat: readonly TerrainName[];
  needs?: Partial<ResourceLevels>;
  provides?: Partial<ResourceLevels>;
  diet?: readonly TagName[];
  locomotion?: number;
  life?: Partial<LifeConfig>;
  actionWeights?: Partial<Record<ActionName, number>>;
}

/**
 * The prototype card set.
 *
 * Three lineages branch off the starting amoeba and interlock:
 *   producers   algae -> plant -> flower / bush / tree
 *   decomposers mold -> fungus, and worm
 *   consumers   fish -> salamander -> lizard / mouse / bird
 *
 * `algae` is the clearest illustration of tag gating: it removes MOTILE, which
 * silently disables SWIM and REPRODUCE, and adds SESSILE, which enables SEED.
 * Nothing in the card says "algae cannot swim".
 */
export const CARDS: readonly CardDefinition[] = [
  // The three openers. Each is playable on the starting amoeba, and each is
  // amphibious enough to reach the shore — nothing else in the deck can get
  // onto land, so if these stayed in the water the whole terrestrial half of
  // the tree would be unreachable.
  {
    id: "algae",
    name: "Algae",
    colorHex: 0x4caf6a,
    blurb: "Anchors itself and eats light. Mats over water and wet ground alike.",
    requiresTags: ["AQUATIC"],
    forbidsTags: ["PHOTOSYNTHETIC"],
    addsTags: ["PHOTOSYNTHETIC", "SESSILE"],
    removesTags: ["MOTILE"],
    grantsActions: ["PHOTOSYNTHESIZE", "SEED"],
    habitat: ["WATER", "SOIL"],
    needs: { light: 0.35, moisture: 0.4 },
    provides: { oxygen: 0.4 },
    life: { maxAge: 18, metabolism: 0.05, reproduceThreshold: 0.6, reproduceCost: 0.3 },
  },
  {
    id: "worm",
    name: "Worm",
    colorHex: 0xc98686,
    blurb: "Burrows through silt and soil, turning the dead into ground.",
    requiresTags: ["DECOMPOSER", "MOTILE"],
    forbidsTags: ["TERRESTRIAL"],
    addsTags: ["TERRESTRIAL"],
    removesTags: ["MICROBIAL"],
    grantsActions: ["WALK"],
    habitat: ["WATER", "SOIL"],
    needs: { nutrients: 0.3, moisture: 0.3 },
    provides: { nutrients: 0.12 },
    locomotion: 1,
    life: { maxAge: 22, metabolism: 0.05, reproduceThreshold: 0.62, reproduceCost: 0.3 },
  },
  {
    id: "mold",
    name: "Mold",
    colorHex: 0x8f7fb0,
    blurb: "Spreads as a mat across damp ground. Never moves again.",
    requiresTags: ["DECOMPOSER", "TERRESTRIAL"],
    forbidsTags: ["FUNGUS"],
    addsTags: ["FUNGUS", "SESSILE"],
    removesTags: ["MOTILE", "AQUATIC"],
    grantsActions: ["SEED"],
    habitat: ["SOIL"],
    needs: { nutrients: 0.3, moisture: 0.3 },
    provides: { nutrients: 0.08 },
    life: { maxAge: 20, metabolism: 0.045, reproduceThreshold: 0.58, reproduceCost: 0.28 },
  },
  {
    id: "fungus",
    name: "Fungus",
    colorHex: 0xb08fd0,
    blurb: "A deeper network that unlocks nutrients mold cannot reach.",
    requiresTags: ["FUNGUS"],
    addsTags: [],
    grantsActions: ["DECOMPOSE", "SEED"],
    habitat: ["SOIL"],
    needs: { nutrients: 0.2, moisture: 0.3 },
    provides: { nutrients: 0.2 },
    life: { maxAge: 30, metabolism: 0.04, reproduceThreshold: 0.6, reproduceCost: 0.3 },
  },
  {
    id: "plant",
    name: "Plant",
    colorHex: 0x5fbf4f,
    blurb: "Carries photosynthesis onto land, rooted in lit soil.",
    requiresTags: ["PHOTOSYNTHETIC"],
    forbidsTags: ["PLANT"],
    addsTags: ["PLANT", "TERRESTRIAL"],
    removesTags: ["AQUATIC"],
    grantsActions: ["PHOTOSYNTHESIZE", "SEED"],
    habitat: ["SOIL"],
    needs: { light: 0.4, nutrients: 0.25, moisture: 0.3 },
    provides: { oxygen: 0.35 },
    life: { maxAge: 25, metabolism: 0.05, reproduceThreshold: 0.62, reproduceCost: 0.3 },
  },
  {
    id: "flower",
    name: "Flower",
    colorHex: 0xe8a0c8,
    blurb: "Spends heavily on seed, spreading faster than it lives long.",
    requiresTags: ["PLANT"],
    addsTags: [],
    grantsActions: ["SEED"],
    habitat: ["SOIL"],
    needs: { light: 0.45, nutrients: 0.3, moisture: 0.35 },
    provides: { oxygen: 0.3 },
    locomotion: 1,
    life: { maxAge: 14, metabolism: 0.05, reproduceThreshold: 0.5, reproduceCost: 0.22 },
    actionWeights: { SEED: 1.4 },
  },
  {
    id: "bush",
    name: "Bush",
    colorHex: 0x3f8f45,
    blurb: "Hardy and slow. Holds ground that flowers cannot.",
    requiresTags: ["PLANT"],
    addsTags: [],
    grantsActions: ["PHOTOSYNTHESIZE", "SEED"],
    habitat: ["SOIL"],
    needs: { light: 0.35, nutrients: 0.35, moisture: 0.25 },
    provides: { oxygen: 0.4 },
    life: { maxAge: 40, metabolism: 0.04, reproduceThreshold: 0.7, reproduceCost: 0.35 },
  },
  {
    id: "tree",
    name: "Tree",
    colorHex: 0x2f7d3f,
    blurb: "Long-lived and demanding. Oxygenates everything around it.",
    requiresTags: ["PLANT"],
    addsTags: [],
    grantsActions: ["PHOTOSYNTHESIZE", "SEED"],
    habitat: ["SOIL"],
    needs: { light: 0.5, nutrients: 0.4, moisture: 0.35 },
    provides: { oxygen: 0.6 },
    life: { maxAge: 60, metabolism: 0.035, maxEnergy: 1, reproduceThreshold: 0.78, reproduceCost: 0.4 },
  },
  {
    id: "fish",
    name: "Fish",
    colorHex: 0x4f9fd8,
    blurb: "The first hunter. Grazes the algae it evolved alongside.",
    requiresTags: ["AQUATIC", "MOTILE"],
    forbidsTags: ["HETEROTROPH"],
    addsTags: ["HETEROTROPH", "VERTEBRATE"],
    removesTags: ["MICROBIAL", "DECOMPOSER"],
    grantsActions: ["EAT"],
    habitat: ["WATER"],
    // Grazes algae, not amoebas. Eating MICROBIAL made fish an extinction
    // button for the starting species, which is the only source of
    // DECOMPOSER+MOTILE — and losing it strands worm, mold and fungus
    // permanently. Depending on algae is better ecology and a softer cliff.
    diet: ["PHOTOSYNTHETIC"],
    needs: { oxygen: 0.35, moisture: 0.6 },
    locomotion: 1,
    life: { maxAge: 28, metabolism: 0.06, reproduceThreshold: 0.7, reproduceCost: 0.35 },
  },
  {
    id: "salamander",
    name: "Salamander",
    colorHex: 0xd8a34f,
    blurb: "Amphibian: at home in the pond and on its shore.",
    requiresTags: ["VERTEBRATE", "AQUATIC"],
    forbidsTags: ["TERRESTRIAL"],
    addsTags: ["TERRESTRIAL"],
    grantsActions: ["WALK"],
    habitat: ["WATER", "SOIL"],
    diet: ["PHOTOSYNTHETIC", "MICROBIAL", "DECOMPOSER"],
    needs: { moisture: 0.4, oxygen: 0.2 },
    locomotion: 1,
    life: { maxAge: 30, metabolism: 0.06, reproduceThreshold: 0.72, reproduceCost: 0.36 },
  },
  {
    id: "lizard",
    name: "Lizard",
    colorHex: 0x9fb04f,
    blurb: "Cuts its ties to the water for good.",
    requiresTags: ["VERTEBRATE", "TERRESTRIAL"],
    forbidsTags: ["AERIAL"],
    addsTags: [],
    removesTags: ["AQUATIC"],
    grantsActions: ["WALK", "EAT"],
    habitat: ["SOIL"],
    diet: ["DECOMPOSER", "FUNGUS", "MICROBIAL"],
    needs: { moisture: 0.15, oxygen: 0.15 },
    locomotion: 2,
    life: { maxAge: 32, metabolism: 0.055, reproduceThreshold: 0.72, reproduceCost: 0.36 },
  },
  {
    id: "mouse",
    name: "Mouse",
    colorHex: 0xb0a08f,
    blurb: "Small, quick, and entirely dependent on plants.",
    requiresTags: ["VERTEBRATE", "TERRESTRIAL"],
    forbidsTags: ["AERIAL"],
    addsTags: [],
    removesTags: ["AQUATIC"],
    grantsActions: ["WALK", "EAT"],
    habitat: ["SOIL"],
    diet: ["PLANT", "PHOTOSYNTHETIC"],
    needs: { moisture: 0.2, oxygen: 0.15 },
    locomotion: 2,
    life: { maxAge: 20, metabolism: 0.06, reproduceThreshold: 0.66, reproduceCost: 0.32 },
  },
  {
    id: "bird",
    name: "Bird",
    colorHex: 0xe0d070,
    blurb: "Takes to the air, and can reach anything below it.",
    requiresTags: ["VERTEBRATE", "TERRESTRIAL"],
    forbidsTags: ["AERIAL"],
    addsTags: ["AERIAL"],
    grantsActions: ["FLY", "EAT"],
    habitat: ["AIR", "SOIL"],
    diet: ["PLANT", "DECOMPOSER", "MICROBIAL"],
    needs: { oxygen: 0.4 },
    locomotion: 2,
    life: { maxAge: 26, metabolism: 0.07, reproduceThreshold: 0.72, reproduceCost: 0.36 },
  },
];

export const CARDS_BY_ID: ReadonlyMap<string, CardDefinition> = new Map(
  CARDS.map((card) => [card.id, card]),
);

export function cardById(id: string): CardDefinition {
  const card = CARDS_BY_ID.get(id);
  if (!card) throw new Error(`unknown card "${id}"`);
  return card;
}
