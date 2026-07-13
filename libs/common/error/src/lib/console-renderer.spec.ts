import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRegExp, exactly, oneOrMore, char } from 'magic-regexp';
import { ConsoleRenderer } from './console-renderer.js';
import { Failure } from './failure.js';

const ansiEscapePattern = createRegExp(exactly('\x1b['));
const stackLinePattern = createRegExp(exactly('at ').and(oneOrMore(char)));
const stackLineWithParensPattern = createRegExp(
  exactly('at ')
    .and(oneOrMore(char))
    .and(exactly('('))
    .and(oneOrMore(char))
    .and(exactly(')')),
);

describe('ConsoleRenderer', () => {
  describe('render', () => {
    it('output contains ANSI codes for top-level failure (bold red)', () => {
      const renderer = new ConsoleRenderer();
      const f = Failure.from('top level error');
      const output = renderer.render(f);
      expect(output).toContain('[Failure] top level error');
      expect(output).toMatch(ansiEscapePattern);
    });

    it('nested Failure rendered in yellow', () => {
      const renderer = new ConsoleRenderer();
      const root = Failure.from('root');
      const ctx = root.context('outer');
      const output = renderer.render(ctx);
      expect(output).toContain('[Failure] outer');
      expect(output).toContain('[Failure] root');
      expect(output).toMatch(ansiEscapePattern);
    });

    it('native Error leaf rendered in magenta', () => {
      const renderer = new ConsoleRenderer();
      const err = new Error('native error');
      const f = Failure.from(err).context('wrapped');
      const output = renderer.render(f);
      expect(output).toContain('[Error] native error');
      expect(output).toMatch(ansiEscapePattern);
    });

    it('metadata keys in cyan, values in gray', () => {
      const renderer = new ConsoleRenderer();
      const f = Failure.from('error', { key: 'value' });
      const output = renderer.render(f);
      expect(output).toContain('key');
      expect(output).toContain('value');
    });

    it('stacks false by default - no stack in output', () => {
      const renderer = new ConsoleRenderer();
      const f = Failure.from('error');
      const output = renderer.render(f);
      expect(output).not.toMatch(stackLineWithParensPattern);
    });

    it('stacks true via constructor - stack present', () => {
      const renderer = new ConsoleRenderer({ stacks: true });
      const f = Failure.from('error');
      const output = renderer.render(f);
      expect(output).toMatch(stackLinePattern);
    });

    it('per-call stacks override constructor default', () => {
      const renderer = new ConsoleRenderer({ stacks: false });
      const f = Failure.from('error');
      const output = renderer.render(f, { stacks: true });
      expect(output).toMatch(stackLinePattern);
    });

    it('nested chain indented', () => {
      const renderer = new ConsoleRenderer();
      const root = Failure.from('root cause');
      const ctx = root.context('wrapper');
      const output = renderer.render(ctx);
      const lines = output.split('\n');
      const rootLine = lines.find((l) => l.includes('root cause'));
      expect(rootLine).toBeTruthy();
      expect(
        rootLine!.startsWith('  ') || rootLine!.startsWith('\x1b'),
      ).toBeTruthy();
    });
  });

  describe('print', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls console.error', () => {
      const renderer = new ConsoleRenderer();
      const f = Failure.from('error');
      renderer.print(f);
      expect(console.error).toHaveBeenCalledOnce();
    });

    it('passes rendered string to console.error', () => {
      const renderer = new ConsoleRenderer();
      const f = Failure.from('test error');
      renderer.print(f);
      const [arg] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(arg).toContain('[Failure] test error');
    });
  });
});
