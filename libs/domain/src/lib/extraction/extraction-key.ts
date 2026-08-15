import type { Brand } from '../brand/brand.js';
import type { Url } from '../url/url.js';

const TRACKING_PARAM_NAMES = new Set([
  'tag',
  'ref',
  'gclid',
  'fbclid',
  '_encoding',
  'psc',
  'th',
]);

const TRACKING_PARAM_PREFIXES = ['utm_', 'ref_', 'mc_'];

function isTrackingParam(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    TRACKING_PARAM_NAMES.has(lower) ||
    TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))
  );
}

export type ExtractionKey = Brand<string, 'ExtractionKey'>;

export namespace ExtractionKey {
  export function from(value: string): ExtractionKey {
    return value as ExtractionKey;
  }

  export function fromUrl(url: Url): ExtractionKey {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/$/, '') || '/';

    const params = Array.from(parsed.searchParams.entries())
      .filter(([name]) => !isTrackingParam(name))
      .sort(([a], [b]) => a.localeCompare(b));
    const query = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : '';

    return from(`https://${host}${path}${query}`);
  }
}
