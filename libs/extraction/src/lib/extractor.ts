import { Inject, Injectable } from '@nestjs/common';
import { AsyncResult, Result, err, ok } from '@wish-list/common-result';
import { Failure } from '@wish-list/common-error';
import { Extraction } from '@wish-list/domain';
import type { Url } from '@wish-list/domain';
import { ExtractionRepository } from '@wish-list/database';
import { ExtractionFailure } from './extraction-failure.js';
import { MODULE_OPTIONS_TOKEN } from './extraction.options.js';
import type { ExtractionModuleOptions } from './extraction.options.js';
import { PageProductReader } from './reading/page-product-reader.js';
import type {
  ExtractedProduct,
  ReadingFailure,
} from './reading/extracted-product.js';
import { VendorResolver } from './vendor/vendor-resolver.js';

@Injectable()
export class Extractor {
  private readonly vendorResolver: VendorResolver;
  private readonly reader: PageProductReader;
  private readonly extractions: ExtractionRepository;
  private readonly budget: number;

  public constructor(
    vendorResolver: VendorResolver,
    reader: PageProductReader,
    extractions: ExtractionRepository,
    @Inject(MODULE_OPTIONS_TOKEN) options: ExtractionModuleOptions,
  ) {
    this.vendorResolver = vendorResolver;
    this.reader = reader;
    this.extractions = extractions;
    this.budget = options.budget;
  }

  public refresh(url: Url): AsyncResult<Extraction, ExtractionFailure> {
    return new AsyncResult(
      Result.safeTry(this, async function* (this: Extractor): AsyncGenerator<
        Result<never, ExtractionFailure>,
        Result<Extraction, ExtractionFailure>
      > {
        const vendor = yield* this.vendorResolver.ensure(url);
        const product = await this.withBudget(this.reader.read(url));

        if (product.isErr()) {
          return ok(
            yield* this.record(
              Extraction.failed({
                url,
                vendor: vendor.id,
                reason: product.error.name,
              }),
            ),
          );
        }

        const resolved = yield* this.vendorResolver.resolve(
          vendor,
          product.value.vendor,
        );

        return ok(
          yield* this.record(
            Extraction.succeeded({
              url,
              vendor: resolved.id,
              source: product.value.source,
              data: product.value.item,
              vendorData: product.value.vendor,
            }),
          ),
        );
      }),
    );
  }

  private record(
    extraction: Extraction,
  ): AsyncResult<Extraction, ExtractionFailure> {
    return this.extractions
      .insert(extraction)
      .mapErr((error) => ExtractionFailure.persistFailed(error));
  }

  /** The race covers the whole pipeline; each adapter also self-bounds by the same budget. */
  private withBudget(
    result: AsyncResult<ExtractedProduct, ReadingFailure>,
  ): Promise<Result<ExtractedProduct, ReadingFailure>> {
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<Result<ExtractedProduct, ReadingFailure>>(
      (resolve) => {
        timer = setTimeout(
          () =>
            resolve(
              err(
                Failure.create(
                  'timeout',
                  `Extraction exceeded budget of ${this.budget}ms`,
                ),
              ),
            ),
          this.budget,
        );
      },
    );

    return Promise.race([result.toPromise(), timeout]).finally(() =>
      clearTimeout(timer),
    );
  }
}
