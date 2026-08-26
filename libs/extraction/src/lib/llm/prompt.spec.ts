import { describe, it, expect } from 'vitest';
import { HtmlDocument } from '../html/html-document.js';
import { MarkdownPage } from '../markdown/markdown-page.js';
import { productPrompt } from './prompt.js';

describe('productPrompt', () => {
  const page = MarkdownPage.from(
    HtmlDocument.parse(
      '<html><body><main><h1>Trail Runner 3</h1><p>$129.99</p></main></body></html>',
    ),
    40_000,
  );

  it('carries the page markdown', () => {
    expect(productPrompt(page)).toContain(page.text());
  });

  it('names every field the schema asks for', () => {
    const prompt = productPrompt(page);

    for (const field of ['name', 'price', 'currency', 'image', 'vendorName']) {
      expect(prompt).toContain(field);
    }
  });

  it('tells the model to omit rather than guess', () => {
    expect(productPrompt(page)).toContain('Omit any field the page does not state');
  });
});
