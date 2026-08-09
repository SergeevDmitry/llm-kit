import { ChatFitError } from '../errors.js';

/** A summarizer must return an actual message, not `null`/`undefined` — nothing else about `Message`'s shape is knowable here. */
export function assertValidSummaryMessage<Message>(
  value: Message,
  attempt: number,
): asserts value is NonNullable<Message> {
  if (value === null || value === undefined) {
    throw new ChatFitError(
      `summarizer returned ${String(value)} on attempt ${String(attempt)}; a summary message is required`,
      'SUMMARY_FAILED',
    );
  }
}
