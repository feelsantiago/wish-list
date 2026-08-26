import { Inject, Injectable } from '@nestjs/common';
import { AsyncResult, Result, ok } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import type { Url } from '@wish-list/domain';
import { PAGE_FETCHER } from '../fetcher/page-fetcher.js';
import type { PageFetcher } from '../fetcher/page-fetcher.js';
import { HtmlDocument } from '../html/html-document.js';
import { StructuredParsers } from '../structured/structured-parsers.js';
import { LlmProductReader } from '../llm/llm-product-reader.js';
import { ProductReading } from './product-reading.js';
import { CompleteProductReading } from './complete-product-reading.js';
import type { ExtractedProduct, ReadingFailure } from './extracted-product.js';

@Injectable()
export class PageProductReader {
  private readonly fetcher: PageFetcher;
  private readonly parsers: StructuredParsers;
  private readonly llm: LlmProductReader;

  public constructor(
    @Inject(PAGE_FETCHER) fetcher: PageFetcher,
    parsers: StructuredParsers,
    llm: LlmProductReader,
  ) {
    this.fetcher = fetcher;
    this.parsers = parsers;
    this.llm = llm;
  }

  public read(url: Url): AsyncResult<ExtractedProduct, ReadingFailure> {
    return new AsyncResult(
      Result.safeTry(
        this,
        async function* (
          this: PageProductReader,
        ): AsyncGenerator<
          Result<never, ReadingFailure>,
          Result<ExtractedProduct, ReadingFailure>
        > {
          const html = yield* this.fetcher.fetch(url);
          const doc = HtmlDocument.parse(html);

          for (const candidate of this.parsers.parse(doc)) {
            const complete = ProductReading.complete(candidate.reading);

            if (complete.isSome()) {
              const domain = yield* CompleteProductReading.toDomain(
                complete.value,
                url,
              );

              return ok({
                source: candidate.source,
                item: domain.item,
                vendor: domain.vendor,
              });
            }
          }

          const reading = yield* this.llm.read(doc);
          const complete = yield* ProductReading.complete(reading).okOrElse(
            () =>
              Failure.create(
                'no-data',
                'LLM reply did not complete the reading',
              ),
          );
          const domain = yield* CompleteProductReading.toDomain(complete, url);

          return ok({
            source: 'llm',
            item: domain.item,
            vendor: domain.vendor,
          });
        },
      ),
    );
  }
}
