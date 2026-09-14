import { AsyncResult, ok, Result } from '@wish-list/common-result';
import { InFlightCache, WithTimeout } from '@wish-list/common-utils';
import { Extraction, ExtractionKey, TimeWindow } from '@wish-list/domain';
import type { Url } from '@wish-list/domain';
import { ExtractionRepository } from '@wish-list/database';
import { Inject, Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { ExtractionFailure } from './extraction-failure.js';
import { MODULE_OPTIONS_TOKEN } from './extraction.options.js';
import type { ExtractionModuleOptions } from './extraction.options.js';
import { PageProductReader } from './reading/page-product-reader.js';
import { VendorResolver } from './vendor/vendor-resolver.js';

@Injectable()
export class Extractor {
  private readonly inFlight = new InFlightCache<
    ExtractionKey,
    Result<Extraction, ExtractionFailure>
  >();

  public constructor(
    private readonly vendor: VendorResolver,
    private readonly reader: PageProductReader,
    private readonly extractions: ExtractionRepository,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: ExtractionModuleOptions,
  ) {}

  public extract(url: Url): AsyncResult<Extraction, ExtractionFailure> {
    const key = ExtractionKey.fromUrl(url);
    return this.lookup(key, url);
  }

  public refresh(url: Url): AsyncResult<Extraction, ExtractionFailure> {
    const key = ExtractionKey.fromUrl(url);
    return new AsyncResult(
      this.inFlight.execute({ key, job: () => this.run(url) }),
    );
  }

  private lookup(
    key: ExtractionKey,
    url: Url,
  ): AsyncResult<Extraction, ExtractionFailure> {
    return this.extractions
      .findLatestByKey(key)
      .mapErr(
        (error): ExtractionFailure => ExtractionFailure.persistFailed(error),
      )
      .andThen((found) =>
        found.match<AsyncResult<Extraction, ExtractionFailure>>({
          some: (extraction) => this.reuse(extraction, url),
          none: () => this.refresh(url),
        }),
      );
  }

  private reuse(
    latest: Extraction,
    url: Url,
  ): AsyncResult<Extraction, ExtractionFailure> {
    const options = Result.safeTry(this, function* () {
      const freshness = yield* TimeWindow.create(this.options.freshness);
      const failure = yield* TimeWindow.create(this.options.failureWindow);

      return ok({ freshness, failure });
    }).mapErr((error) => ExtractionFailure.misconfigured(error));

    return new AsyncResult(
      Result.safeTry(this, async function* () {
        const { freshness, failure } = yield* options;

        return match(latest)
          .with(
            { _tag: 'succeeded' },
            (extraction) => Extraction.before(extraction, freshness),
            () => this.reused(latest),
          )
          .with({ _tag: 'failed', reason: 'unsupported-currency' }, () =>
            this.reused(latest),
          )
          .with(
            { _tag: 'failed' },
            (extraction) => Extraction.before(extraction, failure),
            () => this.reused(latest),
          )
          .otherwise(() => this.refresh(url))
          .toPromise();
      }),
    );
  }

  private reused(
    extraction: Extraction,
  ): AsyncResult<Extraction, ExtractionFailure> {
    return AsyncResult.fromResult<Extraction, ExtractionFailure>(
      Result.ok(extraction),
    );
  }

  private run(url: Url): Promise<Result<Extraction, ExtractionFailure>> {
    return Result.safeTry(
      this,
      async function* (
        this: Extractor,
      ): AsyncGenerator<
        Result<never, ExtractionFailure>,
        Result<Extraction, ExtractionFailure>
      > {
        const vendor = yield* this.vendor.ensure(url);
        const product = await new WithTimeout(this.options.budget)
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
      },
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
