/**
 * Named bit flags over a plain `number`.
 *
 * Both species tags and action ids are sets drawn from a small fixed vocabulary
 * and are tested against each other constantly (every action, every creature,
 * every turn), so they live as bitmasks rather than string arrays.
 *
 * `missing()` is the reason this is a shared helper rather than two hand-rolled
 * enums: when an action is gated out, the inspector has to say *which* tag the
 * species lacks, not merely that it failed.
 */

/** Bit 31 is the sign bit; staying under it keeps every operation safe. */
const MAX_FLAGS = 31;

export interface FlagSet<N extends string> {
  /** Single-bit value for each name. */
  readonly bit: Readonly<Record<N, number>>;
  /** Declaration order, which is also bit order. */
  readonly names: readonly N[];
  /** Combine names into one mask. */
  mask(...names: N[]): number;
  /** Combine an iterable of names into one mask. */
  maskOf(names: Iterable<N>): number;
  /** True when `mask` contains *every* bit in `required`. */
  has(mask: number, required: number): boolean;
  /** True when `mask` contains *at least one* bit in `any`. */
  hasAny(mask: number, any: number): boolean;
  /** The names present in `required` but absent from `mask`. */
  missing(mask: number, required: number): N[];
  /** The names present in `mask`. */
  toNames(mask: number): N[];
}

export function defineFlags<const N extends string>(names: readonly N[]): FlagSet<N> {
  if (names.length > MAX_FLAGS) {
    throw new Error(`defineFlags: ${names.length} flags exceeds the ${MAX_FLAGS}-bit limit`);
  }
  const duplicate = names.find((name, i) => names.indexOf(name) !== i);
  if (duplicate !== undefined) {
    throw new Error(`defineFlags: duplicate flag "${duplicate}"`);
  }

  const bit = {} as Record<N, number>;
  names.forEach((name, i) => {
    bit[name] = 1 << i;
  });

  const maskOf = (subset: Iterable<N>): number => {
    let mask = 0;
    for (const name of subset) mask |= bit[name];
    return mask;
  };

  const toNames = (mask: number): N[] => names.filter((name) => (mask & bit[name]) !== 0);

  return {
    bit: bit as Readonly<Record<N, number>>,
    names,
    mask: (...subset: N[]) => maskOf(subset),
    maskOf,
    has: (mask, required) => (mask & required) === required,
    hasAny: (mask, any) => (mask & any) !== 0,
    missing: (mask, required) => toNames(required & ~mask),
    toNames,
  };
}
