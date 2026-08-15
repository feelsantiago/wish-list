export interface UrlParamsFilter {
  /** Receives the already-lowercased parameter name. */
  include(param: string): boolean;
}

export class UnFilteredParams implements UrlParamsFilter {
  public include(): boolean {
    return true;
  }
}
