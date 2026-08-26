import { Inject, Injectable } from '@nestjs/common';
import { AsyncResult, Result } from '@wish-list/common-result';
import { WithTimeout } from '@wish-list/common-utils';
import { Extraction } from '@wish-list/domain';
import type { Url } from '@wish-list/domain';
import { ExtractionRepository } from '@wish-list/database';
import { ExtractionFailure } from './extraction-failure.js';
import { MODULE_OPTIONS_TOKEN } from './extraction.options.js';
import type { ExtractionModuleOptions } from './extraction.options.js';
import { PageProductReader } from './reading/page-product-reader.js';
import { VendorResolver } from './vendor/vendor-resolver.js';

@Injectable()
export class Extractor {
  private readonly budget: number;

  public constructor(
    private readonly vendor: VendorResolver,
    private readonly reader: PageProductReader,
    private readonly extractions: ExtractionRepository,
    @Inject(MODULE_OPTIONS_TOKEN) options: ExtractionModuleOptions,
  ) {
    this.budget = options.budget;
  }

  public refresh(url: Url): AsyncResult<Extraction, ExtractionFailure> {
    return new AsyncResult(
      Result.safeTry(this, async function* (this: Extractor): AsyncGenerator<
        Result<never, ExtractionFailure>,
        Result<Extraction, ExtractionFailure>
      > {
        const vendor = yield* this.vendor.ensure(url);
        const product = await new WithTimeout(this.budget)
          .run(this.reader.read(url))
          .toPromise();

        if (product.isErr()) {
          return this.record(
            Extraction.failed({
              url,
              vendor: vendor.id,
              reason: product.error.name,
            }),
          ).toPromise();
        }

        const succeeded = yield* this.vendor
          .resolve(vendor, product.value.vendor)
          .map((resolved) =>
            Extraction.succeeded({
              url,
              vendor: resolved.id,
              source: product.value.source,
              data: product.value.item,
              vendorData: product.value.vendor,
            }),
          );

        return this.record(succeeded).toPromise();
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
}
