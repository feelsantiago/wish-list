import { Injectable } from '@nestjs/common';
import { AsyncResult, Result } from '@wish-list/common-result';
import { UrlMetadata } from '@wish-list/common-utils';
import { Url, Vendor, VendorDomain } from '@wish-list/domain';
import type { ResolvedVendor } from '@wish-list/domain';
import { VendorRepository } from '@wish-list/database';
import { match } from 'ts-pattern';
import { ExtractionFailure } from '../extraction-failure.js';

@Injectable()
export class VendorResolver {
  public constructor(private readonly vendors: VendorRepository) {}

  /** Existing Vendor for the URL's registrable domain, or a freshly inserted provisional one. */
  public ensure(url: Url): AsyncResult<Vendor, ExtractionFailure> {
    return AsyncResult.fromResult(
      VendorDomain.fromUrl(url).mapErr((error): ExtractionFailure =>
        ExtractionFailure.persistFailed(error),
      ),
    ).andThen((domain) =>
      this.vendors
        .findByVendorDomain(domain)
        .mapErr((error): ExtractionFailure =>
          ExtractionFailure.persistFailed(error),
        )
        .andThen((found) =>
          found.match<AsyncResult<Vendor, ExtractionFailure>>({
            some: (vendor) => AsyncResult.fromResult(Result.ok(vendor)),
            none: () => this.provision(domain, url),
          }),
        ),
    );
  }

  /** Promotes to resolved and persists. A resolved Vendor re-resolved keeps one row. */
  public resolve(
    vendor: Vendor,
    data: Vendor.ExtractionData,
  ): AsyncResult<ResolvedVendor, ExtractionFailure> {
    return AsyncResult.fromResult(
      Vendor.resolve(vendor, data).mapErr((error): ExtractionFailure =>
        ExtractionFailure.persistFailed(error),
      ),
    )
      .andThen((resolved) =>
        this.vendors
          .update(resolved)
          .mapErr((error): ExtractionFailure =>
            ExtractionFailure.persistFailed(error),
          ),
      )
      .map((updated) => updated as ResolvedVendor);
  }

  /** Lost the race: someone else inserted this domain first. Re-find once. */
  private provision(
    domain: VendorDomain,
    url: Url,
  ): AsyncResult<Vendor, ExtractionFailure> {
    const website = Url.from(UrlMetadata.from(url).origin());
    const provisional = Vendor.provisional({ vendorDomain: domain, website });

    return this.vendors.insert(provisional).orElse((error) =>
      match(error.name)
        .with('constraint', () =>
          this.vendors
            .findByVendorDomain(domain)
            .mapErr((error): ExtractionFailure =>
              ExtractionFailure.persistFailed(error),
            )
            .andThen((found) =>
              found.match<Result<Vendor, ExtractionFailure>>({
                some: (vendor) => Result.ok(vendor),
                none: () => Result.err(ExtractionFailure.persistFailed(error)),
              }),
            ),
        )
        .otherwise(() => Result.err(ExtractionFailure.persistFailed(error))),
    );
  }
}
