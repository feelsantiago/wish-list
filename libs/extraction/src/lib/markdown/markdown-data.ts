/**
 * UTF-8 markdown held as bytes, capped at a byte budget. Bytes are the base
 * representation: the source string is encoded once, and the cap is recorded
 * rather than applied, so every accessor derives its view on demand and no
 * string round-trip happens.
 */
export class MarkdownData {
  private constructor(
    private readonly raw: Uint8Array,
    private readonly cap: number,
  ) {}

  public static from(markdown: string, cap: number): MarkdownData {
    return new MarkdownData(new TextEncoder().encode(markdown), cap);
  }

  /** A view of the first `cap` bytes. `subarray` copies nothing. */
  public bytes(): Uint8Array {
    return this.raw.subarray(0, this.cap);
  }

  public bytesLen(): number {
    return this.bytes().byteLength;
  }

  /**
   * Decodes the capped view. Stream mode withholds a trailing partial UTF-8
   * sequence instead of emitting U+FFFD for it.
   */
  public text(): string {
    return new TextDecoder('utf-8').decode(this.bytes(), { stream: true });
  }

  public truncated(): boolean {
    return this.raw.byteLength > this.cap;
  }
}
