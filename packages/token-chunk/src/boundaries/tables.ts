/**
 * Markdown table separator-row detection, shared by the block parser (which
 * needs to recognize one when deciding whether the previous line starts a
 * table) and `chunkText`'s format sniffer (which needs to know whether *any*
 * line in a document looks like one).
 *
 * A regex-based version of this check put a star-quantified whitespace
 * class on each side of an optional `|` (`\s*\|?\s*`); on a line with a
 * long whitespace run and no closing `|`/`$` to anchor against, the engine
 * has an exponential number of ways to split that run between the two
 * `\s*` groups before it can conclude the whole thing fails — quadratic-plus
 * on pathological input (reproduces on `' '.repeat(n) + '--\nsome body\n'`).
 *
 * Splitting the line on the literal `|` and validating each resulting cell
 * independently is provably linear: no character is ever re-examined by a
 * different split of the same quantifier.
 */
const SEPARATOR_CELL = /^:?-{2,}:?$/;

/**
 * Whether `line` (a single line — must not contain `\n`) is a Markdown
 * table separator row: an optional leading and/or trailing `|`, one or
 * more `-`-cells (each optionally colon-bounded, at least two dashes)
 * separated by `|`, with arbitrary whitespace allowed around every token.
 *
 * `minCells` distinguishes the two original regexes' behavior: the block
 * parser accepts a single bare cell with no `|` at all (a one-column
 * table's separator row, `minCells: 1`), while the format sniffer only
 * wants to fire on an unambiguous multi-column separator (`minCells: 2`,
 * i.e. requires at least one `|`).
 */
export function isTableSeparatorLine(line: string, minCells: number): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;

  let body = trimmed;
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|')) body = body.slice(0, -1);
  if (body.length === 0) return false;

  const cells = body.split('|');
  if (cells.length < minCells) return false;
  return cells.every((cell) => SEPARATOR_CELL.test(cell.trim()));
}
