import type { ExtractionSource } from '@wish-list/domain';
import { match, P } from 'ts-pattern';
import { Option } from '@wish-list/common-result';
import type { HtmlDocument } from '../html/html-document.js';
import { ProductReading } from '../reading/product-reading.js';
import type { StructuredParser } from './structured-parser.js';
import {
  jsonLdProduct$,
  type JsonLdOffer,
  type JsonLdProduct,
} from './json-ld.schemas.js';

export class JsonLdStructuredParser implements StructuredParser {
  public readonly source: ExtractionSource = 'json-ld';

  public parse(doc: HtmlDocument): Option<ProductReading> {
    const readings = doc
      .scripts('application/ld+json')
      .flatMap((text) => this.parseBlock(text))
      .filter((node): node is Record<string, unknown> => this.productNode(node))
      .map((node) => this.read(node));

    return readings.length === 0
      ? Option.none()
      : Option.some(this.mostComplete(readings));
  }

  private record(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private productNode(node: unknown): node is Record<string, unknown> {
    if (!this.record(node)) return false;
    return match(node['@type'])
      .with('Product', () => true)
      .with(P.array(P.string), (types) => types.includes('Product'))
      .otherwise(() => false);
  }

  private flattenNodes(node: unknown): unknown[] {
    return match(node)
      .with(P.array(P._), (nodes) => nodes.flatMap((n) => this.flattenNodes(n)))
      .when(this.record, (record) =>
        match(record['@graph'])
          .with(undefined, () => [record])
          .otherwise((graph) => this.flattenNodes(graph)),
      )
      .otherwise(() => []);
  }

  private parseBlock(text: string): unknown[] {
    return Option.fromThrowable(() => JSON.parse(text) as unknown)
      .map((node) => this.flattenNodes(node))
      .unwrapOr([]);
  }

  private priceOf(offer: Option<JsonLdOffer>): Option<number> {
    return offer
      .andThen((o) =>
        match(o.price)
          .with(undefined, () => Option.from(o.lowPrice))
          .otherwise((price) => Option.some(price)),
      )
      .map((raw) =>
        match(raw)
          .with(P.number, (n) => n)
          .otherwise((s) => Number.parseFloat(s)),
      )
      .filter(Number.isFinite);
  }

  private currencyOf(offer: Option<JsonLdOffer>): Option<string> {
    return offer.andThen((o) => Option.from(o.priceCurrency));
  }

  private read(node: Record<string, unknown>): ProductReading {
    const product: JsonLdProduct = jsonLdProduct$.parse(node);

    return {
      name: product.name,
      price: this.priceOf(product.offers),
      currency: this.currencyOf(product.offers),
      image: product.image,
      vendorName: product.brand,
    };
  }

  private count(reading: ProductReading): number {
    return [
      reading.name,
      reading.price,
      reading.currency,
      reading.image,
      reading.vendorName,
    ].filter((field) => field.isSome()).length;
  }

  private mostComplete(readings: readonly ProductReading[]): ProductReading {
    return readings.reduce((best, candidate) =>
      this.count(candidate) > this.count(best) ? candidate : best,
    );
  }
}
