/**
 * Public export-surface helpers.
 *
 * Each public package snapshots its export names so an accidental addition or
 * removal shows up as a reviewable diff rather than a silent API change.
 */

export function exportNames(moduleNamespace: object): string[] {
  return Object.keys(moduleNamespace)
    .filter((name) => name !== 'default')
    .sort();
}

export interface ErrorShapeExpectation {
  /** Expected `name` property, e.g. `ChatFitError`. */
  readonly name: string;
  /** Expected stable `code`, e.g. `PRESERVED_MESSAGES_EXCEED_BUDGET`. */
  readonly code: string;
}

/**
 * Asserts the repository-wide error convention: every package error extends
 * `Error`, exposes a stable string `code`, and has a non-empty message.
 */
export function assertErrorShape(error: unknown, expected: ErrorShapeExpectation): void {
  if (!(error instanceof Error)) {
    throw new Error(`Expected an Error instance, received ${typeof error}`);
  }
  const code = (error as { code?: unknown }).code;
  if (error.name !== expected.name) {
    throw new Error(`Expected error name ${expected.name}, received ${error.name}`);
  }
  if (code !== expected.code) {
    throw new Error(`Expected error code ${expected.code}, received ${String(code)}`);
  }
  if (typeof error.message !== 'string' || error.message.length === 0) {
    throw new Error(`Error ${expected.name} must carry a non-empty message`);
  }
}

/** Asserts that a diagnostic/report object survives a JSON round trip (section 19). */
export function assertJsonSerializable(value: unknown, label = 'value'): void {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(`${label} is not JSON-serializable`);
  }
  JSON.parse(serialized);
}
