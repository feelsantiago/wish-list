import type { Failure } from './failure.js';

export type RendererConfig = { stacks?: boolean };

export interface FailureRenderer {
  render(failure: Failure, config?: RendererConfig): string;
  print(failure: Failure, config?: RendererConfig): void;
}
