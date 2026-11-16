import type { Failure } from './failure.js';

export type RendererConfig = { stacks?: boolean };

export interface FailureRenderer {
  render(failure: Failure<string>, config?: RendererConfig): string;
  print(failure: Failure<string>, config?: RendererConfig): void;
}
