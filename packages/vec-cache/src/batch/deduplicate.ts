/** Returns the input's distinct values, keeping only the first occurrence of each, in original order. */
export function dedupeInOrder<T>(items: readonly T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
