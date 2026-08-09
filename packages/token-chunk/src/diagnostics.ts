import type { ChunkDiagnostic, ChunkDiagnosticCode } from './types.js';

export function diagnostic(
  code: ChunkDiagnosticCode,
  message: string,
  range?: { readonly charStart: number; readonly charEnd: number },
): ChunkDiagnostic {
  return range === undefined
    ? { code, message }
    : { code, message, charStart: range.charStart, charEnd: range.charEnd };
}
