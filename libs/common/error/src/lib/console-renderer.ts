import pc from 'picocolors';
import { Failure } from './failure.js';
import type { FailureRenderer, RendererConfig } from './failure-renderer.js';

export class ConsoleRenderer implements FailureRenderer {
  private readonly defaultStacks: boolean;

  public constructor(config: { stacks?: boolean } = {}) {
    this.defaultStacks = config.stacks ?? false;
  }

  public render(failure: Failure, config?: RendererConfig): string {
    const stacks = config?.stacks ?? this.defaultStacks;
    const lines: string[] = [];
    this._renderFailure(failure, lines, 0, stacks, true);
    return lines.join('\n');
  }

  public print(failure: Failure, config?: RendererConfig): void {
    console.error(this.render(failure, config));
  }

  private _renderFailure(
    failure: Failure,
    lines: string[],
    depth: number,
    stacks: boolean,
    isTop: boolean,
  ): void {
    const indent = '  '.repeat(depth);
    const header = isTop
      ? pc.bold(pc.red(`[${failure.name}] ${failure.message}`))
      : pc.bold(pc.yellow(`[${failure.name}] ${failure.message}`));
    lines.push(`${indent}${header}`);

    for (const [k, v] of Object.entries(failure.metadata)) {
      lines.push(`${indent}  ${pc.cyan(k)}: ${pc.gray(String(v))}`);
    }

    if (stacks && failure.stack) {
      const stackLines = failure.stack.split('\n').slice(1);
      for (const line of stackLines) {
        lines.push(pc.dim(`${indent}  ${line.trim()}`));
      }
    }

    if (failure.source) {
      lines.push(`${indent}  ${pc.bold('caused by:')}`);
      this._renderSource(failure.source, lines, depth + 1, stacks);
    }
  }

  private _renderSource(
    source: Failure | Error,
    lines: string[],
    depth: number,
    stacks: boolean,
  ): void {
    const indent = '  '.repeat(depth);

    if (!(source instanceof Failure)) {
      lines.push(
        `${indent}${pc.bold(pc.magenta(`[${source.name}] ${source.message}`))}`,
      );
      if (stacks && source.stack) {
        const stackLines = source.stack.split('\n').slice(1);
        for (const line of stackLines) {
          lines.push(pc.dim(`${indent}  ${line.trim()}`));
        }
      }
      return;
    }

    this._renderFailure(source, lines, depth, stacks, false);
  }
}
