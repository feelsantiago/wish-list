import { getDomain } from 'tldts';
import { Option } from '@wish-list/common-result';
import { UnFilteredParams, type UrlParamsFilter } from './url-params-filter.js';
import { UnsortedParams, type UrlParamsSort } from './url-params-sort.js';

export interface UrlMetadataOptions {
  readonly filter?: UrlParamsFilter;
  readonly sort?: UrlParamsSort;
}

export class UrlMetadata {
  private constructor(
    private readonly parsed: URL,
    private readonly raw: string,
    private readonly filter: UrlParamsFilter,
    private readonly sort: UrlParamsSort,
  ) {}

  public static from(
    url: string,
    options: UrlMetadataOptions = {},
  ): UrlMetadata {
    return new UrlMetadata(
      new URL(url),
      url,
      options.filter ?? new UnFilteredParams(),
      options.sort ?? new UnsortedParams(),
    );
  }

  public host(): string {
    return this.parsed.hostname.toLowerCase();
  }

  public path(): string {
    return this.parsed.pathname.replace(/\/$/, '') || '/';
  }

  public domain(): Option<string> {
    return Option.from(getDomain(this.raw));
  }

  public params(): [string, string][] {
    const entries = Array.from(this.parsed.searchParams.entries()).filter(
      ([name]) => this.filter.include(name.toLowerCase()),
    );

    return this.sort.sort(entries);
  }

  public query(): string {
    const entries = this.params();
    return entries.length > 0
      ? `?${new URLSearchParams(entries).toString()}`
      : '';
  }
}
