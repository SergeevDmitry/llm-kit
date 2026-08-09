/**
 * Deterministic pseudo-random source for property tests and fuzzing.
 *
 * Every llm-kit test that needs randomness must use a seeded generator so a
 * failing CI run can be reproduced exactly from the printed seed.
 */

export interface SeededRandom {
  readonly seed: number;
  /** Uniform float in `[0, 1)`. */
  next(): number;
  /** Uniform integer in `[min, max]`. */
  int(min: number, max: number): number;
  /** Picks one element; throws on an empty array. */
  pick<T>(values: readonly T[]): T;
  /** Returns a new shuffled array; the input is not mutated. */
  shuffle<T>(values: readonly T[]): T[];
  /** Restarts the sequence from the original seed. */
  reset(): void;
}

/**
 * mulberry32: 32-bit state, fast, and stable across Node and Bun. Not
 * cryptographically secure and never used for anything but test data.
 */
export function createSeededRandom(seed = 0x9e3779b9): SeededRandom {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const random: SeededRandom = {
    seed,
    next,
    int(min: number, max: number): number {
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new TypeError('createSeededRandom().int expects integer bounds');
      }
      if (max < min) {
        throw new RangeError('createSeededRandom().int expects max >= min');
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) {
        throw new RangeError('createSeededRandom().pick expects a non-empty array');
      }
      return values[random.int(0, values.length - 1)] as T;
    },
    shuffle<T>(values: readonly T[]): T[] {
      const copy = [...values];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = random.int(0, i);
        const a = copy[i] as T;
        const b = copy[j] as T;
        copy[i] = b;
        copy[j] = a;
      }
      return copy;
    },
    reset(): void {
      state = seed >>> 0;
    },
  };

  return random;
}
