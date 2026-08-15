import { z } from 'zod';
import type { ExtractionSource } from '@wish-list/domain';
import { Option } from '@wish-list/common-result';
import type { HtmlDocument } from '../html/html-document.js';
import { ProductReading } from '../reading/product-reading.js';
import type { StructuredParser } from './structured-parser.js';

const jsonLdOffer$ = z.object({
  price: z.union([z.string(), z.number()]).optional(),
  priceCurrency: z.string().optional(),
  lowPrice: z.union([z.string(), z.number()]).optional(),
});
type JsonLdOffer = z.infer<typeof jsonLdOffer$>;

const jsonLdOffers$ = z
  .union([jsonLdOffer$, z.array(jsonLdOffer$)])
  .optional()
  .transform((offers): Option<JsonLdOffer> => {
    if (offers === undefined) return Option.none();
    return Array.isArray(offers) ? Option.from(offers[0]) : Option.some(offers);
  });

const jsonLdImage$ = z
  .union([
    z.string(),
    z.array(z.string()),
    z.object({ url: z.string().optional() }),
  ])
  .optional()
  .transform((image): Option<string> => {
    if (image === undefined) return Option.none();
    if (typeof image === 'string') return Option.some(image);
    if (Array.isArray(image)) {
      return Option.from(image.find((value): value is string => typeof value === 'string'));
    }
    return Option.from(image.url);
  });

const jsonLdBrand$ = z
  .union([z.string(), z.object({ name: z.string().optional() })])
  .optional()
  .transform((brand): Option<string> => {
    if (brand === undefined) return Option.none();
    return typeof brand === 'string' ? Option.some(brand) : Option.from(brand.name);
  });

const jsonLdProduct$ = z.object({
  name: z.string().optional().transform(Option.from),
  image: jsonLdImage$,
  offers: jsonLdOffers$,
  brand: jsonLdBrand$,
});
type JsonLdProduct = z.infer<typeof jsonLdProduct$>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProductNode(node: unknown): node is Record<string, unknown> {
  if (!isRecord(node)) return false;
  const type = node['@type'];
  return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
}

function flattenNodes(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(flattenNodes);
  if (isRecord(node)) {
    const graph = node['@graph'];
    return graph !== undefined ? flattenNodes(graph) : [node];
  }
  return [];
}

function parseBlock(text: string): unknown[] {
  return Option.fromThrowable(() => JSON.parse(text) as unknown)
    .map(flattenNodes)
    .unwrapOr([]);
}

function priceOf(offer: Option<JsonLdOffer>): Option<number> {
  return offer
    .andThen((o) => (o.price !== undefined ? Option.some(o.price) : Option.from(o.lowPrice)))
    .map((raw) => (typeof raw === 'number' ? raw : Number.parseFloat(raw)))
    .filter(Number.isFinite);
}

function currencyOf(offer: Option<JsonLdOffer>): Option<string> {
  return offer.andThen((o) => Option.from(o.priceCurrency));
}

function toReading(node: Record<string, unknown>): ProductReading {
  const product: JsonLdProduct = jsonLdProduct$.parse(node);

  return {
    name: product.name,
    price: priceOf(product.offers),
    currency: currencyOf(product.offers),
    image: product.image,
    vendorName: product.brand,
  };
}

function fieldCount(reading: ProductReading): number {
  return [
    reading.name,
    reading.price,
    reading.currency,
    reading.image,
    reading.vendorName,
  ].filter((field) => field.isSome()).length;
}

function mostComplete(readings: readonly ProductReading[]): ProductReading {
  return readings.reduce((best, candidate) =>
    fieldCount(candidate) > fieldCount(best) ? candidate : best,
  );
}

export class JsonLdStructuredParser implements StructuredParser {
  public readonly source: ExtractionSource = 'json-ld';

  public parse(doc: HtmlDocument): Option<ProductReading> {
    const readings = doc
      .scripts('application/ld+json')
      .flatMap(parseBlock)
      .filter(isProductNode)
      .map(toReading);

    return readings.length === 0 ? Option.none() : Option.some(mostComplete(readings));
  }
}
