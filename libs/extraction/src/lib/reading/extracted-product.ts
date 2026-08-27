import type { ExtractionSource, Item, Vendor } from '@wish-list/domain';

export interface ExtractedProduct {
  readonly source: ExtractionSource;
  readonly item: Item.ExtractionData;
  readonly vendor: Vendor.ExtractionData;
}
