/**
 * Runnable example: preparing a Markdown support article for a vector
 * index. Run with `pnpm exec tsx examples/rag-ingestion.ts` from this
 * package's directory.
 *
 * Shows the primary use case: chunk a Markdown document under an
 * embedding model's token budget, keep a
 * breadcrumb of which section each chunk came from, and carry a small
 * amount of overlap so a chunk boundary doesn't strand a sentence's context
 * in the previous chunk.
 */
import { chunkMarkdown } from '../src/index.js';

const supportArticle = `# Refund policy

We want you to be happy with your purchase. This article covers when a
refund applies and how long it takes.

## Eligibility

Refunds are available within 30 days of purchase for unused items in their
original packaging. Digital products are refundable within 14 days unless
they have already been downloaded. Sale items marked "final sale" are not
eligible for a refund under any circumstances.

## Processing time

Once we receive your returned item, refunds are issued within 5-7 business
days to your original payment method. Store credit refunds are instant.
Items damaged in shipping are replaced free of charge and do not require a
return.

## How to start a return

Sign in to your account, open the order you want to return, and select
"Start a return." Print the prepaid shipping label we email you and drop
the package off at any carrier location. You'll get a confirmation email
once we've received and processed your return.
`;

// A typical small-embedding-model budget, with a little overlap so a chunk
// boundary that lands mid-explanation doesn't lose its lead-in sentence.
const chunks = chunkMarkdown(supportArticle, {
  maxTokens: 60,
  overlapTokens: 10,
});

for (const chunk of chunks) {
  const breadcrumb = chunk.headings.map((h) => h.text).join(' > ') || '(no heading)';
  console.log(
    `--- chunk ${String(chunk.index)} — ${String(chunk.tokenCount)} tokens — ${breadcrumb} ---`,
  );
  if (chunk.overlap.tokensFromPrevious > 0) {
    console.log(
      `  (repeats ${String(chunk.overlap.tokensFromPrevious)} tokens from the previous chunk)`,
    );
  }
  console.log(chunk.text.trim());
  console.log();
}

console.log(
  `${String(chunks.length)} chunks, every one <= 60 tokens: ${String(chunks.every((c) => c.tokenCount <= 60))}`,
);

// Every chunk's source range reconstructs its own text exactly (no rendered
// heading prefix was requested here, so this holds with no adjustment).
const allReconstruct = chunks.every(
  (chunk) => supportArticle.slice(chunk.source.charStart, chunk.source.charEnd) === chunk.text,
);
console.log(
  `Every chunk's source range reconstructs chunk.text exactly: ${String(allReconstruct)}`,
);
