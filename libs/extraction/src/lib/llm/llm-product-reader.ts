import { Inject, Injectable } from '@nestjs/common';
import type { AsyncResult } from '@wish-list/common-result';
import type { Failure } from '@wish-list/common-error';
import type { HtmlDocument } from '../html/html-document.js';
import { MarkdownPage } from '../markdown/markdown-page.js';
import type { ProductReading } from '../reading/product-reading.js';
import { MODULE_OPTIONS_TOKEN } from '../extraction.options.js';
import type { ExtractionModuleOptions } from '../extraction.options.js';
import { LLM, Llm } from './llm.js';
import { productPrompt } from './prompt.js';

@Injectable()
export class LlmProductReader {
  private readonly llm: Llm;
  private readonly markdownCap: number;

  public constructor(
    @Inject(LLM) llm: Llm,
    @Inject(MODULE_OPTIONS_TOKEN) options: ExtractionModuleOptions,
  ) {
    this.llm = llm;
    this.markdownCap = options.markdownCap;
  }

  /**
   * A reply missing fields is a reading with `None` in them, not an `Err` —
   * the orchestrator's completeness gate rejects it exactly as it rejects a
   * four-field OpenGraph reading. `Err` means the call itself failed.
   */
  public read(
    doc: HtmlDocument,
  ): AsyncResult<ProductReading, Failure<'llm-failed'>> {
    const page = MarkdownPage.from(doc, this.markdownCap);

    return this.llm.generate(Llm.product$, productPrompt(page));
  }
}
