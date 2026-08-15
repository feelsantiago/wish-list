import {
  NonTrackingParams,
  SortByNameAscending,
  UrlMetadata,
} from '@wish-list/common-utils';
import type { Brand } from '../brand/brand.js';
import type { Url } from '../url/url.js';

export type ExtractionKey = Brand<string, 'ExtractionKey'>;

export namespace ExtractionKey {
  export function from(value: string): ExtractionKey {
    return value as ExtractionKey;
  }

  export function fromUrl(url: Url): ExtractionKey {
    const data = UrlMetadata.from(url, {
      filter: new NonTrackingParams(),
      sort: new SortByNameAscending(),
    });
    const host = data.host().replace(/^www\./, '');
    const path = data.path();
    const query = data.query();

    return from(`https://${host}${path}${query}`);
  }
}
