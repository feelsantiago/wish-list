import { describe, it, expect, vi } from 'vitest';
import type { z } from 'zod';
import { AsyncResult, Option, err, ok } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { HtmlDocument } from '../html/html-document.js';
import type { ExtractionModuleOptions } from '../extraction.options.js';
import type { Llm } from './llm.js';
import { LlmProductReader } from './llm-product-reader.js';

function options(markdownCap: number): ExtractionModuleOptions {
  return { markdownCap, llm: { apiKey: 'test-key', model: 'test-model' } };
}

function replying(reply: unknown): { llm: Llm; prompts: string[] } {
  const prompts: string[] = [];
  const llm: Llm = {
    generate: <T>(
      schema: z.ZodType<T, z.ZodTypeDef, unknown>,
      prompt: string,
    ) => {
      prompts.push(prompt);
      return AsyncResult.fromResult(ok(schema.parse(reply)));
    },
  };

  return { llm, prompts };
}

function failing(): Llm {
  return {
    generate: () =>
      AsyncResult.fromResult(err(Failure.create('llm-failed', 'rate limited'))),
  };
}

const PAGE = HtmlDocument.parse(
  `<html><body>
    <nav>Shoes</nav>
    <main><h1>Trail Runner 3</h1><p>$129.99</p></main>
  </body></html>`,
);

describe('LlmProductReader', () => {
  it('prompts with the markdown of the pruned page', async () => {
    const { llm, prompts } = replying({});
    await new LlmProductReader(llm, options(40_000)).read(PAGE).toPromise();

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('Trail Runner 3');
    expect(prompts[0]).toContain('$129.99');
    expect(prompts[0]).not.toContain('Shoes');
  });

  it('caps the markdown it prompts with', async () => {
    const { llm, prompts } = replying({});
    await new LlmProductReader(llm, options(5)).read(PAGE).toPromise();

    expect(prompts[0]).not.toContain('$129.99');
  });

  it('returns a reading with the fields the model answered', async () => {
    const { llm } = replying({
      name: 'Trail Runner 3',
      price: '129.99',
      currency: 'USD',
      image: 'https://cdn.acme.example/trail-runner-3.jpg',
      vendorName: 'Acme Outfitters',
    });

    const reading = await new LlmProductReader(llm, options(40_000))
      .read(PAGE)
      .match({ ok: (value) => value, err: () => undefined });

    expect(reading).toEqual({
      name: Option.some('Trail Runner 3'),
      price: Option.some(129.99),
      currency: Option.some('USD'),
      image: Option.some('https://cdn.acme.example/trail-runner-3.jpg'),
      vendorName: Option.some('Acme Outfitters'),
    });
  });

  it('yields None fields rather than an Err for a partial reply', async () => {
    const { llm } = replying({ name: 'Trail Runner 3' });

    const result = await new LlmProductReader(llm, options(40_000))
      .read(PAGE)
      .toPromise();

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(undefined as never)).toEqual({
      name: Option.some('Trail Runner 3'),
      price: Option.none(),
      currency: Option.none(),
      image: Option.none(),
      vendorName: Option.none(),
    });
  });

  it('propagates a failure from the port', async () => {
    const failure = await new LlmProductReader(failing(), options(40_000))
      .read(PAGE)
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('llm-failed');
    expect(failure?.message).toBe('rate limited');
  });

  it('parses the page once per read', async () => {
    const { llm } = replying({});
    const doc = HtmlDocument.parse(
      '<html><head><meta property="og:title" content="Trail Runner 3" /></head></html>',
    );
    const pruned = vi.spyOn(doc, 'pruned');

    await new LlmProductReader(llm, options(40_000)).read(doc).toPromise();

    expect(pruned).toHaveBeenCalledTimes(1);
    expect(doc.meta('og:title')).toEqual(Option.some('Trail Runner 3'));
  });
});
