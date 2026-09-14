import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { Extraction, Id, Url, Vendor } from '@wish-list/domain';
import type { ExtractionReason } from '@wish-list/domain';
import { ExtractionRepository, VendorRepository } from '@wish-list/database';
import type { DatabaseFailure } from '@wish-list/database';
import {
  createTestDatabase,
  databaseTestingProviders,
} from '@wish-list/database/testing';
import type { TestDatabase } from '@wish-list/database/testing';
import type { z } from 'zod';
import { AsyncResult, Option, err, ok } from '@wish-list/common-result';
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
  freshness: 24 * 60 * 60 * 1000,
  failureWindow: 5 * 60 * 1000,
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

function fetcherCounting(html: string): PageFetcher & { calls: number } {
  const fetcher = {
    calls: 0,
    fetch: () => {
      fetcher.calls += 1;
      return AsyncResult.fromResult(ok(html));
    },
  };
  return fetcher;
}

function fixtureExtraction(base: Extraction, createdAt: Date): Extraction {
  return { ...base, createdAt };
}

function succeededFixture(url: Url, createdAt: Date): Extraction {
  return fixtureExtraction(
    Extraction.succeeded({
      url,
      vendor: Id.generate(),
      source: 'json-ld',
      data: {
        name: 'Trail Runner 3',
        price: { amount: 129.99, currency: 'USD' },
        image: Url.from('https://cdn.acme.example/trail-runner-3.jpg'),
      },
      vendorData: {
        name: 'Acme Outfitters',
        website: Url.from('https://acme.example'),
        currency: 'USD',
      },
    }),
    createdAt,
  );
}

