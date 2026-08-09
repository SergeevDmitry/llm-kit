/**
 * Links tool calls to their tool results by id, using a union-find over
 * message indexes so the result is correct regardless of how the messages
 * are ordered or interleaved. A tool call and every result it spawned move
 * together or not at all.
 *
 * A message is unioned with every other message it is linked to by a shared
 * tool-call id — an assistant message with its call, every message
 * resolving that call (there can be more than one, and a single message can
 * resolve calls from more than one assistant turn, e.g. one Anthropic-style
 * message batching several `tool_result` blocks). Connected components are
 * therefore the atomic groups: no possible ordering of tool-call and
 * tool-result messages can split a component in two, because they were
 * never assumed adjacent in the first place — only linked by id.
 *
 * When an id cannot be found at all (missing on the call, or a
 * result message that structurally announces itself as a tool result but
 * carries no id), the conservative fallback applies: pair by adjacency with
 * the nearest preceding still-open call from the *same* assistant message
 * only, never reaching further back. Every such decision is recorded as a
 * `GroupingDiagnostic` rather than applied silently.
 */
import type { MessageStructure } from '../adapters/structure.js';
import type { GroupingDiagnostic } from './validation.js';

export interface LinkedGroups {
  /** For each message index, the representative index of its connected component. */
  readonly representativeOf: readonly number[];
  /** Tool-call ids attributed to each representative index (only representatives with at least one id are present). */
  readonly toolCallIdsByRepresentative: ReadonlyMap<number, readonly string[]>;
  readonly diagnostics: readonly GroupingDiagnostic[];
}

function createUnionFind(size: number): {
  find: (x: number) => number;
  union: (a: number, b: number) => void;
} {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) {
      root = parent[root] as number;
    }
    let cursor = x;
    while (parent[cursor] !== root) {
      const next = parent[cursor] as number;
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootA] = rootB;
    }
  };
  return { find, union };
}

export function linkToolCallGroups(structures: readonly MessageStructure[]): LinkedGroups {
  const n = structures.length;
  const { find, union } = createUnionFind(n);
  const diagnostics: GroupingDiagnostic[] = [];

  // Pass 1: register call owners. First occurrence of an id wins; a
  // duplicate is unioned in anyway (conservative: never let an ambiguous id
  // silently pick the wrong owner for a later result).
  const callOwner = new Map<string, number>();
  const idsOwnedBy = new Map<number, string[]>();
  structures.forEach((structure, index) => {
    structure.toolCalls.forEach((call, position) => {
      const id = call.id ?? `__unindexed_${String(index)}_${String(position)}`;
      if (call.id === undefined) {
        diagnostics.push({ type: 'missing-tool-call-id', messageIndex: index, syntheticId: id });
      }
      const existingOwner = callOwner.get(id);
      if (existingOwner === undefined) {
        callOwner.set(id, index);
        const owned = idsOwnedBy.get(index) ?? [];
        owned.push(id);
        idsOwnedBy.set(index, owned);
      } else if (existingOwner !== index) {
        diagnostics.push({
          type: 'duplicate-tool-call-id',
          id,
          firstOwnerIndex: existingOwner,
          duplicateOwnerIndex: index,
        });
        union(index, existingOwner);
      }
    });
  });

  // Pass 2: resolve results that carry a real id.
  const resolvedIds = new Set<string>();
  structures.forEach((structure, index) => {
    structure.toolResultIds.forEach((toolCallId) => {
      const owner = callOwner.get(toolCallId);
      if (owner === undefined) {
        diagnostics.push({ type: 'unresolved-tool-result', messageIndex: index, toolCallId });
        return;
      }
      resolvedIds.add(toolCallId);
      union(index, owner);
    });
  });

  // Pass 3: conservative adjacency fallback for tool-result messages with no
  // id at all. Only ever consumes still-open ids from the *nearest*
  // preceding assistant message — never an older one.
  const pendingByAssistant = new Map<number, string[]>();
  idsOwnedBy.forEach((ids, index) => {
    const pending = ids.filter((id) => !resolvedIds.has(id));
    if (pending.length > 0) {
      pendingByAssistant.set(index, pending);
    }
  });

  let currentAssistant: number | undefined;
  let currentPending: string[] = [];
  const adjacencyConsumedIds = new Set<string>();

  structures.forEach((structure, index) => {
    if (structure.toolCalls.length > 0) {
      currentAssistant = index;
      currentPending = [...(pendingByAssistant.get(index) ?? [])];
    }
    if (structure.looksLikeUnlinkedToolResult) {
      if (currentAssistant !== undefined && currentPending.length > 0) {
        const consumedId = currentPending.shift() as string;
        adjacencyConsumedIds.add(consumedId);
        diagnostics.push({
          type: 'adjacency-fallback',
          messageIndex: index,
          assistantIndex: currentAssistant,
        });
        union(index, currentAssistant);
      } else {
        diagnostics.push({ type: 'orphan-tool-result', messageIndex: index });
      }
    }
  });

  // Every id that never found a real or adjacency-matched result is a
  // dangling call: reported, but the group stays exactly what it already is
  // (the assistant message alone, or unioned with whatever it was unioned
  // with above) — there is nothing to split.
  callOwner.forEach((ownerIndex, id) => {
    if (!resolvedIds.has(id) && !adjacencyConsumedIds.has(id)) {
      diagnostics.push({ type: 'unresolved-tool-call', messageIndex: ownerIndex, toolCallId: id });
    }
  });

  const representativeOf = structures.map((_, index) => find(index));

  const toolCallIdsByRepresentative = new Map<number, readonly string[]>();
  idsOwnedBy.forEach((ids, ownerIndex) => {
    const representative = find(ownerIndex);
    const existing = toolCallIdsByRepresentative.get(representative) ?? [];
    toolCallIdsByRepresentative.set(representative, [...existing, ...ids]);
  });

  return { representativeOf, toolCallIdsByRepresentative, diagnostics };
}
