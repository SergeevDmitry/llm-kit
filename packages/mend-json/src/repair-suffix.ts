/**
 * Turns the current `ScannerState` into a `JsonMendResult`: decides how far
 * into the buffered input is safe to use as-is, what (if anything) needs to
 * be appended to close it, and builds `repairedJson` / `value` / diagnostics
 * from that decision.
 *
 * Suffix generation stays O(depth): every branch below inspects only
 * `state`'s O(1)/O(depth) fields (never rescans the buffer), and the only
 * O(buffer) work is the necessarily O(output) string slice/concat needed to
 * actually produce `repairedJson`.
 */
import type { Frame, ScannerState } from './state-machine.js';
import type { IncompleteScalarPolicy, JsonMendDiagnostic, JsonMendResult } from './types.js';

const CLOSER_FOR: Record<Frame['kind'], string> = { object: '}', array: ']' };

interface LeafDecision {
  /** Buffer offset up to which content is taken as-is (before exclusion ranges are applied). */
  readonly sliceEnd: number;
  /** Text appended immediately after the slice, before structural closers (e.g. a closing `"`). */
  readonly extra: string;
  /** Diagnostic recorded for this decision, if any (offset is filled in by the caller). */
  readonly diagnostic:
    { readonly code: JsonMendDiagnostic['code']; readonly message: string } | undefined;
}

const NO_REPAIR: LeafDecision = { sliceEnd: -1, extra: '', diagnostic: undefined };

/**
 * Decides how to close whatever is currently pending. Returns `undefined`
 * when there is no value at all yet (empty or whitespace-only input).
 *
 * `isFinishing` is `finish()`'s one extra power over `snapshot()`: a number
 * with no dangling unsafe suffix (no bare "-", trailing ".", or trailing "e"
 * / "e+") is legitimately complete once the caller declares no more input is
 * coming — end of stream is itself a valid number terminator in the JSON
 * grammar, unlike every other incomplete construct here.
 */
