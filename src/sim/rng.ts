/**
 * Seeded pseudo-random number generator (mulberry32).
 *
 * A roguelike needs reproducible runs, and the simulation's determinism test
 * depends on *every* random decision flowing through here. `Math.random()` must
 * never appear anywhere under `sim/` or `game/`.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // `| 0` normalises to a 32-bit int so any seed value behaves identically.
    this.state = seed | 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, maxExclusive). Returns 0 when the range is empty. */
  int(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    return Math.floor(this.next() * maxExclusive);
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** A uniformly chosen element, or `undefined` for an empty array. */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(items.length)];
  }

  /** In-place Fisher-Yates. Returns the same array for convenience. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i]!;
      items[i] = items[j]!;
      items[j] = tmp;
    }
    return items;
  }

  /**
   * A new independent stream derived from this one. Useful for giving a
   * subsystem its own sequence without letting its call count perturb the
   * parent's — the main reason a stray extra `next()` breaks determinism.
   */
  fork(): Rng {
    return new Rng((this.next() * 4294967296) | 0);
  }

  /** Current internal state, for snapshotting and equality checks. */
  snapshot(): number {
    return this.state;
  }

  /** Restore a state captured by `snapshot()`. */
  restore(state: number): void {
    this.state = state | 0;
  }
}
