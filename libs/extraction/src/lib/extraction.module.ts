import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PAGE_FETCHER } from './fetcher/page-fetcher.js';
import { HttpPageFetcher } from './fetcher/http.page-fetcher.js';
import { StructuredParsers } from './structured/structured-parsers.js';
import { JsonLdStructuredParser } from './structured/json-ld.structured-parser.js';
import { OpenGraphStructuredParser } from './structured/opengraph.structured-parser.js';

@Module({
  imports: [HttpModule],
  providers: [
    { provide: PAGE_FETCHER, useClass: HttpPageFetcher },
    {
      provide: StructuredParsers,
      useFactory: () =>
        new StructuredParsers([
          new JsonLdStructuredParser(),
          new OpenGraphStructuredParser(),
        ]),
    },
  ],
  exports: [PAGE_FETCHER],
})
export class ExtractionModule {}
