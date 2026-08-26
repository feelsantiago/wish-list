import type { Failure } from '@wish-list/common-error';
import type {
  ExtractionReason,
  ExtractionSource,
  Item,
  Vendor,
} from '@wish-list/domain';

export interface ExtractedProduct {
  readonly source: ExtractionSource;
  readonly item: Item.ExtractionData;
  readonly vendor: Vendor.ExtractionData;
}

/**
 * Every reason the page itself can fail for. Assignable from each step's own
 * narrower failure type, so `reason: failure.name` needs no mapping.
 */
export type ReadingFailure = Failure<ExtractionReason>;
