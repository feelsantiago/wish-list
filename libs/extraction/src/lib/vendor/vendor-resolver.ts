import { Injectable } from '@nestjs/common';
import { AsyncResult, Result, ok } from '@wish-list/common-result';
import { UrlMetadata } from '@wish-list/common-utils';
import { Url, Vendor, VendorDomain } from '@wish-list/domain';
import type { ResolvedVendor } from '@wish-list/domain';
import { VendorRepository } from '@wish-list/database';
import { ExtractionFailure } from '../extraction-failure.js';

@Injectable()
export class VendorResolver {
  public constructor(private readonly vendors: VendorRepository) {}

  /** Existing Vendor for the URL's registrable domain, or a freshly inserted provisional one. */
  public ensure(url: Url): AsyncResult<Vendor, ExtractionFailure> {
    return new AsyncResult(
      Result.safeTry(
        this,
        async function* (
          this: VendorResolver,
        ): AsyncGenerator<
          Result<never, ExtractionFailure>,
          Result<Vendor, ExtractionFailure>
        > {
          const domain = yield* VendorDomain.fromUrl(url).mapErr((error) =>
            ExtractionFailure.persistFailed(error),
          );

          const found = await this.vendors
            .findByVendorDomain(domain)
            .toPromise();

          if (found.isOk()) {
            return ok(found.value);
          }

          if (found.error.name !== 'not-found') {
            return Result.err(ExtractionFailure.persistFailed(found.error));
          }

          return ok(yield* this.provision(domain, url));
        },
      ),
    );
  }

  /** Promotes to resolved and persists. A resolved Vendor re-resolved keeps one row. */
  public resolve(
    vendor: Vendor,
    data: Vendor.ExtractionData,
  ): AsyncResult<ResolvedVendor, ExtractionFailure> {
    return new AsyncResult(
      Result.safeTry(
        this,
        async function* (
          this: VendorResolver,
        ): AsyncGenerator<
          Result<never, ExtractionFailure>,
          Result<ResolvedVendor, ExtractionFailure>
        > {
          const resolved = yield* Vendor.resolve(vendor, data).mapErr((error) =>
            ExtractionFailure.persistFailed(error),
          );

          const updated = yield* this.vendors
            .update(resolved)
            .mapErr((error) => ExtractionFailure.persistFailed(error));

          return ok(updated as ResolvedVendor);
        },
      ),
    );
  }

  /** Lost the race: someone else inserted this domain first. Re-find once. */
  private provision(
    domain: VendorDomain,
    url: Url,
  ): AsyncResult<Vendor, ExtractionFailure> {
    const website = Url.from(UrlMetadata.from(url).origin());
    const provisional = Vendor.provisional({ vendorDomain: domain, website });

    return new AsyncResult(
      Result.safeTry(
        this,
        async function* (
          this: VendorResolver,
        ): AsyncGenerator<
          Result<never, ExtractionFailure>,
          Result<Vendor, ExtractionFailure>
        > {
          const inserted = await this.vendors.insert(provisional).toPromise();

          if (inserted.isOk()) {
            return ok(inserted.value);
          }

          if (inserted.error.name !== 'constraint') {
            return Result.err(ExtractionFailure.persistFailed(inserted.error));
          }

          return ok(
            yield* this.vendors
              .findByVendorDomain(domain)
              .mapErr((error) => ExtractionFailure.persistFailed(error)),
          );
        },
      ),
    );
  }
}
