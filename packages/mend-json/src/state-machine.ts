/**
 * The incremental JSON lexical/structural state machine.
 *
 * `advanceChar` is the whole scanner: it consumes exactly one character and
 * updates `ScannerState` in place, in O(1) — no lookahead, no backtracking,
 * no rescan of anything already consumed. Feeding a stream through it one
 * character at a time is what makes the package's scanning amortized O(n)
 * across the whole stream: a chunk of length k costs k transitions, however
 * the chunk boundaries fall.
 *
 * The state carries just enough to answer, at any instant, two questions in
 * O(1) without looking at the buffer text:
 *
 * 1. Is "right now" a safe point to close the document (its last safe
 *    truncation point)? See `role` and the scalar sub-state fields.
 * 2. If not, where is the nearest safe point behind it? That is always
 *    `memberStart` (or, inside an open string/number, `stringSafeEnd` /
 *    `numberSafeEnd`) — never further back than the *current* frame, because
 *    `memberStart` is only ever recorded at a moment when every ancestor
 *    frame was already itself safely closable (see `repair-suffix.ts`).
 */
import { JsonMendDuplicateKeyError, JsonMendLimitError } from './errors.js';
import { MAX_PERMANENT_DIAGNOSTICS } from './limits.js';
import type { DuplicateKeyPolicy, JsonMendDiagnostic } from './types.js';

export type FrameKind = 'object' | 'array';

export interface Frame {
  readonly kind: FrameKind;
  /** Members (object) or elements (array) fully completed in this frame so far. */
  count: number;
  /** Object frames only: every key committed so far, for `duplicateKeyPolicy`. */
  seenKeys?: Set<string>;
  /**
   * Object frames only, `duplicateKeyPolicy: 'first'`: while scanning a
   * member whose key repeats an earlier one, the offset of the comma (or
   * open brace, for a first member — which can never itself be a duplicate)
   * that starts it. The member is scanned normally, to keep nesting correct,
   * but excluded from `repairedJson` output once it completes.
   */
  suppressStart?: number;
}

export type Role =
  | 'root-value-start'
  | 'object-key-start'
  | 'object-after-key'
  | 'object-value-start'
  | 'array-value-start'
  | 'in-key-string'
  | 'in-value-string'
  | 'in-number'
  | 'in-literal'
  | 'after-value';

type StringEscapeState = 'none' | 'escaped' | 'u1' | 'u2' | 'u3' | 'u4';
type NumberPhase =
  | 'sign'
  | 'leadingZero'
  | 'intDigits'
  | 'pointSeen'
  | 'fracDigits'
  | 'expMarker'
  | 'expSign'
  | 'expDigits';

export interface ScannerState {
  /** Characters consumed so far (== length of the accumulated buffer). */
  pos: number;
  stack: Frame[];
  role: Role;
  /**
   * Rollback point for whatever member/element is currently pending at the
   * innermost frame (or, at the root, for the root value itself). Only
   * meaningful while `role` is not `'after-value'`.
   */
  memberStart: number;
  /** Set once a genuine (non-truncation) syntax error is found; scanning stops. */
  errored: boolean;
  errorMessage: string | undefined;
  /**
   * The last offset that was still part of a well-formed prefix; `undefined`
   * while healthy. Set by `freezeAt` (directly, or via its `fail()`
   * convenience wrapper — see both doc comments) at the moment the scanner
   * freezes, from whichever offset the caller proves is correct for its own
   * call site: `state.pos - 1` when a character was consumed and dispatch
   * failed on it, `state.pos` itself when nothing was consumed (a
   * resource-limit check that runs before scanning). `repair-suffix.ts`
   * clamps every slice to it so a snapshot never includes the character that
   * broke the document, and never discards a character that was already
   * committed.
   */
  errorPos: number | undefined;

  // --- string sub-state (role is 'in-key-string' or 'in-value-string') ---
  stringEscape: StringEscapeState;
  /** Last position where the open string's content had no dangling escape. */
  stringSafeEnd: number;
  /** Decoded text of the key currently being scanned (escapes resolved), for duplicate detection. */
  keyText: string;
  /** Accumulated hex digits of an in-progress `\uXXXX` escape. */
  unicodeEscapeDigits: string;

  // --- number sub-state (role is 'in-number') ---
  numberPhase: NumberPhase;
  /** Last position in a syntactically closable number sub-phase; `undefined` means nothing closable yet. */
  numberSafeEnd: number | undefined;

