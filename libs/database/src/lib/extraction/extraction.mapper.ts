import { Injectable } from '@nestjs/common';
import { match } from 'ts-pattern';
import { Extraction } from '@wish-list/domain';
import type {
  Currency,
  ExtractionKey,
  ExtractionReason,
  ExtractionSource,
  Id,
  Plain,
  Url,
} from '@wish-list/domain';
import type { Result } from '@wish-list/common-result';
import { DatabaseDomainMapper } from '../mapper/database-domain-mapper.js';
import type { DomainMapper } from '../mapper/domain-mapper.js';
import type { DatabaseFailure } from '../database-failure/database-failure.js';
import { extractions } from './extraction.schema.js';

export type ExtractionRow = typeof extractions.$inferSelect;

@Injectable()
export class ExtractionDatabaseDomainMapper implements DomainMapper<
  Extraction,
  ExtractionRow
> {
  private readonly delegate: DatabaseDomainMapper<Extraction, ExtractionRow> =
    DatabaseDomainMapper.create(
      (extraction: Extraction) => this.toRow(extraction),
      (row: ExtractionRow) => Extraction.from(this.toPlainExtraction(row)),
    );

  public database(entity: Extraction): ExtractionRow {
    return this.delegate.database(entity);
  }

  public domain(row: ExtractionRow): Result<Extraction, DatabaseFailure>;
  public domain(
    row: ExtractionRow | undefined,
    notFound: DatabaseFailure,
  ): Result<Extraction, DatabaseFailure>;
  public domain(
    rows: readonly ExtractionRow[],
  ): Result<Extraction[], DatabaseFailure>;
  public domain(
    input: ExtractionRow | readonly ExtractionRow[] | undefined,
    notFound?: DatabaseFailure,
  ):
    | Result<Extraction, DatabaseFailure>
    | Result<Extraction[], DatabaseFailure> {
    if (input === undefined) {
      return this.delegate.domain(input, notFound as DatabaseFailure);
    }

    return this.delegate.domain(input as ExtractionRow);
  }

  private toRow(extraction: Extraction): ExtractionRow {
    const plain = Extraction.plain(extraction);
    const base = {
      id: plain.id,
      key: plain.key,
      url: plain.url,
      vendor: plain.vendor,
      createdAt: plain.createdAt,
    };

    return match(plain)
      .with({ _tag: 'succeeded' }, (p) => ({
        ...base,
        tag: 'succeeded' as const,
        source: p.source,
        reason: null,
        dataName: p.data.name,
        dataPriceAmount: p.data.price.amount,
        dataPriceCurrency: p.data.price.currency,
        dataImage: p.data.image,
        vendorDataName: p.vendorData.name,
        vendorDataWebsite: p.vendorData.website,
        vendorDataCurrency: p.vendorData.currency,
      }))
      .with({ _tag: 'failed' }, (p) => ({
        ...base,
        tag: 'failed' as const,
        source: null,
        reason: p.reason,
        dataName: null,
        dataPriceAmount: null,
        dataPriceCurrency: null,
        dataImage: null,
        vendorDataName: null,
        vendorDataWebsite: null,
        vendorDataCurrency: null,
      }))
      .exhaustive();
  }

  private toPlainExtraction(row: ExtractionRow): Plain<Extraction> {
    const base = {
      id: row.id as Id,
      key: row.key as ExtractionKey,
      url: row.url as Url,
      vendor: row.vendor as Id,
      createdAt: row.createdAt,
    };

    return match(row)
      .with({ tag: 'succeeded' }, (r) => ({
        ...base,
        _tag: 'succeeded' as const,
        source: r.source as ExtractionSource,
        data: {
          name: r.dataName as string,
          price: {
            amount: r.dataPriceAmount as number,
            currency: r.dataPriceCurrency as Currency,
          },
          image: r.dataImage as Url,
        },
        vendorData: {
          name: r.vendorDataName as string,
          website: r.vendorDataWebsite as Url,
          currency: r.vendorDataCurrency as Currency,
        },
      }))
      .with({ tag: 'failed' }, (r) => ({
        ...base,
        _tag: 'failed' as const,
        reason: r.reason as ExtractionReason,
      }))
      .exhaustive();
  }
}
