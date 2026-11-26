/**
 * Web Crypto is global in Node 19+ and in secure browser contexts, which keeps
 * `libs/domain` isomorphic (ADR-0043). The one place the domain generates a UUID.
 */
export namespace Uuid {
  export function generate(): string {
    return crypto.randomUUID();
  }
}