  // --- literal sub-state (role is 'in-literal') ---
  literalKind: 'true' | 'false' | 'null' | undefined;
  literalMatched: number;

  /** Duplicate-key exclusions collected so far: `[start, end)` ranges to drop from the raw buffer. */
  excludedRanges: [number, number][];
  /**
   * Diagnostics for repairs that are permanent facts about the document
   * scanned so far (currently: dropped duplicate members), as opposed to
   * repairs of whatever is *currently* pending, which `repair-suffix.ts`
   * derives fresh from `role` on every snapshot.
   */
  permanentDiagnostics: JsonMendDiagnostic[];
}

export function createScannerState(): ScannerState {
  return {
    pos: 0,
    stack: [],
    role: 'root-value-start',
    memberStart: 0,
    errored: false,
    errorMessage: undefined,
    errorPos: undefined,
    stringEscape: 'none',
    stringSafeEnd: 0,
    keyText: '',
    unicodeEscapeDigits: '',
    numberPhase: 'sign',
    numberSafeEnd: undefined,
    literalKind: undefined,
    literalMatched: 0,
    excludedRanges: [],
    permanentDiagnostics: [],
  };
}

const LITERALS = { t: 'true', f: 'false', n: 'null' } as const;
const CLOSER_FOR: Record<FrameKind, string> = { object: '}', array: ']' };
const SIMPLE_ESCAPES: Record<string, string> = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isHexDigit(ch: string): boolean {
  return isDigit(ch) || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

/**
 * Freezes the scanner at an *explicit* boundary offset: the last offset that
 * was still part of a well-formed prefix. `errorPos` records that boundary
 * once, on the first failure — later failures (e.g. more trailing garbage
 * after the mender is already frozen) never move it further forward.
 *
 * No default is offered for `errorPos`, deliberately: `state.pos - 1` is
 * correct for every call site inside `advanceChar`'s call tree, which
 * increments `state.pos` before dispatching, so by the time any of those
 * call sites run, `state.pos` is already one past the character that ended
 * well-formed scanning. It is wrong for `create-json-mender.ts`'s `push()`,
 * which checks `maxBufferBytes` *before* any character of the new chunk is
 * scanned — there, `state.pos` already *is* the boundary, and subtracting
 * one would discard an already-committed character. A default would let
 * that assumption travel unexamined to a call site it doesn't hold for;
 * requiring every caller to state its offset forces the question to be
 * asked at each new one.
 *
 * Two call sites, by design:
 *  - `fail(state, message)` below — the convenience wrapper for every call
 *    site inside `advanceChar`'s own dispatch tree (directly, or via
 *    `advanceString`/`advanceNumber`/`beginValue`/`advanceWaiting`, all only
 *    ever invoked from `advanceChar`), where `state.pos - 1` is provably
 *    correct for the reason above. Do not add a new internal call site that
 *    bypasses this wrapper unless it is genuinely reached from that same
 *    post-increment call tree.
 *  - `create-json-mender.ts`, directly, for the two hazards outside that
 *    tree: `scanText`'s `catch` (a thrown `JsonMendLimitError` or
 *    `JsonMendDuplicateKeyError` surfacing mid-chunk — still inside the
 *    post-increment invariant, since the throw happens synchronously from
 *    inside `advanceChar`'s dispatch, so it passes `state.pos - 1` too, just
 *    explicitly) and `push()`'s `checkBufferBytes` `catch` (no character
 *    scanned yet, so `state.pos` itself — not `state.pos - 1` — is the
 *    boundary).
 */
export function freezeAt(state: ScannerState, message: string, errorPos: number): void {
  state.errored = true;
  state.errorMessage = message;
  state.errorPos ??= errorPos;
}

/**
 * Convenience wrapper for `freezeAt` used throughout this file: every call
 * site here is reached from inside `advanceChar`'s dispatch tree, after its
 * `state.pos += 1` for the character currently being processed, so
 * `state.pos - 1` is always the correct boundary. See `freezeAt`'s doc
 * comment for why that is a provable invariant here and not a default to
 * lean on elsewhere.
 */
export function fail(state: ScannerState, message: string): void {
  freezeAt(state, message, state.pos - 1);
}

/**
 * Appends to `state.permanentDiagnostics`, capped at
 * {@link MAX_PERMANENT_DIAGNOSTICS} (see that constant's doc comment for
 * why the cap exists and how 1000 was chosen). Once the cap is reached, a
 * single `'diagnostics-truncated'` entry replaces every further individual
 * diagnostic — recorded, not silently dropped, so a caller inspecting
 * `diagnostics` can tell the list stopped being exhaustive instead of
 * assuming it saw every repair. Called once per skipped duplicate key
 * (currently the only permanent-diagnostic source); the length check keeps
 * this O(1) per call, preserving the scanner's amortized-O(n) guarantee.
 */
function pushPermanentDiagnostic(state: ScannerState, diagnostic: JsonMendDiagnostic): void {
  const count = state.permanentDiagnostics.length;
  if (count < MAX_PERMANENT_DIAGNOSTICS) {
    state.permanentDiagnostics.push(diagnostic);
  } else if (count === MAX_PERMANENT_DIAGNOSTICS) {
    state.permanentDiagnostics.push({
      code: 'diagnostics-truncated',
      offset: diagnostic.offset,
      message:
        `permanent diagnostics were truncated after ${String(MAX_PERMANENT_DIAGNOSTICS)} ` +
        'entries; further repairs of this kind still happened but are no longer individually recorded',
    });
  }
  // else: already truncated — do nothing further, so this array never grows
  // past MAX_PERMANENT_DIAGNOSTICS + 1 regardless of stream size.
}

/**
 * Completes the member/element currently pending at the top frame (or, at
 * the root, the document itself) and returns control to the appropriate
 * waiting role. Called whenever a value — of any kind — finishes.
 *
 * `endPos` is the offset right after the value's own last character. It
 * defaults to `state.pos`, correct for every caller except the number
 * lookahead-redispatch path, where `state.pos` has already moved past the
 * delimiter that revealed the number was finished — that caller passes the
 * number's true end explicitly so a duplicate-member exclusion range never
 * swallows the delimiter that separates it from the next member.
 */
function completeValue(state: ScannerState, endPos: number = state.pos): void {
  const frame = state.stack[state.stack.length - 1];
  if (frame === undefined) {
    state.role = 'after-value'; // root value done
    return;
  }
  frame.count += 1;
  if (frame.suppressStart !== undefined) {
    state.excludedRanges.push([frame.suppressStart, endPos]);
    pushPermanentDiagnostic(state, {
      code: 'duplicate-key-skipped',
      offset: frame.suppressStart,
      message:
        'later occurrence of a repeated object key was dropped (duplicateKeyPolicy: "first")',
    });
    frame.suppressStart = undefined;
  }
  state.role = 'after-value';
}

/** Pops the top frame after its closer character is consumed. */
function popFrame(state: ScannerState): void {
  state.stack.pop();
  completeValue(state);
}

function beginValue(state: ScannerState, ch: string, depthLimit: number): void {
  if (ch === '"') {
    state.role = 'in-value-string';
    state.stringEscape = 'none';
    state.stringSafeEnd = state.pos;
    return;
  }
  if (ch === '{' || ch === '[') {
    if (state.stack.length + 1 > depthLimit) {
      throw new JsonMendLimitError(
        'MAX_DEPTH_EXCEEDED',
        `nesting depth ${String(state.stack.length + 1)} exceeds maxDepth ${String(depthLimit)}`,
      );
    }
    state.stack.push(
      ch === '{' ? { kind: 'object', count: 0, seenKeys: new Set() } : { kind: 'array', count: 0 },
    );
    state.role = ch === '{' ? 'object-key-start' : 'array-value-start';
    state.memberStart = state.pos;
    return;
  }
  if (ch === '-' || isDigit(ch)) {
    state.role = 'in-number';
    state.numberPhase = ch === '-' ? 'sign' : ch === '0' ? 'leadingZero' : 'intDigits';
    state.numberSafeEnd = ch === '-' ? undefined : state.pos;
    return;
  }
  if (ch === 't' || ch === 'f' || ch === 'n') {
    state.role = 'in-literal';
    state.literalKind = LITERALS[ch];
    state.literalMatched = 1;
    return;
  }
  fail(state, `unexpected character ${JSON.stringify(ch)} where a value was expected`);
}

function advanceString(state: ScannerState, ch: string, isKey: boolean): void {
  if (state.stringEscape === 'escaped') {
    if (ch === '"' || ch === '\\' || ch === '/') {
      if (isKey) state.keyText += ch;
      state.stringEscape = 'none';
      state.stringSafeEnd = state.pos;
    } else if (ch in SIMPLE_ESCAPES) {
      if (isKey) state.keyText += SIMPLE_ESCAPES[ch];
      state.stringEscape = 'none';
      state.stringSafeEnd = state.pos;
    } else if (ch === 'u') {
      state.stringEscape = 'u1';
      state.unicodeEscapeDigits = '';
    } else {
      fail(state, `invalid escape character ${JSON.stringify(ch)}`);
    }
    return;
  }
  if (
    state.stringEscape === 'u1' ||
    state.stringEscape === 'u2' ||
    state.stringEscape === 'u3' ||
    state.stringEscape === 'u4'
  ) {
    if (!isHexDigit(ch)) {
      fail(state, `invalid \\u escape digit ${JSON.stringify(ch)}`);
      return;
    }
    state.unicodeEscapeDigits += ch;
    if (state.stringEscape === 'u4') {
      if (isKey) state.keyText += String.fromCharCode(parseInt(state.unicodeEscapeDigits, 16));
      state.stringEscape = 'none';
      state.stringSafeEnd = state.pos;
    } else {
      state.stringEscape =
        state.stringEscape === 'u1' ? 'u2' : state.stringEscape === 'u2' ? 'u3' : 'u4';
    }
    return;
  }
  // stringEscape === 'none'
  if (ch === '"') {
    // `memberStart` deliberately stays put: a key with no colon/value yet is
    // still an incomplete member, so it still rolls back to before the key.
    // Duplicate-key detection happens once the colon is seen (below), once
    // `state.keyText` holds the fully decoded key.
    state.role = isKey ? 'object-after-key' : 'after-value';
    return;
  }
  if (ch === '\\') {
    state.stringEscape = 'escaped';
    return;
  }
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x20) {
    fail(state, 'unescaped control character in a JSON string');
    return;
  }
  if (isKey) state.keyText += ch;
  state.stringSafeEnd = state.pos;
}

