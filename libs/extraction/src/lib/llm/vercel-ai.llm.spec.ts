import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { generateObject } from 'ai';
import type { ExtractionModuleOptions } from '../extraction.options.js';
import { VercelAiLlm } from './vercel-ai.llm.js';

vi.mock('ai', () => ({ generateObject: vi.fn() }));

const generate = vi.mocked(generateObject);

const OPTIONS: ExtractionModuleOptions = {
  markdownCap: 40_000,
  budget: 3000,
  llm: { apiKey: 'test-key', model: 'claude-haiku-4-5' },
  freshness: 24 * 60 * 60 * 1000,
  failureWindow: 5 * 60 * 1000,
};

const schema$ = z.object({ name: z.string() });

describe('VercelAiLlm', () => {
  beforeEach(() => {
    generate.mockReset();
  });

  it('returns the generated object', async () => {
    generate.mockResolvedValue({ object: { name: 'Trail Runner 3' } } as never);

    const result = await new VercelAiLlm(OPTIONS)
      .generate(schema$, 'extract this')
      .match({ ok: (value) => value, err: () => undefined });

    expect(result).toEqual({ name: 'Trail Runner 3' });
  });

  it('calls the configured model with the schema and the prompt', async () => {
    generate.mockResolvedValue({ object: { name: 'Trail Runner 3' } } as never);

    await new VercelAiLlm(OPTIONS)
      .generate(schema$, 'extract this')
      .toPromise();

    expect(generate).toHaveBeenCalledTimes(1);
    const call = generate.mock.calls[0][0] as {
      model: { modelId: string };
      schema: unknown;
      prompt: string;
      abortSignal: AbortSignal;
    };
    expect(call.model.modelId).toBe('claude-haiku-4-5');
    expect(call.schema).toBe(schema$);
    expect(call.prompt).toBe('extract this');
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('translates a thrown Error into an llm-failed failure', async () => {
    generate.mockRejectedValue(new Error('rate limited'));

    const failure = await new VercelAiLlm(OPTIONS)
      .generate(schema$, 'extract this')
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('llm-failed');
    expect(failure?.message).toBe('rate limited');
  });

  it('translates a non-Error rejection into an llm-failed failure', async () => {
    generate.mockRejectedValue('overloaded');

    const failure = await new VercelAiLlm(OPTIONS)
      .generate(schema$, 'extract this')
      .match({ ok: () => undefined, err: (f) => f });

    expect(failure?.name).toBe('llm-failed');
    expect(failure?.message).toBe('overloaded');
  });
});
