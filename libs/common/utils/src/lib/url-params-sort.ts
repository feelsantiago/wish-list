export interface UrlParamsSort {
  sort(entries: [string, string][]): [string, string][];
}

export class UnsortedParams implements UrlParamsSort {
  public sort(entries: [string, string][]): [string, string][] {
    return entries;
  }
}

export class SortByNameAscending implements UrlParamsSort {
  public sort(entries: [string, string][]): [string, string][] {
    return [...entries].sort(([a], [b]) => a.localeCompare(b));
  }
}