function advanceNumber(state: ScannerState, ch: string): 'consumed' | 'redispatch' {
  switch (state.numberPhase) {
    case 'sign':
      if (ch === '0') {
        state.numberPhase = 'leadingZero';
        state.numberSafeEnd = state.pos;
      } else if (isDigit(ch)) {
        state.numberPhase = 'intDigits';
        state.numberSafeEnd = state.pos;
      } else {
        fail(state, `expected a digit after "-", got ${JSON.stringify(ch)}`);
      }
      return 'consumed';
    case 'leadingZero':
    case 'intDigits':
      if (isDigit(ch)) {
        if (state.numberPhase === 'leadingZero') {
          fail(state, 'a number may not have a leading zero followed by more digits');
          return 'consumed';
        }
        state.numberSafeEnd = state.pos;
        return 'consumed';
      }
      if (ch === '.') {
        state.numberPhase = 'pointSeen';
        return 'consumed';
      }
      if (ch === 'e' || ch === 'E') {
        state.numberPhase = 'expMarker';
        return 'consumed';
      }
      return 'redispatch';
    case 'pointSeen':
      if (isDigit(ch)) {
        state.numberPhase = 'fracDigits';
        state.numberSafeEnd = state.pos;
        return 'consumed';
      }
      fail(state, `expected a digit after "." in a number, got ${JSON.stringify(ch)}`);
      return 'consumed';
    case 'fracDigits':
      if (isDigit(ch)) {
        state.numberSafeEnd = state.pos;
        return 'consumed';
      }
      if (ch === 'e' || ch === 'E') {
        state.numberPhase = 'expMarker';
        return 'consumed';
      }
      return 'redispatch';
    case 'expMarker':
      if (ch === '+' || ch === '-') {
        state.numberPhase = 'expSign';
        return 'consumed';
      }
      if (isDigit(ch)) {
        state.numberPhase = 'expDigits';
        state.numberSafeEnd = state.pos;
        return 'consumed';
      }
      fail(state, `expected a digit or sign after "e" in a number, got ${JSON.stringify(ch)}`);
      return 'consumed';
    case 'expSign':
      if (isDigit(ch)) {
        state.numberPhase = 'expDigits';
        state.numberSafeEnd = state.pos;
        return 'consumed';
      }
      fail(state, `expected a digit after the exponent sign, got ${JSON.stringify(ch)}`);
      return 'consumed';
    case 'expDigits':
      if (isDigit(ch)) {
        state.numberSafeEnd = state.pos;
        return 'consumed';
      }
      return 'redispatch';
  }
}

