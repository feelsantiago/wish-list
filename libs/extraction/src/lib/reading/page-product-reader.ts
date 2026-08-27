import { Inject, Injectable } from '@nestjs/common';
import { AsyncResult, Result, ok } from '@wish-list/common-result';
import type { ExtractionSource, Url } from '@wish-list/domain';
import { PAGE_FETCHER } from '../fetcher/page-fetcher.js';
import type { PageFetcher } from '../fetcher/page-fetcher.js';
import { HtmlDocument } from '../html/html-document.js';
import { StructuredParsers } from '../structured/structured-parsers.js';
import { LlmProductReader } from '../llm/llm-product-reader.js';
import { ProductReading } from './product-reading.js';
import { CompleteProductReading } from './complete-product-reading.js';
import type { ExtractedProduct } from './extracted-product.js';
import { ReadingFailure } from './reading-failure.js';

interface FoundReading {
  readonly source: ExtractionSource;
  readonly reading: CompleteProductReading;
}

@Injectable()
export class PageProductReader {
  public constructor(
    @Inject(PAGE_FETCHER) private readonly fetcher: PageFetcher,
    private readonly parsers: StructuredParsers,
    private readonly llm: LlmProductReader,
  ) {}

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

          const found = yield* AsyncResult.fromResult(
            this.structured(doc),
          ).orElse(() => this.ai(doc));

          const domain = yield* CompleteProductReading.toDomain(
            found.reading,
            url,
          );

          return ok({
            source: found.source,
            item: domain.item,
            vendor: domain.vendor,
          });
        },
      ),
    );
  }

  private structured(doc: HtmlDocument): Result<FoundReading, ReadingFailure> {
    for (const candidate of this.parsers.parse(doc)) {
      const complete = ProductReading.complete(candidate.reading);

      if (complete.isSome()) {
        return ok({ source: candidate.source, reading: complete.value });
      }
    }

    return Result.err(ReadingFailure.noStructuredData());
  }

  private ai(doc: HtmlDocument): AsyncResult<FoundReading, ReadingFailure> {
    return new AsyncResult(
      Result.safeTry(
        this,
        async function* (
          this: PageProductReader,
        ): AsyncGenerator<
          Result<never, ReadingFailure>,
          Result<FoundReading, ReadingFailure>
        > {
          const reading = yield* this.llm.read(doc);
          const complete = yield* ProductReading.complete(reading).okOrElse(
            ReadingFailure.noLlmData,
          );

          return ok({ source: 'llm', reading: complete });
        },
      ),
    );
  }
}
