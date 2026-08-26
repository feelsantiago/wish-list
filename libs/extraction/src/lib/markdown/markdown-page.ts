import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { HtmlDocument } from '../html/html-document.js';

export class MarkdownPage {
  private constructor(
    private readonly markdown: string,
    private readonly cut: boolean,
  ) {}

  /**
   * Converts a pruned document to markdown, capped at `cap` bytes. The cap
   * bounds spend and model latency, so it counts bytes rather than characters.
   */
  public static from(doc: HtmlDocument, cap: number): MarkdownPage {
    const markdown = NodeHtmlMarkdown.translate(doc.pruned());
    const bytes = new TextEncoder().encode(markdown);

    return bytes.byteLength <= cap
      ? new MarkdownPage(markdown, false)
      : new MarkdownPage(MarkdownPage.cutTo(bytes, cap), true);
  }

  public text(): string {
    return this.markdown;
  }

  public truncated(): boolean {
    return this.cut;
  }

  /**
   * Cuts on the byte boundary. Stream mode withholds a trailing partial UTF-8
   * sequence instead of emitting U+FFFD for it.
   */
  private static cutTo(bytes: Uint8Array, cap: number): string {
    return new TextDecoder('utf-8').decode(bytes.subarray(0, cap), {
      stream: true,
    });
  }
}