/**
 * Dispatches a character consumed while waiting for a comma/closer
 * (`'after-value'`, or a frame's key/value-start position where an empty
 * close is legal). Shared by the "number/literal just finished" redispatch
 * and ordinary post-value scanning.
 */
function advanceWaiting(
  state: ScannerState,
  ch: string,
  depthLimit: number,
  duplicateKeyPolicy: DuplicateKeyPolicy,
): void {
  const frame = state.stack[state.stack.length - 1];

  if (state.role === 'after-value') {
    if (isWhitespace(ch)) return;
    if (frame === undefined) {
      // Root value already complete; further non-whitespace input is not a
      // truncation this package repairs. Freeze — the already-valid root
      // stays reported as complete.
      fail(state, 'unexpected trailing data after a complete JSON document');
      return;
    }
    if (ch === ',') {
      // `memberStart` must point at the comma itself (`state.pos - 1`, since
      // `state.pos` is already past it), not just after it — rolling back
      // to "after the comma" would leave the comma dangling in the output.
      state.memberStart = state.pos - 1;
      state.role = frame.kind === 'object' ? 'object-key-start' : 'array-value-start';
      return;
    }
    if (ch === CLOSER_FOR[frame.kind]) {
      popFrame(state);
      return;
    }
    fail(state, `expected "," or "${CLOSER_FOR[frame.kind]}", got ${JSON.stringify(ch)}`);
    return;
  }

  if (state.role === 'object-key-start') {
    if (isWhitespace(ch)) return;
    if (ch === '"') {
      state.role = 'in-key-string';
      state.stringEscape = 'none';
      state.stringSafeEnd = state.pos;
      state.keyText = '';
      return;
    }
    if (ch === '}' && frame?.count === 0) {
      popFrame(state);
      return;
    }
    fail(state, `expected an object key or "}", got ${JSON.stringify(ch)}`);
    return;
  }

  if (state.role === 'array-value-start') {
    if (isWhitespace(ch)) return;
    if (ch === ']' && frame?.count === 0) {
      popFrame(state);
      return;
    }
    beginValue(state, ch, depthLimit);
    return;
  }

  if (state.role === 'object-value-start' || state.role === 'root-value-start') {
    if (isWhitespace(ch)) return;
    beginValue(state, ch, depthLimit);
    return;
  }

  if (state.role === 'object-after-key') {
    if (isWhitespace(ch)) return;
    if (ch === ':') {
      state.role = 'object-value-start';
      if (frame?.kind === 'object' && frame.seenKeys !== undefined) {
        if (frame.seenKeys.has(state.keyText)) {
          if (duplicateKeyPolicy === 'error') {
            throw new JsonMendDuplicateKeyError(state.keyText);
          }
          if (duplicateKeyPolicy === 'first') {
            frame.suppressStart = state.memberStart;
          }
          // 'last' needs no bookkeeping: JSON.parse's native last-write-wins
          // semantics already do the right thing once this text is emitted.
        } else {
          frame.seenKeys.add(state.keyText);
        }
      }
      return;
    }
    fail(state, `expected ":", got ${JSON.stringify(ch)}`);
    return;
  }
}

