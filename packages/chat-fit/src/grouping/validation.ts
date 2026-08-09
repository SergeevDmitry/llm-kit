/**
 * Diagnostics produced while linking tool calls to their results. Missing or
 * contradictory ids produce diagnostics and conservative adjacency
 * grouping — never a silently broken exchange. Kept as structured data
 * first, rendered to strings only for the report, so tests can assert on
 * the specific condition rather than message text.
 */

export type GroupingDiagnostic =
  | {
      readonly type: 'missing-tool-call-id';
      readonly messageIndex: number;
      readonly syntheticId: string;
    }
  | {
      readonly type: 'duplicate-tool-call-id';
      readonly id: string;
      readonly firstOwnerIndex: number;
      readonly duplicateOwnerIndex: number;
    }
  | {
      readonly type: 'unresolved-tool-result';
      readonly messageIndex: number;
      readonly toolCallId: string;
    }
  | {
      readonly type: 'unresolved-tool-call';
      readonly messageIndex: number;
      readonly toolCallId: string;
    }
  | {
      readonly type: 'adjacency-fallback';
      readonly messageIndex: number;
      readonly assistantIndex: number;
    }
  | { readonly type: 'orphan-tool-result'; readonly messageIndex: number };

export function describeDiagnostic(diagnostic: GroupingDiagnostic): string {
  switch (diagnostic.type) {
    case 'missing-tool-call-id':
      return (
        `message ${String(diagnostic.messageIndex)} makes a tool call with no id; ` +
        `assigned a synthetic id ("${diagnostic.syntheticId}") and grouped conservatively`
      );
    case 'duplicate-tool-call-id':
      return (
        `duplicate tool call id "${diagnostic.id}": declared by both message ${String(diagnostic.firstOwnerIndex)} ` +
        `and message ${String(diagnostic.duplicateOwnerIndex)}; grouped together conservatively`
      );
    case 'unresolved-tool-result':
      return (
        `message ${String(diagnostic.messageIndex)} resolves tool call id "${diagnostic.toolCallId}", ` +
        `which no message declares; kept as its own group`
      );
    case 'unresolved-tool-call':
      return (
        `tool call id "${diagnostic.toolCallId}" from message ${String(diagnostic.messageIndex)} ` +
        `has no matching tool result`
      );
    case 'adjacency-fallback':
      return (
        `message ${String(diagnostic.messageIndex)} is a tool result with no id; ` +
        `grouped by adjacency with the open tool call in message ${String(diagnostic.assistantIndex)}`
      );
    case 'orphan-tool-result':
      return (
        `message ${String(diagnostic.messageIndex)} is a tool result with no id and no open ` +
        `preceding tool call; kept as its own group`
      );
  }
}
