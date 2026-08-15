import type { ExtractionSource } from '@wish-list/domain';
import type { Option } from '@wish-list/common-result';
import type { HtmlDocument } from '../html/html-document.js';
import type { ProductReading } from '../reading/product-reading.js';

export interface StructuredParser {
  readonly source: ExtractionSource;
  parse(doc: HtmlDocument): Option<ProductReading>;
}

export interface StructuredCandidate {
  readonly source: ExtractionSource;
  readonly reading: ProductReading;
}
