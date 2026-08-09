import { createSeededRandom } from '@llm-kit/test-utils';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fitChat } from '../src/fit-chat.js';
import { ChatFitError } from '../src/errors.js';
import {
  assertChronologicalOrder,
  assertGroupsAtomic,
  buildRandomToolConversation,
} from './fixtures/random-conversation.js';

// Fixed seed: a failing run reproduces exactly by re-running with this seed.
// fast-check also prints its own seed in the failure output when `numRuns`
// triggers a shrink.
const PROPERTY_SEED = 20260805;

describe('atomicity property: tool-call groups are never split', () => {
  it(`holds across randomly generated conversations and budgets (seed ${String(PROPERTY_SEED)})`, () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.integer({ min: 2, max: 60 }),
        fc.integer({ min: 0, max: 4000 }),
        (conversationSeed, turnCount, maxTokens) => {
          const random = createSeededRandom(conversationSeed);
          const { messages, groups } = buildRandomToolConversation(random, turnCount);

          let kept: readonly (typeof messages)[number][];
          try {
            const result = fitChat(messages, { maxTokens, strategy: 'drop-oldest' });
            kept = result.messages;
          } catch (error) {
            // A budget too small even for preserved content is a documented,
            // expected outcome, not a property violation. There are no
            // preserved (system/developer) messages in this generator, so
            // this can only fire when maxTokens itself is non-positive.
            expect(error).toBeInstanceOf(ChatFitError);
            expect((error as ChatFitError).code).toBe('PRESERVED_MESSAGES_EXCEED_BUDGET');
            return;
          }

          assertGroupsAtomic(groups, kept);
          assertChronologicalOrder(messages, kept);
        },
      ),
      { seed: PROPERTY_SEED, numRuns: 300 },
    );
  });

  it('holds under fitChatAsync drop-oldest too', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.integer({ min: 2, max: 40 }),
        fc.integer({ min: 0, max: 3000 }),
        async (conversationSeed, turnCount, maxTokens) => {
          const { fitChatAsync } = await import('../src/fit-chat-async.js');
          const random = createSeededRandom(conversationSeed);
          const { messages, groups } = buildRandomToolConversation(random, turnCount);

          let kept: readonly (typeof messages)[number][];
          try {
            const result = await fitChatAsync(messages, { maxTokens, strategy: 'drop-oldest' });
            kept = result.messages;
          } catch (error) {
            expect(error).toBeInstanceOf(ChatFitError);
            return;
          }

          assertGroupsAtomic(groups, kept);
          assertChronologicalOrder(messages, kept);
        },
      ),
      { seed: PROPERTY_SEED + 1, numRuns: 100 },
    );
  });
});
