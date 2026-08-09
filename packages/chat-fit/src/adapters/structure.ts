/** Shared shapes for structural (provider-adapter) message recognition. Internal only. */

/**
 * A recognized tool call reference: an id (when present), an optional
 * display name, and its raw arguments/input payload (when the shape
 * provided one) — `id`/`name` drive grouping and reporting, `arguments`
 * exists purely so token accounting can count the payload without a second,
 * parallel structural reader.
 */
export interface ToolCallRef {
  readonly id?: string;
  readonly name?: string;
  readonly arguments?: unknown;
}

/**
 * Everything the grouping algorithm and the default token counter need to
 * know about one message, regardless of which provider shape it arrived in.
 */
export interface MessageStructure {
  /** `message.role`, when the message has a string one. */
  readonly role: string | undefined;
  /** `message.name`, when the message has a string one (participant identity beyond role). */
  readonly name: string | undefined;
  /** Tool calls this message makes (assistant turn), deduplicated by identity, in order of appearance. */
  readonly toolCalls: readonly ToolCallRef[];
  /** Tool-call ids this message resolves (a tool-result turn). */
  readonly toolResultIds: readonly string[];
  /**
   * True when the message structurally announces itself as a tool result
   * (`role: 'tool'`) but no adapter could recover an id linking it to a
   * call — the conservative-adjacency-grouping case.
   */
  readonly looksLikeUnlinkedToolResult: boolean;
}
