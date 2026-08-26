import { describe, it, expect } from 'vitest';
import { Option } from '@wish-list/common-result';
import { HtmlDocument } from './html-document.js';

describe('HtmlDocument', () => {
  describe('meta', () => {
    it('reads a property= meta tag', () => {
      const doc = HtmlDocument.parse(
        '<html><head><meta property="og:title" content="Trail Runner 3" /></head></html>',
      );

      expect(doc.meta('og:title')).toEqual(Option.some('Trail Runner 3'));
    });

    it('falls back to a name= meta tag when property= is absent', () => {
      const doc = HtmlDocument.parse(
        '<html><head><meta name="twitter:title" content="Ceramic Mug Set" /></head></html>',
      );

      expect(doc.meta('twitter:title')).toEqual(
        Option.some('Ceramic Mug Set'),
      );
    });

    it('prefers property= over name= when both are present', () => {
      const doc = HtmlDocument.parse(
        `<html><head>
          <meta name="og:title" content="Wrong" />
          <meta property="og:title" content="Right" />
        </head></html>`,
      );

      expect(doc.meta('og:title')).toEqual(Option.some('Right'));
    });

    it('returns None for an empty content attribute', () => {
      const doc = HtmlDocument.parse(
        '<html><head><meta property="og:title" content="" /></head></html>',
      );

      expect(doc.meta('og:title')).toEqual(Option.none());
    });

    it('returns None when the meta tag is absent', () => {
      const doc = HtmlDocument.parse('<html><head></head></html>');

      expect(doc.meta('og:title')).toEqual(Option.none());
    });
  });

  describe('scripts', () => {
    it('returns the bodies of matching script tags in document order', () => {
      const doc = HtmlDocument.parse(`<html><head>
        <script type="application/ld+json">{"a":1}</script>
        <script type="application/ld+json">{"b":2}</script>
        <script type="application/other">ignored</script>
      </head></html>`);

      expect(doc.scripts('application/ld+json')).toEqual([
        '{"a":1}',
        '{"b":2}',
      ]);
    });

    it('returns an empty array when no matching script tags exist', () => {
      const doc = HtmlDocument.parse('<html><head></head></html>');

      expect(doc.scripts('application/ld+json')).toEqual([]);
    });
  });

  describe('pruned', () => {
    it('drops noise nodes', () => {
      const doc = HtmlDocument.parse(`<html><body>
        <nav>Shoes</nav>
        <header>Acme</header>
        <aside>Newsletter</aside>
        <form><button>Add to cart</button></form>
        <svg><title>Logo</title></svg>
        <iframe src="https://ads.example"></iframe>
        <noscript>Enable JavaScript</noscript>
        <script>tracker()</script>
        <style>.price { color: red }</style>
        <main>Trail Runner 3</main>
      </body></html>`);

      const pruned = doc.pruned();

      for (const noise of [
        'Shoes',
        'Acme',
        'Newsletter',
        'Add to cart',
        'Logo',
        'ads.example',
        'Enable JavaScript',
        'tracker()',
        'color: red',
      ]) {
        expect(pruned).not.toContain(noise);
      }
      expect(pruned).toContain('Trail Runner 3');
    });

    it('drops comment nodes at any depth', () => {
      const doc = HtmlDocument.parse(
        '<html><body><!-- top --><main><!-- nested -->Kept</main></body></html>',
      );

      const pruned = doc.pruned();

      expect(pruned).not.toContain('top');
      expect(pruned).not.toContain('nested');
      expect(pruned).toContain('Kept');
    });

    it('keeps head meta tags and main content', () => {
      const doc = HtmlDocument.parse(
        `<html><head><meta property="og:title" content="Trail Runner 3" /></head>
         <body><main><h1>Trail Runner 3</h1><p>$129.99</p></main></body></html>`,
      );

      const pruned = doc.pruned();

      expect(pruned).toContain('og:title');
      expect(pruned).toContain('$129.99');
    });

    it('leaves the document it was parsed from unmutated', () => {
      const doc = HtmlDocument.parse(
        `<html><head>
          <meta property="og:title" content="Trail Runner 3" />
          <script type="application/ld+json">{"a":1}</script>
        </head><body><nav>Shoes</nav></body></html>`,
      );

      doc.pruned();

      expect(doc.meta('og:title')).toEqual(Option.some('Trail Runner 3'));
      expect(doc.scripts('application/ld+json')).toEqual(['{"a":1}']);
      expect(doc.pruned()).not.toContain('Shoes');
    });
  });
});
