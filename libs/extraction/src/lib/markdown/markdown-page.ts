import { NodeHtmlMarkdown } from 'node-html-markdown';
import type { HtmlDocument } from '../html/html-document.js';
import { MarkdownData } from './markdown-data.js';

export class MarkdownPage {
  private constructor(private readonly data: MarkdownData) {}

  /**
   * Converts a pruned document to markdown, capped at `cap` bytes. The cap
   * bounds spend and model latency, so it counts bytes rather than characters.
   */
  public static from(doc: HtmlDocument, cap: number): MarkdownPage {
    return new MarkdownPage(
      MarkdownData.from(NodeHtmlMarkdown.translate(doc.pruned()), cap),
    );
  }

  public text(): string {
    return this.data.text();
  }

  public truncated(): boolean {
    return this.data.truncated();
  }
}
