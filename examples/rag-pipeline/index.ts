/**
 * Cross-package example: Markdown -> token-chunk -> a mock embedding
 * function -> vec-cache.
 *
 * A support site tends to reuse the same boilerplate sections ("Eligibility",
 * "Need help?") across many product pages. This ingests one page, then a
 * second, overlapping page, and shows the concrete win vec-cache exists for:
 * the sections shared verbatim between the two pages are served from the
 * cache on the second ingest, and only the genuinely new sections are sent
 * to the (simulated) embedding provider.
 *
 * Run with: pnpm --filter example-rag-pipeline run start
 *
 * No network calls: `simulateProviderEmbed` below stands in for a real
 * provider's batch embeddings endpoint.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkMarkdown } from 'token-chunk';
import { VectorCache } from 'vec-cache';
import type { EmbedBatchRequest, EmbeddingVector } from 'vec-cache';

const EMBEDDING_MODEL = 'text-embedding-3-small';

// A small "content library" a documentation site might maintain: two
// product-specific intro sections, a product-B-only shipping section, and
// two boilerplate sections reused verbatim across every product page.
const introA = `# Product A policies

Product A ships with a 90-day limited hardware warranty covering
manufacturing defects that appear during normal use, not accidental damage.`;

const introB = `# Product B policies

Product B is a monthly subscription. Cancelling stops future charges but
does not refund the days already used in the current billing period.`;

const eligibility = `## Eligibility

Refunds are available within 30 days of purchase for unused items in their
original packaging. Digital products are refundable within 14 days unless
they have already been downloaded.`;

const needHelp = `## Need help?

Contact support at support@example.com or use the in-app chat. We respond
within one business day, Monday through Friday.`;

const shipping = `## Shipping

Physical accessories for Product B ship within two business days via
standard carrier and typically arrive within a week domestically.`;

/**
 * Chunks each section independently (a realistic shape for a CMS that
 * already segments a page into sections) and returns the chunk text for
 * every section, in order. Each section fits comfortably under the budget,
 * so this produces exactly one chunk per section here — the point being
 * demonstrated is cache reuse, not chunk splitting.
 */
function chunkPage(sections: readonly string[]): string[] {
  return sections.flatMap((section) =>
    chunkMarkdown(section, { maxTokens: 300, overlapTokens: 0 }).map((c) => c.text),
  );
}

/**
 * Stands in for a real provider call (e.g. OpenAI's `embeddings.create`).
 * Deterministic and offline so the example runs without an API key.
 */
async function simulateProviderEmbed(request: EmbedBatchRequest): Promise<EmbeddingVector[]> {
  console.log(`    -> embedding provider called for ${String(request.texts.length)} text(s)`);
  return request.texts.map((text) => {
    const vector = new Float32Array(8);
    for (let i = 0; i < vector.length; i += 1) {
      vector[i] = ((text.length + i) % 23) / 23;
    }
    return vector;
  });
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'llm-kit-rag-pipeline-'));

  // A fixed, injected clock (`VectorCacheOptions.now`, the same precedent as
  // `llm-backoff`'s `now`) — not `Date.now()` — so `stats()`'s
  // `oldestEntryMs`/`newestEntryMs` are reproducible on every run. Advanced
  // by hand between ingests to show page B being ingested a minute later.
  let simulatedNowMs = 1_700_000_000_000;
  const cache = new VectorCache({ path: join(dir, 'cache.sqlite'), now: () => simulatedNowMs });

  try {
    console.log('=== Ingesting "Product A policies" ===\n');
    const pageA = chunkPage([introA, eligibility, needHelp]);
    console.log(`  chunked into ${String(pageA.length)} chunk(s)`);
    const resultA = await cache.getOrCreate(pageA, {
      model: EMBEDDING_MODEL,
      embed: simulateProviderEmbed,
    });
    console.log(
      `  cache hits: ${String(resultA.report.hitCount)} / ${String(resultA.report.totalCount)}` +
        ` — first time seeing this content, so everything is a fresh embedding.\n`,
    );

    simulatedNowMs += 60_000; // page B is ingested a minute later
    console.log('=== Ingesting "Product B policies" (shares two sections with A) ===\n');
    const pageB = chunkPage([introB, eligibility, shipping, needHelp]);
    console.log(`  chunked into ${String(pageB.length)} chunk(s)`);

    const sharedWithA = pageB.filter((chunk) => pageA.includes(chunk));
    console.log(
      `  ${String(sharedWithA.length)} chunk(s) are byte-for-byte identical to chunks already ` +
        `cached from page A ("Eligibility" and "Need help?").`,
    );

    const resultB = await cache.getOrCreate(pageB, {
      model: EMBEDDING_MODEL,
      embed: simulateProviderEmbed,
    });

    console.log('\n  --- vec-cache report for page B ---');
    console.log(`  total chunks:   ${String(resultB.report.totalCount)}`);
    console.log(`  cache hits:     ${String(resultB.report.hitCount)} (reused from page A)`);
    console.log(`  cache misses:   ${String(resultB.report.missCount)} (genuinely new sections)`);
    console.log(
      `  embed calls:    ${String(resultB.report.embedCallCount)} ` +
        `(one call, covering only the ${String(resultB.report.missCount)} miss(es))`,
    );

    console.log('\n=== Summary ===');
    const totalChunks = resultA.report.totalCount + resultB.report.totalCount;
    const totalEmbedded = resultA.report.missCount + resultB.report.missCount;
    console.log(
      `${String(totalChunks)} chunks ingested across both pages; only ${String(totalEmbedded)} ` +
        `unique texts were ever sent to the embedding provider — the rest came from vec-cache.`,
    );

    // `oldestEntryMs`/`newestEntryMs` come from the injected clock above, not
    // `Date.now()`, so they're reproducible here too — 60,000ms apart,
    // matching how far we advanced `simulatedNowMs` between the two ingests.
    console.log('\nFinal cache stats:', cache.stats());
  } finally {
    cache.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
