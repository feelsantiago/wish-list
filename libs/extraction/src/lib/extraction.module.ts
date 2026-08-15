import { Module } from '@nestjs/common';
import { PAGE_FETCHER } from './fetcher/page-fetcher.js';
import { HttpPageFetcher } from './fetcher/http.page-fetcher.js';

@Module({
  providers: [{ provide: PAGE_FETCHER, useClass: HttpPageFetcher }],
  exports: [PAGE_FETCHER],
})
export class ExtractionModule {}
