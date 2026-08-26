import type { HtmlDocument } from '../html/html-document.js';
import type { StructuredCandidate, StructuredParser } from './structured-parser.js';

export class StructuredParsers {
  public constructor(private readonly parsers: readonly StructuredParser[]) {}

  public *parse(doc: HtmlDocument): Generator<StructuredCandidate> {
    for (const parser of this.parsers) {
      const reading = parser.parse(doc);

      if (reading.isSome()) {
        yield { source: parser.source, reading: reading.value };
      }
    }
  }
}
