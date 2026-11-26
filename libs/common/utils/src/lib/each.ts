/**
 * Lifts a one-argument function over an array, so it can be passed straight to
 * `Result.map`: `.map(Each.map(Wishlist.plain))`. Calls `fn(item)` with exactly
 * one argument, never Array.map's `(item, index, array)`.
 */
export namespace Each {
  export function map<A, B>(fn: (item: A) => B): (items: readonly A[]) => B[] {
    return (items) => items.map((item) => fn(item));
  }
}
