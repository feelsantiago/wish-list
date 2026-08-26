import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigurableModuleClass } from './extraction.options.js';
import { PAGE_FETCHER } from './fetcher/page-fetcher.js';
import { HttpPageFetcher } from './fetcher/http.page-fetcher.js';
import { StructuredParsers } from './structured/structured-parsers.js';
import { JsonLdStructuredParser } from './structured/json-ld.structured-parser.js';
import { OpenGraphStructuredParser } from './structured/opengraph.structured-parser.js';
import { LLM } from './llm/llm.js';
import { VercelAiLlm } from './llm/vercel-ai.llm.js';
import { LlmProductReader } from './llm/llm-product-reader.js';
import { PageProductReader } from './reading/page-product-reader.js';
import { VendorResolver } from './vendor/vendor-resolver.js';
import { Extractor } from './extractor.js';

@Module({
  imports: [HttpModule],
  providers: [
    { provide: PAGE_FETCHER, useClass: HttpPageFetcher },
    { provide: LLM, useClass: VercelAiLlm },
    LlmProductReader,
    PageProductReader,
    VendorResolver,
    Extractor,
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
export class ExtractionModule extends ConfigurableModuleClass {}
