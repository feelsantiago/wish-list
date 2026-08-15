import type { UrlParamsFilter } from './url-params-filter.js';

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

export class NonTrackingParams implements UrlParamsFilter {
  public include(param: string): boolean {
    return (
      !TRACKING_PARAM_NAMES.has(param) &&
      !TRACKING_PARAM_PREFIXES.some((prefix) => param.startsWith(prefix))
    );
  }
}