/** Advances the scanner by exactly one character. `depthLimit` is `options.maxDepth`. */
export function advanceChar(
  state: ScannerState,
  ch: string,
  depthLimit: number,
  duplicateKeyPolicy: DuplicateKeyPolicy,
): void {
  state.pos += 1;

  switch (state.role) {
    case 'in-key-string':
      advanceString(state, ch, true);
      return;
    case 'in-value-string':
      advanceString(state, ch, false);
      return;
    case 'in-number': {
      const outcome = advanceNumber(state, ch);
      if (outcome === 'consumed') return;
      // The number is already finished; this character belongs to whatever
      // follows it (comma, closer, whitespace, or — if none of those — a
      // genuine syntax error). `state.pos` has already moved past this
      // lookahead character, so the number's own end is one before it.
      completeValue(state, state.pos - 1);
      advanceWaiting(state, ch, depthLimit, duplicateKeyPolicy);
      return;
    }
    case 'in-literal': {
      const kind = state.literalKind;
      if (kind === undefined) {
        fail(state, `unexpected character ${JSON.stringify(ch)}`);
        return;
      }
      if (kind[state.literalMatched] !== ch) {
        fail(state, `invalid literal, expected "${kind}"`);
        return;
      }
      state.literalMatched += 1;
      if (state.literalMatched === kind.length) {
        completeValue(state);
      }
      return;
    }
    default:
      advanceWaiting(state, ch, depthLimit, duplicateKeyPolicy);
  }
}