function failedFixture(
  url: Url,
  createdAt: Date,
  reason: ExtractionReason = 'blocked',
): Extraction {
  return fixtureExtraction(
    Extraction.failed({ url, vendor: Id.generate(), reason }),
    createdAt,
  );
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
      readonly extractionsOverride?: Pick<
        ExtractionRepository,
        'insert' | 'findLatestByKey'
      >;
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
      .map((found) => found.unwrapOr(undefined as never))
      .unwrapOr(undefined as never);
    expect(persisted).toEqual(extraction);

    const vendor = await vendorRepository
      .find(extraction.vendor)
      .map((found) => found.unwrapOr(undefined as never))
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
      .map((found) => found.unwrapOr(undefined as never))
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
    const failing: Pick<ExtractionRepository, 'insert' | 'findLatestByKey'> = {
      insert: () =>
        AsyncResult.fromResult(
          err(Failure.create('query', 'insert failed') as DatabaseFailure),
        ),
      findLatestByKey: () => AsyncResult.fromResult(ok(Option.none())),
    };
    const extractor = await buildExtractor(fetcherReturning(JSON_LD_COMPLETE), {
      extractionsOverride: failing,
    });

    const failure = await extractor
      .refresh(url)
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('persist-failed');
  });

  describe('extract', () => {
    const NOW = new Date('2024-01-01T00:00:00.000Z');
    const url = Url.from('https://acme.example/p/trail-runner-3');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    function minutesAgo(minutes: number): Date {
      return new Date(NOW.getTime() - minutes * 60 * 1000);
    }

    async function buildWithLookup(
      lookup: () => ReturnType<ExtractionRepository['findLatestByKey']>,
    ): Promise<{
      extractor: Extractor;
      fetcher: PageFetcher & { calls: number };
      insert: ReturnType<typeof vi.fn>;
    }> {
      const fetcher = fetcherCounting(JSON_LD_COMPLETE);
      const insert = vi.fn((extraction: Extraction) =>
        AsyncResult.fromResult(ok(extraction)),
      );
      const extractor = await buildExtractor(fetcher, {
        extractionsOverride: { insert, findLatestByKey: lookup },
      });

      return { extractor, fetcher, insert };
    }

    function buildWithLatest(latest: Extraction) {
      return buildWithLookup(() =>
        AsyncResult.fromResult(ok(Option.some(latest))),
      );
    }

    function buildWithLookupFailure(failure: DatabaseFailure) {
      return buildWithLookup(() => AsyncResult.fromResult(err(failure)));
    }

    it('reuses a fresh succeeded record without calling refresh', async () => {
      const fixture = succeededFixture(url, minutesAgo(60));
      const { extractor, fetcher, insert } = await buildWithLatest(fixture);

      const extraction = await extractor
        .extract(url)
        .unwrapOr(undefined as never);

      expect(extraction.id).toBe(fixture.id);
      expect(fetcher.calls).toBe(0);
      expect(insert).not.toHaveBeenCalled();
    });

    it('refreshes a stale succeeded record', async () => {
      const fixture = succeededFixture(url, minutesAgo(25 * 60));
      const { extractor, fetcher } = await buildWithLatest(fixture);

      const extraction = await extractor
        .extract(url)
        .unwrapOr(undefined as never);

      expect(extraction.id).not.toBe(fixture.id);
      expect(fetcher.calls).toBe(1);
    });

    it('reuses an "unsupported-currency" failure regardless of age', async () => {
      const fixture = failedFixture(
        url,
        minutesAgo(1000 * 60),
        'unsupported-currency',
      );
      const { extractor, fetcher } = await buildWithLatest(fixture);

      const extraction = await extractor
        .extract(url)
        .unwrapOr(undefined as never);

      expect(extraction.id).toBe(fixture.id);
      expect(fetcher.calls).toBe(0);
    });

    it('reuses a fresh failed record (other reason)', async () => {
      const fixture = failedFixture(url, minutesAgo(1), 'blocked');
      const { extractor, fetcher } = await buildWithLatest(fixture);

      const extraction = await extractor
        .extract(url)
        .unwrapOr(undefined as never);

      expect(extraction.id).toBe(fixture.id);
      expect(fetcher.calls).toBe(0);
    });

    it('refreshes a stale failed record (other reason)', async () => {
      const fixture = failedFixture(url, minutesAgo(10), 'blocked');
      const { extractor, fetcher } = await buildWithLatest(fixture);

      const extraction = await extractor
        .extract(url)
        .unwrapOr(undefined as never);

      expect(extraction.id).not.toBe(fixture.id);
      expect(fetcher.calls).toBe(1);
    });

    it('refreshes when no record exists', async () => {
      const { extractor, fetcher } = await buildWithLookup(() =>
        AsyncResult.fromResult(ok(Option.none())),
      );

      const extraction = await extractor
        .extract(url)
        .unwrapOr(undefined as never);

      expect(Extraction.isSucceeded(extraction)).toBe(true);
      expect(fetcher.calls).toBe(1);
    });

    it('surfaces a lookup failure other than "not-found" as "persist-failed", never touching the network', async () => {
      const queryFailure = Failure.create('query', 'boom') as DatabaseFailure;
      const { extractor, fetcher, insert } =
        await buildWithLookupFailure(queryFailure);

      const failure = await extractor
        .extract(url)
        .match({ ok: () => undefined, err: (f) => f });

      expect(failure?.name).toBe('persist-failed');
      expect(fetcher.calls).toBe(0);
      expect(insert).not.toHaveBeenCalled();
    });
  });

  describe('refresh dedup', () => {
    it('shares one refresh across concurrent callers for the same key', async () => {
      const url = Url.from('https://acme.example/p/trail-runner-3');
      const fetcher = fetcherCounting(JSON_LD_COMPLETE);
      const extractor = await buildExtractor(fetcher);

      const [first, second] = await Promise.all([
        extractor.refresh(url).unwrapOr(undefined as never),
        extractor.refresh(url).unwrapOr(undefined as never),
      ]);

      expect(fetcher.calls).toBe(1);
      expect(first.id).toBe(second.id);

      const third = await extractor.refresh(url).unwrapOr(undefined as never);
      expect(fetcher.calls).toBe(2);
      expect(third.id).not.toBe(first.id);
    });

    it('never shares an in-flight entry between different URLs', async () => {
      const first = Url.from('https://acme.example/p/1');
      const second = Url.from('https://acme.example/p/2');
      const fetcher = fetcherCounting(JSON_LD_COMPLETE);
      const extractor = await buildExtractor(fetcher);

      await Promise.all([
        extractor.refresh(first).unwrapOr(undefined as never),
        extractor.refresh(second).unwrapOr(undefined as never),
      ]);

      expect(fetcher.calls).toBe(2);
    });
  });
});
