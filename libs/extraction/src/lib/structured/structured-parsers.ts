import type { HtmlDocument } from '../html/html-document.js';
import type { StructuredCandidate, StructuredParser } from './structured-parser.js';

export class StructuredParsers {
  private readonly parsers: readonly StructuredParser[];

  public constructor(parsers: readonly StructuredParser[]) {
    this.parsers = parsers;
  }

  public *parse(doc: HtmlDocument): Generator<StructuredCandidate> {
    for (const parser of this.parsers) {
      const reading = parser.parse(doc);

      if (reading.isSome()) {
        yield { source: parser.source, reading: reading.value };
      }
    }
  }
}
