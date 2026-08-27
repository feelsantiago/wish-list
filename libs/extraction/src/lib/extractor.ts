import { AsyncResult, err, Result } from '@wish-list/common-result';
import { WithTimeout } from '@wish-list/common-utils';
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
  private readonly inFlight = new Map<
    ExtractionKey,
    Promise<Result<Extraction, ExtractionFailure>>
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

  private lookup(
    key: ExtractionKey,
    url: Url,
  ): AsyncResult<Extraction, ExtractionFailure> {
    return new AsyncResult(
      Result.safeTry(this, async function* () {
        const extraction = yield* this.extractions
          .findLatestByKey(key)
          .mapErr((error) =>
            match(error.name)
              .with('not-found', () => ExtractionFailure.notFound(error))
              .otherwise(() => ExtractionFailure.persistFailed(error)),
          );

        return this.reuse(extraction, url).toPromise();
      }),
    ).orElse((error) => {
      return match(error.name)
        .with('not-found', () => this.refresh(url))
        .otherwise(() =>
          AsyncResult.fromResult(err(ExtractionFailure.persistFailed(error))),
        );
    });
  }

  public refresh(url: Url): AsyncResult<Extraction, ExtractionFailure> {
    const key = ExtractionKey.fromUrl(url);
    const pending = this.inFlight.get(key) ?? this.startRefresh(key, url);
    this.inFlight.set(key, pending);

    return new AsyncResult(pending);
  }

  private reuse(
    latest: Extraction,
    url: Url,
  ): AsyncResult<Extraction, ExtractionFailure> {
    return new AsyncResult(
      Result.safeTry(this, async function* () {
        const freshness = yield* TimeWindow.create(
          this.options.freshness,
        ).mapErr((error) => ExtractionFailure.misconfigured(error));
        const failureWindow = yield* TimeWindow.create(
          this.options.failureWindow,
        ).mapErr((error) => ExtractionFailure.misconfigured(error));

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
            (extraction) => Extraction.before(extraction, failureWindow),
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

  private startRefresh(
    key: ExtractionKey,
    url: Url,
  ): Promise<Result<Extraction, ExtractionFailure>> {
    const run = Result.safeTry(
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

    return run.finally(() => this.inFlight.delete(key));
  }

  private record(
    extraction: Extraction,
  ): AsyncResult<Extraction, ExtractionFailure> {
    return this.extractions
      .insert(extraction)
      .mapErr((error) => ExtractionFailure.persistFailed(error));
  }
}