function decideLeaf(
  state: ScannerState,
  policy: IncompleteScalarPolicy,
  isFinishing: boolean,
): LeafDecision | undefined {
  switch (state.role) {
    case 'after-value':
      return { ...NO_REPAIR, sliceEnd: state.pos };

    case 'root-value-start':
      return undefined;

    case 'object-key-start':
    case 'array-value-start': {
      const frame = state.stack[state.stack.length - 1] as Frame;
      if (frame.count === 0) {
        return { ...NO_REPAIR, sliceEnd: state.pos };
      }
      return {
        sliceEnd: state.memberStart,
        extra: '',
        diagnostic: {
          code: 'member-removed',
          message:
            'a member/element started after the last comma had no content yet and was dropped',
        },
      };
    }

    case 'object-after-key':
    case 'object-value-start':
      return {
        sliceEnd: state.memberStart,
        extra: '',
        diagnostic: {
          code: 'member-removed',
          message: 'an object member with a key but no value yet was dropped',
        },
      };

    case 'in-key-string':
      return {
        sliceEnd: state.memberStart,
        extra: '',
        diagnostic: {
          code: 'member-removed',
          message: 'an object member with an unfinished key was dropped',
        },
      };

    case 'in-value-string':
      if (state.stringSafeEnd < state.pos) {
        return {
          sliceEnd: state.stringSafeEnd,
          extra: '"',
          diagnostic: {
            code: 'escape-truncated',
            message:
              'a dangling escape sequence at the end of an open string was dropped and the string closed',
          },
        };
      }
      return {
        sliceEnd: state.stringSafeEnd,
        extra: '"',
        diagnostic: {
          code: 'string-closed',
          message: 'an open string with no closing quote yet was closed at its current content',
        },
      };

    case 'in-number': {
      if (isFinishing && state.numberSafeEnd === state.pos) {
        return { ...NO_REPAIR, sliceEnd: state.pos };
      }
      if (policy === 'best-effort' && state.numberSafeEnd !== undefined) {
        const trimmed = state.numberSafeEnd < state.pos;
        return {
          sliceEnd: state.numberSafeEnd,
          extra: '',
          diagnostic: trimmed
            ? {
                code: 'number-truncated',
                message:
                  'an incomplete trailing part of a number (e.g. ".", "e", "e+") was dropped',
              }
            : undefined,
        };
      }
      return {
        sliceEnd: state.memberStart,
        extra: '',
        diagnostic: {
          code: 'scalar-omitted',
          message: 'an incomplete number was omitted (incompleteScalarPolicy: "omit")',
        },
      };
    }

    case 'in-literal': {
      // A scanned character that contradicted the literal (`tRue`, `tru5`)
      // freezes the scanner via `fail()`, which sets `errorPos` to the
      // *contradicting* character's own offset — strictly less than `pos`,
      // which `advanceChar` already advanced past it. That is provably
      // different from the two cases where completion is still legitimate:
      // plain truncation (no more input yet; `errorPos` stays `undefined`)
      // and the `MAX_BUFFER_BYTES_EXCEEDED` pre-scan freeze (nothing was
      // scanned, so `errorPos === pos`, not `<`). Only the contradicted case
      // must be excluded: completing a literal the input already disproved
      // would invent a value this package never sanctions — best-effort
      // exists for "`tru` can only ever become `true`", not for "the input
      // said otherwise but this is close enough".
      const contradicted = state.errorPos !== undefined && state.errorPos < state.pos;
      if (policy === 'best-effort' && state.literalKind !== undefined && !contradicted) {
        // `role` is only ever `'in-literal'` while `literalMatched <
        // literalKind.length` — the scanner completes the value (and leaves
        // this role) the instant the match finishes — so `remainder` here is
        // always non-empty.
        const remainder = state.literalKind.slice(state.literalMatched);
        return {
          sliceEnd: state.pos,
          extra: remainder,
          diagnostic: {
            code: 'scalar-completed',
            message: `an unambiguous partial literal was completed to "${state.literalKind}" (incompleteScalarPolicy: "best-effort")`,
          },
        };
      }
      return {
        sliceEnd: state.memberStart,
        extra: '',
        diagnostic: {
          code: 'scalar-omitted',
          message: contradicted
            ? 'a literal that contradicted every known JSON literal was omitted (not a valid partial match, regardless of incompleteScalarPolicy)'
            : 'an incomplete literal was omitted (incompleteScalarPolicy: "omit")',
        },
      };
    }
  }
}

/** Merges `excludedRanges` (added in completion order, not necessarily sorted) into disjoint, sorted ranges. */
function mergeRanges(ranges: readonly (readonly [number, number])[]): [number, number][] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0] as [number, number]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i] as [number, number];
    const last = merged[merged.length - 1] as [number, number];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/**
 * Finds the shallowest ancestor frame currently mid-way through scanning a
 * duplicate member (`duplicateKeyPolicy: 'first'`, colon already seen, value
 * not complete yet). While that member's value is still open — however deep
 * the scanner has descended into it — the whole member must stay invisible,
 * not just once it finishes: `decideLeaf` only ever reasons about the
 * *innermost* pending thing, so this walks the stack once (O(depth)) to
 * catch a suppression an arbitrary number of frames further out.
 */
function findActiveSuppression(
  state: ScannerState,
): { readonly frameIndex: number; readonly start: number } | undefined {
  for (let i = 0; i < state.stack.length; i += 1) {
    const start = state.stack[i]?.suppressStart;
    if (start !== undefined) {
      return { frameIndex: i, start };
    }
  }
  return undefined;
}

/** Concatenates `buffer[0, sliceEnd)`, skipping any excluded sub-range. */
function sliceWithExclusions(
  buffer: string,
  sliceEnd: number,
  excludedRanges: readonly [number, number][],
): string {
  const relevant = excludedRanges.filter(([, end]) => end <= sliceEnd);
  if (relevant.length === 0) {
    return buffer.slice(0, sliceEnd);
  }
  let out = '';
  let cursor = 0;
  for (const [start, end] of mergeRanges(relevant)) {
    out += buffer.slice(cursor, start);
    cursor = end;
  }
  out += buffer.slice(cursor, sliceEnd);
  return out;
}

