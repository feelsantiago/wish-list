import type { ExtractionSource } from '@wish-list/domain';
import { Option } from '@wish-list/common-result';
import type { HtmlDocument } from '../html/html-document.js';
import type { ProductReading } from '../reading/product-reading.js';
import type { StructuredParser } from './structured-parser.js';

export class OpenGraphStructuredParser implements StructuredParser {
  public readonly source: ExtractionSource = 'opengraph';

  public parse(doc: HtmlDocument): Option<ProductReading> {
    const reading: ProductReading = {
      name: this.first(doc.meta('og:title'), doc.meta('twitter:title')),
      image: this.first(doc.meta('og:image'), doc.meta('twitter:image')),
      vendorName: doc.meta('og:site_name'),
      price: doc.meta('product:price:amount').andThen(this.price),
      currency: doc.meta('product:price:currency'),
    };

    return this.absent(reading) ? Option.none() : Option.some(reading);
  }

  private first(a: Option<string>, b: Option<string>): Option<string> {
    return a.isSome() ? a : b;
  }

  private price(value: string): Option<number> {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Option.some(parsed) : Option.none();
  }

  private absent(reading: ProductReading): boolean {
    return (
      reading.name.isNone() &&
      reading.price.isNone() &&
      reading.currency.isNone() &&
      reading.image.isNone() &&
      reading.vendorName.isNone()
    );
  }
}
