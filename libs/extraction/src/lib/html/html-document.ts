import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { Option } from '@wish-list/common-result';

const NOISE_SELECTOR = [
  'script',
  'style',
  'nav',
  'footer',
  'header',
  'aside',
  'form',
  'svg',
  'iframe',
  'noscript',
].join(', ');

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

  /**
   * Serializes a copy of the document with noise nodes and comments removed.
   * The document this was parsed from is left untouched.
   */
  public pruned(): string {
    const clone = this.$.root().clone();

    clone.find(NOISE_SELECTOR).remove();
    clone
      .contents()
      .add(clone.find('*').contents())
      .filter((_, node) => node.type === 'comment')
      .remove();

    return this.$.html(clone);
  }
}
