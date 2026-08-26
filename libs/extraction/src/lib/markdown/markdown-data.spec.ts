import { describe, it, expect } from 'vitest';
import { MarkdownData } from './markdown-data.js';

describe('MarkdownData', () => {
  describe('under the cap', () => {
    it('reports untruncated and round-trips the markdown', () => {
      const data = MarkdownData.from('# Trail Runner 3', 100);

      expect(data.truncated()).toBe(false);
      expect(data.text()).toBe('# Trail Runner 3');
    });

    it('sizes itself by the encoded length, not the character count', () => {
      const data = MarkdownData.from('αβγ', 100);

      expect(data.bytesLen()).toBe(6);
    });
  });

  describe('over the cap', () => {
    it('reports truncated and caps the byte length', () => {
      const data = MarkdownData.from('a'.repeat(500), 100);

      expect(data.truncated()).toBe(true);
      expect(data.bytesLen()).toBe(100);
    });

    it('cuts on the byte boundary, dropping a trailing partial sequence', () => {
      // Each 'α' is two bytes, so a cap of 7 lands mid-character. The bytes
      // stay capped at 7; only the decode drops the dangling half.
      const data = MarkdownData.from('α'.repeat(20), 7);

      expect(data.bytesLen()).toBe(7);
      expect(data.text()).toBe('ααα');
      expect(data.text()).not.toContain('�');
    });
  });

  describe('bytes', () => {
    it('views the encoded prefix of the markdown', () => {
      const markdown = 'a'.repeat(500);
      const data = MarkdownData.from(markdown, 100);

      expect(data.bytes()).toEqual(
        new TextEncoder().encode(markdown).subarray(0, 100),
      );
    });

    it('agrees with bytesLen', () => {
      const data = MarkdownData.from('a'.repeat(500), 100);

      expect(data.bytes().byteLength).toBe(data.bytesLen());
    });
  });
});
