import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { HtmlDocument } from '../html/html-document.js';
import { MarkdownPage } from './markdown-page.js';

function fixture(name: string): HtmlDocument {
  const path = fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
  return HtmlDocument.parse(readFileSync(path, 'utf-8'));
}

function page(html: string, cap = 40_000): MarkdownPage {
  return MarkdownPage.from(HtmlDocument.parse(html), cap);
}

describe('MarkdownPage', () => {
  describe('from', () => {
    it('keeps the product block of a noisy page', () => {
      const text = MarkdownPage.from(fixture('noisy-product.html'), 40_000).text();

      expect(text).toContain('Trail Runner 3');
      expect(text).toContain('$129.99');
      expect(text).toContain('Lightweight trail shoe with a rock plate.');
    });

    it('drops the noise around the product block', () => {
      const text = MarkdownPage.from(fixture('noisy-product.html'), 40_000).text();

      for (const noise of [
        'Socks',
        'Newsletter',
        'Add to cart',
        'Enable JavaScript to buy.',
        'Logo mark',
        'window.tracker',
        'color: red',
        'analytics beacon',
      ]) {
        expect(text).not.toContain(noise);
      }
    });

    it('reports untruncated when the markdown fits the cap', () => {
      const fitting = page('<html><body><main>Trail Runner 3</main></body></html>');

      expect(fitting.truncated()).toBe(false);
      expect(fitting.text()).toContain('Trail Runner 3');
    });

    it('reports truncated and cuts to the cap when the markdown exceeds it', () => {
      const long = page(
        `<html><body><main>${'a'.repeat(500)}</main></body></html>`,
        100,
      );

      expect(long.truncated()).toBe(true);
      expect(new TextEncoder().encode(long.text()).byteLength).toBe(100);
    });

    it('cuts on the byte boundary, dropping a trailing partial sequence', () => {
      // Each 'α' is two bytes, so a cap of 7 lands mid-character.
      const multibyte = page(
        `<html><body><main>${'α'.repeat(20)}</main></body></html>`,
        7,
      );

      expect(multibyte.truncated()).toBe(true);
      expect(multibyte.text()).toBe('ααα');
      expect(multibyte.text()).not.toContain('�');
    });
  });
});
