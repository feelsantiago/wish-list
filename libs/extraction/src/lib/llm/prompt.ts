import type { MarkdownPage } from '../markdown/markdown-page.js';

const INSTRUCTIONS = `You are extracting product data from the markdown of a single retail product page.

Return these fields:
- name: the product's own name, without the store name or marketing suffixes.
- price: the price a buyer pays right now, as a number. No currency symbols, no
  thousands separators. Prefer the current or sale price over a crossed-out one.
- currency: the ISO 4217 code for that price (USD, EUR, GBP, ...). Infer it from
  the symbol only when the symbol is unambiguous.
- image: the URL of the main product image, exactly as it appears on the page.
- vendorName: the name of the store selling the product, not the manufacturer,
  unless the store and the manufacturer are the same.

Omit any field the page does not state. Never guess, never carry a value over
from a related or recommended product, and never invent a placeholder.`;

export function productPrompt(page: MarkdownPage): string {
  return `${INSTRUCTIONS}\n\n--- PAGE MARKDOWN ---\n${page.text()}`;
}
