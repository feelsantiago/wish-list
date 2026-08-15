import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { Option } from '@wish-list/common-result';

export class HtmlDocument {
  private constructor(private readonly $: CheerioAPI) {}

  public static parse(html: string): HtmlDocument {
    return new HtmlDocument(load(html));
  }

  public meta(name: string): Option<string> {
    const value =
      this.$(`meta[property="${name}"]`).first().attr('content') ??
      this.$(`meta[name="${name}"]`).first().attr('content');

    return Option.from(value).filter((v) => v !== '');
  }

  public scripts(type: string): readonly string[] {
    return this.$(`script[type="${type}"]`)
      .toArray()
      .map((el) => this.$(el).html() ?? '');
  }
}
