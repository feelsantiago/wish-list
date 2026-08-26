import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Extraction, Url, Vendor } from '@wish-list/domain';
import { ExtractionRepository, VendorRepository } from '@wish-list/database';
import type { DatabaseFailure } from '@wish-list/database';
import {
  createTestDatabase,
  databaseTestingProviders,
} from '@wish-list/database/testing';
import type { TestDatabase } from '@wish-list/database/testing';
import type { z } from 'zod';
import { AsyncResult, err, ok } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { PAGE_FETCHER } from './fetcher/page-fetcher.js';
import type { PageFetcher } from './fetcher/page-fetcher.js';
import { LLM } from './llm/llm.js';
import type { Llm } from './llm/llm.js';
import { LlmProductReader } from './llm/llm-product-reader.js';
import { PageProductReader } from './reading/page-product-reader.js';
import { StructuredParsers } from './structured/structured-parsers.js';
import { JsonLdStructuredParser } from './structured/json-ld.structured-parser.js';
import { OpenGraphStructuredParser } from './structured/opengraph.structured-parser.js';
import { VendorResolver } from './vendor/vendor-resolver.js';
import { MODULE_OPTIONS_TOKEN } from './extraction.options.js';
import type { ExtractionModuleOptions } from './extraction.options.js';
import { Extractor } from './extractor.js';

const OPTIONS: ExtractionModuleOptions = {
  markdownCap: 40_000,
  budget: 200,
  llm: { apiKey: 'test-key', model: 'test-model' },
};

const JSON_LD_COMPLETE = `<html><head><script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Trail Runner 3",
    "image": "https://cdn.acme.example/trail-runner-3.jpg",
    "brand": { "@type": "Brand", "name": "Acme Outfitters" },
    "offers": { "@type": "Offer", "price": "129.99", "priceCurrency": "USD" }
  }
</script></head><body></body></html>`;

const NOOP_LLM: Llm = {
  generate: <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
    AsyncResult.fromResult(ok(schema.parse({}))),
};

function fetcherReturning(html: string): PageFetcher {
  return { fetch: () => AsyncResult.fromResult(ok(html)) };
}

function fetcherFailingWith(
  failure: Failure<'fetch-failed' | 'blocked' | 'timeout'>,
): PageFetcher {
  return { fetch: () => AsyncResult.fromResult(err(failure)) };
}

function fetcherDelayedBy(ms: number, html: string): PageFetcher {
  return {
    fetch: () =>
      new AsyncResult(
        new Promise((resolve) => {
          setTimeout(() => resolve(ok(html)), ms);
        }),
      ),
  };
}

describe('Extractor', () => {
  let testDb: TestDatabase;
  let moduleRef: TestingModule;
  let extractionRepository: ExtractionRepository;
  let vendorRepository: VendorRepository;

  async function buildExtractor(
    fetcher: PageFetcher,
    options: {
      readonly llm?: Llm;
      readonly extractionsOverride?: Pick<ExtractionRepository, 'insert'>;
    } = {},
  ): Promise<Extractor> {
    const builder = Test.createTestingModule({
      providers: [
        ...databaseTestingProviders(testDb.db),
        { provide: MODULE_OPTIONS_TOKEN, useValue: OPTIONS },
        { provide: PAGE_FETCHER, useValue: fetcher },
        { provide: LLM, useValue: options.llm ?? NOOP_LLM },
        {
          provide: StructuredParsers,
          useFactory: () =>
            new StructuredParsers([
              new JsonLdStructuredParser(),
              new OpenGraphStructuredParser(),
            ]),
        },
        LlmProductReader,
        PageProductReader,
        VendorResolver,
        Extractor,
      ],
    });

    if (options.extractionsOverride) {
      builder
        .overrideProvider(ExtractionRepository)
        .useValue(options.extractionsOverride);
    }

    moduleRef = await builder.compile();
    extractionRepository = moduleRef.get(ExtractionRepository);
    vendorRepository = moduleRef.get(VendorRepository);

    return moduleRef.get(Extractor);
  }

  beforeEach(async () => {
    testDb = await createTestDatabase();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await testDb.close();
  });

  it('writes one succeeded row and a resolved Vendor', async () => {
    const url = Url.from('https://acme.example/p/trail-runner-3');
    const extractor = await buildExtractor(fetcherReturning(JSON_LD_COMPLETE));

    const extraction = await extractor
      .refresh(url)
      .unwrapOr(undefined as never);

    expect(Extraction.isSucceeded(extraction)).toBe(true);

    const persisted = await extractionRepository
      .find(extraction.id)
      .unwrapOr(undefined as never);
    expect(persisted).toEqual(extraction);

    const vendor = await vendorRepository
      .find(extraction.vendor)
      .unwrapOr(undefined as never);
    expect(Vendor.isResolved(vendor)).toBe(true);
  });

  it('writes one failed row with reason "blocked" and leaves the Vendor provisional', async () => {
    const url = Url.from('https://blocked-vendor.example.com/p/1');
    const blocked = Failure.create('blocked', 'Blocked by captcha challenge');
    const extractor = await buildExtractor(fetcherFailingWith(blocked));

    const extraction = await extractor
      .refresh(url)
      .unwrapOr(undefined as never);

    expect(Extraction.isFailed(extraction)).toBe(true);
    if (Extraction.isFailed(extraction)) {
      expect(extraction.reason).toBe('blocked');
    }

    const vendor = await vendorRepository
      .find(extraction.vendor)
      .unwrapOr(undefined as never);
    expect(Vendor.isProvisional(vendor)).toBe(true);
  });

  it('writes two rows for two refreshes of one URL (append-only)', async () => {
    const url = Url.from('https://repeat-vendor.example.com/p/1');
    const extractor = await buildExtractor(fetcherReturning(JSON_LD_COMPLETE));

    const first = await extractor.refresh(url).unwrapOr(undefined as never);
    const second = await extractor.refresh(url).unwrapOr(undefined as never);

    expect(first.id).not.toEqual(second.id);
    expect(first.key).toEqual(second.key);
  });

  it('records "timeout" when the reader outruns the budget', async () => {
    vi.useFakeTimers();

    const url = Url.from('https://slow-vendor.example.com/p/1');
    const extractor = await buildExtractor(
      fetcherDelayedBy(OPTIONS.budget + 100, JSON_LD_COMPLETE),
    );

    const pending = extractor.refresh(url).toPromise();
    await vi.advanceTimersByTimeAsync(OPTIONS.budget + 150);
    const result = await pending;

    const extraction = result.unwrapOr(undefined as never);
    expect(Extraction.isFailed(extraction)).toBe(true);
    if (Extraction.isFailed(extraction)) {
      expect(extraction.reason).toBe('timeout');
    }
  });

  it('surfaces a repository insert failure as "persist-failed"', async () => {
    const url = Url.from('https://acme.example/p/trail-runner-3');
    const failing: Pick<ExtractionRepository, 'insert'> = {
      insert: () =>
        AsyncResult.fromResult(
          err(Failure.create('query', 'insert failed') as DatabaseFailure),
        ),
    };
    const extractor = await buildExtractor(fetcherReturning(JSON_LD_COMPLETE), {
      extractionsOverride: failing,
    });

    const failure = await extractor
      .refresh(url)
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('persist-failed');
  });
});
