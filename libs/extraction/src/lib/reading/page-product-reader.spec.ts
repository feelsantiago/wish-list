import { describe, it, expect, vi } from 'vitest';
import type { z } from 'zod';
import { AsyncResult, err, ok } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { Url } from '@wish-list/domain';
import { StructuredParsers } from '../structured/structured-parsers.js';
import { JsonLdStructuredParser } from '../structured/json-ld.structured-parser.js';
import { OpenGraphStructuredParser } from '../structured/opengraph.structured-parser.js';
import { LlmProductReader } from '../llm/llm-product-reader.js';
import type { Llm } from '../llm/llm.js';
import type { PageFetcher } from '../fetcher/page-fetcher.js';
import type { ExtractionModuleOptions } from '../extraction.options.js';
import { PageProductReader } from './page-product-reader.js';

const URL = Url.from('https://acme.example/p/trail-runner-3');

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

const JSON_LD_UNSUPPORTED_CURRENCY = `<html><head><script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Trail Runner 3",
    "image": "https://cdn.acme.example/trail-runner-3.jpg",
    "brand": { "@type": "Brand", "name": "Acme Outfitters" },
    "offers": { "@type": "Offer", "price": "99.99", "priceCurrency": "GBP" }
  }
</script></head><body></body></html>`;

const JSON_LD_MISSING_PRICE_WITH_OPENGRAPH = `<html><head>
  <script type="application/ld+json">
    {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": "Trail Runner 3",
      "image": "https://cdn.acme.example/trail-runner-3.jpg",
      "brand": { "@type": "Brand", "name": "Acme Outfitters" }
    }
  </script>
  <meta property="og:title" content="Trail Runner 3" />
  <meta property="og:image" content="https://cdn.acme.example/trail-runner-3-og.jpg" />
  <meta property="og:site_name" content="Acme Outfitters" />
  <meta property="product:price:amount" content="129.99" />
  <meta property="product:price:currency" content="USD" />
</head><body></body></html>`;

const NO_STRUCTURED_DATA = '<html><body><h1>Trail Runner 3</h1></body></html>';

function fetcherReturning(html: string): PageFetcher {
  return { fetch: () => AsyncResult.fromResult(ok(html)) };
}

function fetcherFailingWith(
  failure: Failure<'fetch-failed' | 'blocked' | 'timeout'>,
): PageFetcher {
  return { fetch: () => AsyncResult.fromResult(err(failure)) };
}

function llmReplying(reply: unknown): { reader: LlmProductReader } {
  const llm: Llm = {
    generate: <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
      AsyncResult.fromResult(ok(schema.parse(reply))),
  };
  const options: ExtractionModuleOptions = {
    markdownCap: 40_000,
    llm: { apiKey: 'test-key', model: 'test-model' },
  };

  return { reader: new LlmProductReader(llm, options) };
}

function reader(
  fetcher: PageFetcher,
  llm: LlmProductReader,
): PageProductReader {
  const parsers = new StructuredParsers([
    new JsonLdStructuredParser(),
    new OpenGraphStructuredParser(),
  ]);

  return new PageProductReader(fetcher, parsers, llm);
}

describe('PageProductReader', () => {
  it('reads a complete JSON-LD reading without calling the LLM', async () => {
    const generate = vi.fn();
    const llm: Llm = { generate };
    const options: ExtractionModuleOptions = {
      markdownCap: 40_000,
      llm: { apiKey: 'test-key', model: 'test-model' },
    };

    const result = await reader(
      fetcherReturning(JSON_LD_COMPLETE),
      new LlmProductReader(llm, options),
    )
      .read(URL)
      .toPromise();

    expect(generate).not.toHaveBeenCalled();
    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(undefined as never).source).toBe('json-ld');
    expect(result.unwrapOr(undefined as never).item.name).toBe(
      'Trail Runner 3',
    );
  });

  it('falls back to OpenGraph when JSON-LD is incomplete', async () => {
    const { reader: llm } = llmReplying({});

    const result = await reader(
      fetcherReturning(JSON_LD_MISSING_PRICE_WITH_OPENGRAPH),
      llm,
    )
      .read(URL)
      .toPromise();

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(undefined as never).source).toBe('opengraph');
  });

  it('falls back to the LLM when nothing structured is present', async () => {
    const { reader: llm } = llmReplying({
      name: 'Trail Runner 3',
      price: '129.99',
      currency: 'USD',
      image: 'https://cdn.acme.example/trail-runner-3.jpg',
      vendorName: 'Acme Outfitters',
    });

    const result = await reader(fetcherReturning(NO_STRUCTURED_DATA), llm)
      .read(URL)
      .toPromise();

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(undefined as never).source).toBe('llm');
  });

  it('returns "no-data" when the LLM reply is missing a field', async () => {
    const { reader: llm } = llmReplying({ name: 'Trail Runner 3' });

    const failure = await reader(fetcherReturning(NO_STRUCTURED_DATA), llm)
      .read(URL)
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('no-data');
  });

  it('propagates a fetcher failure by name', async () => {
    const { reader: llm } = llmReplying({});
    const blocked = Failure.create('blocked', 'Blocked by captcha challenge');

    const failure = await reader(fetcherFailingWith(blocked), llm)
      .read(URL)
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('blocked');
  });

  it('returns "unsupported-currency" for a page priced outside the supported set', async () => {
    const { reader: llm } = llmReplying({});

    const failure = await reader(
      fetcherReturning(JSON_LD_UNSUPPORTED_CURRENCY),
      llm,
    )
      .read(URL)
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('unsupported-currency');
  });
});
