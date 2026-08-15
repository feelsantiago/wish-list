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
});
