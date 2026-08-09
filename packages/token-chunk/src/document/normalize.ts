/**
 * Normalizes line endings (`\r\n` and lone `\r` to `\n`) while retaining an
 * exact mapping back to offsets in the original input. Getting this mapping
 * wrong is the classic bug in this kind of package, so it is isolated and
 * tested on its own.
 *
 * Only `\r\n` -> `\n` changes length (2 chars -> 1); a lone `\r` -> `\n` is a
 * 1-for-1 substitution and never shifts offsets. So the mapping only needs a
 * sparse list of breakpoints where a `\r\n` collapse happened, each carrying
 * the cumulative offset delta from that point on — a binary search over that
 * list converts any normalized offset back to its original offset in
 * O(log n).
 */
export interface NormalizedDocument {
  readonly text: string;
  /** Converts an offset into `text` back to the matching offset into the original input. */
  toOriginalOffset(normalizedIndex: number): number;
}

interface Breakpoint {
  readonly normIndex: number;
  readonly delta: number;
}

export function normalizeLineEndings(input: string): NormalizedDocument {
  if (!input.includes('\r')) {
    return { text: input, toOriginalOffset: (index: number): number => index };
  }

  let out = '';
  const breakpoints: Breakpoint[] = [];
  let delta = 0;
  let i = 0;
  const { length } = input;

  while (i < length) {
    const ch = input[i];
    if (ch === '\r') {
      out += '\n';
      if (input[i + 1] === '\n') {
        i += 2;
        delta += 1;
        breakpoints.push({ normIndex: out.length, delta });
      } else {
        i += 1;
      }
      continue;
    }
    out += ch;
    i += 1;
  }

  const toOriginalOffset = (normalizedIndex: number): number => {
    let lo = 0;
    let hi = breakpoints.length - 1;
    let appliedCount = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const bp = breakpoints[mid];
      if (bp !== undefined && bp.normIndex <= normalizedIndex) {
        appliedCount = mid + 1;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const appliedDelta = appliedCount > 0 ? (breakpoints[appliedCount - 1]?.delta ?? 0) : 0;
    return normalizedIndex + appliedDelta;
  };

  return { text: out, toOriginalOffset };
}