export function buildSnapshot<T>(
  buffer: string,
  state: ScannerState,
  incompleteScalarPolicy: IncompleteScalarPolicy,
  includeDiagnostics: boolean,
  isFinishing: boolean,
): JsonMendResult<T> {
  const leaf = decideLeaf(state, incompleteScalarPolicy, isFinishing);

  if (leaf === undefined) {
    return {
      value: undefined,
      repairedJson: undefined,
      complete: false,
      validPrefixLength: 0,
      appendedSuffix: '',
      diagnostics: [],
    };
  }

  // An ancestor frame mid-way through a suppressed duplicate member always
  // wins over whatever `decideLeaf` found deeper inside: the member has to
  // stay invisible for its whole duration, not just once it completes.
  const suppression = findActiveSuppression(state);
  const suppressed = suppression !== undefined && suppression.start < leaf.sliceEnd;
  const rawSliceEnd = suppressed ? suppression.start : leaf.sliceEnd;

  // `state.errorPos` (set by `fail()`) is the last offset that was still
  // part of a well-formed prefix. Most `decideLeaf` branches already roll
  // back to `memberStart` or earlier, which can never be later than
  // `errorPos` — the error is always detected strictly after the pending
  // member/value started — so this clamp is a no-op for them. The
  // `'after-value'` branch and the empty-frame (`count === 0`) branches of
  // `'object-key-start'`/`'array-value-start'` are the exception: they
  // report `sliceEnd: state.pos` unconditionally, which — only when the
  // scanner is actually frozen (`errorPos` set) — would otherwise include
  // the very character that broke the document. A value already committed
  // to a snapshot must never be destroyed just because trailing
  // non-whitespace followed it.
  const trailingDataIgnored = state.errorPos !== undefined && state.errorPos < rawSliceEnd;
  const sliceEnd = trailingDataIgnored ? state.errorPos! : rawSliceEnd;
  const extra = suppressed ? '' : leaf.extra;
  const closeDepth = suppressed ? suppression.frameIndex + 1 : state.stack.length;
  const diagnostic = suppressed
    ? undefined
    : trailingDataIgnored
      ? {
          code: 'trailing-data-ignored' as const,
          message:
            'trailing content after the point where the document became invalid was ignored; ' +
            'the snapshot stays at its last valid prefix',
        }
      : leaf.diagnostic;

  const closers = state.stack
    .slice(0, closeDepth)
    .map((frame) => CLOSER_FOR[frame.kind])
    .reverse()
    .join('');
  const appendedSuffix = extra + closers;

  const diagnostics: JsonMendDiagnostic[] = [];
  if (includeDiagnostics) {
    // Loop, not `diagnostics.push(...state.permanentDiagnostics)`: a spread
    // argument goes on the call stack, and `state.permanentDiagnostics`
    // grows by one entry per skipped duplicate key
    // (`duplicateKeyPolicy: 'first'`, `state-machine.ts`'s `completeValue`),
    // a direct function of untrusted input size. Past the engine's argument
    // limit a spread would throw a raw `RangeError` out of `snapshot()`.
    // `MAX_PERMANENT_DIAGNOSTICS` in `state-machine.ts` keeps this array
    // from ever reaching that size at all; the loop is the mechanical fix
    // an ESLint rule enforces for every call site regardless.
    for (const permanent of state.permanentDiagnostics) {
      diagnostics.push(permanent);
    }
    if (diagnostic !== undefined) {
      diagnostics.push({ offset: sliceEnd, ...diagnostic });
    }
    if (closers.length > 0) {
      diagnostics.push({
        code: 'closers-appended',
        offset: sliceEnd,
        message: `appended "${closers}" to close ${String(closeDepth)} open structure(s)`,
      });
    }
  }

  const rolledBack = diagnostic !== undefined || suppressed;
  const hasExclusions = state.excludedRanges.some(([, end]) => end <= sliceEnd);
  // Deliberately *not* `!state.errored &&` here. `complete` is a statement
  // about the returned value — "is this slice of the input, as repaired, a
  // complete and valid JSON document as-is" — not a promise about whether
  // the mender will ever accept more input. A frozen scanner (`state.errored`)
  // does not by itself mean the *value* is wrong or partial; it means no
  // more input will be scanned. Whether the freeze actually invalidated
  // something already scanned is exactly what `rolledBack` (and
  // `hasExclusions`) already answer:
  //
  //  - Every freeze that corrupts or truncates already-scanned content goes
  //    through `fail()`, whose `errorPos` is always `state.pos - 1` —
  //    strictly less than the `'after-value'` branch's `sliceEnd: state.pos`
  //    above, so `trailingDataIgnored` is always true and `diagnostic` is
  //    always set, forcing `rolledBack`. This covers every genuine syntax
  //    error (trailing garbage, mismatched closer, invalid literal, ...).
  //  - `MAX_DEPTH_EXCEEDED` and `JsonMendDuplicateKeyError` are always thrown
  //    while a frame is still open (`beginValue` is only reached while
  //    starting a *new* nested value; the duplicate-key check runs inside an
  //    open object) or, for `maxDepth: 0` at the root, before any value
  //    exists at all (`decideLeaf` returns `undefined` for
  //    `'root-value-start'`, short-circuiting above `complete` entirely) —
  //    so `state.stack.length === 0` (or the early `undefined` return)
  //    already forces `complete: false` for these, independent of `errored`.
  //  - `MAX_BUFFER_BYTES_EXCEEDED` is the one freeze that can happen with
  //    *nothing* left to roll back: `push()`'s `checkBufferBytes` throws
  //    before any character of the rejected chunk is scanned, so
  //    `errorPos === state.pos` there (not `state.pos - 1`) — equal to, not
  //    less than, `rawSliceEnd`, so `trailingDataIgnored` is false and no
  //    diagnostic is manufactured. If the document was already complete (or,
  //    via `finish()`, a root number had already reached a safe terminal
  //    state) at the moment the cap tripped, the value the caller already
  //    holds is genuinely, unambiguously complete — the cap prevented
  //    looking at *more* input, it did not un-parse what was already there.
  //
  // In short: `!rolledBack` already implies "no freeze corrupted this slice"
  // for every freeze that could; a redundant `!state.errored` term would only
  // add a case where a value already handed to the caller silently flips to
  // `complete: false` with no diagnostic explaining why.
  const complete =
    !rolledBack &&
    !hasExclusions &&
    appendedSuffix.length === 0 &&
    state.stack.length === 0 &&
    sliceEnd === buffer.length;

  // `repairedJson` and `value` are the only fields whose cost scales with
  // buffer size (a slice plus a `JSON.parse`, both O(sliceEnd)) — everything
  // above is O(depth) or O(number of diagnostics). Computing them eagerly on
  // every `push()` would make pushing many small chunks quadratic overall
  // (each snapshot re-slicing/re-parsing a buffer that keeps growing),
  // exactly the full-buffer rescan the scanner is designed to avoid. Deferring them to a
  // memoized getter means a caller that pushes chunk-by-chunk without
  // reading every intermediate result never pays for the results it never
  // looked at, while a caller that *does* read `value`/`repairedJson` on
  // every push sees no difference in behavior — only in when the cost lands.
  let cached: { readonly value: T | undefined; readonly json: string | undefined } | undefined;
  function resolve(): { readonly value: T | undefined; readonly json: string | undefined } {
    if (cached === undefined) {
      const repairedJson =
        sliceWithExclusions(buffer, sliceEnd, state.excludedRanges) + appendedSuffix;
      try {
        cached = { value: JSON.parse(repairedJson) as T, json: repairedJson };
      } catch {
        // Every reachable `leaf` branch produces text that parses; this is a
        // last-resort guard so a scanner defect degrades to "no value"
        // instead of throwing out of a read-only call.
        cached = { value: undefined, json: undefined };
      }
    }
    return cached;
  }

  const result = {
    complete,
    validPrefixLength: sliceEnd,
    appendedSuffix,
    diagnostics,
  } as unknown as JsonMendResult<T>;
  Object.defineProperty(result, 'value', {
    enumerable: true,
    configurable: true,
    get: () => resolve().value,
  });
  Object.defineProperty(result, 'repairedJson', {
    enumerable: true,
    configurable: true,
    get: () => resolve().json,
  });
  return result;
}
