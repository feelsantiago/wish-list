import { Inject, Injectable } from '@nestjs/common';
import { Failure } from '@wish-list/common-error';
import type {
  FailureRenderer,
  RendererConfig,
} from '@wish-list/common-error/renderers';
import { Option } from '@wish-list/common-result';
import { PinoLogger } from 'nestjs-pino';
import { match, P } from 'ts-pattern';

/** One failure in a cause chain, flattened so a single redact path covers every link. */
export type FailureLink = {
  readonly name: string;
  readonly message: string;
  readonly metadata: Record<string, unknown>;
  readonly stack?: string;
};

export type RenderedFailure = {
  readonly failure: { readonly chain: FailureLink[] };
};

/**
 * Structured counterpart of `ConsoleRenderer` (ADR-0011, ADR-0035). Stacks default
 * on: a JSON log has no reader to overwhelm.
 */
@Injectable()
export class PinoFailureRenderer implements FailureRenderer {
  public constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    this.logger.setContext(PinoFailureRenderer.name);
  }

  public render(failure: Failure<string>, config?: RendererConfig): string {
    return JSON.stringify(this.serialize(failure, config));
  }

  public print(failure: Failure<string>, config?: RendererConfig): void {
    this.logger.error(this.serialize(failure, config), failure.message);
  }

  private serialize(
    failure: Failure<string>,
    config?: RendererConfig,
  ): RenderedFailure {
    const stacks = config?.stacks ?? true;
    return { failure: { chain: this.chain(failure, stacks) } };
  }

  private chain(link: Failure<string> | Error, stacks: boolean): FailureLink[] {
    const stack = Option.from(link.stack)
      .filter(() => stacks)
      .match({ some: (s) => ({ stack: s }), none: () => ({}) });

    return (
      match(link)
        .with(
          P.when((v): v is Failure => v instanceof Failure),
          (f) => [
            {
              name: f.name,
              message: f.message,
              metadata: f.metadata,
              ...stack,
            },
            ...Option.from(f.source)
              .map((source) => this.chain(source, stacks))
              .unwrapOr([]),
          ],
        )
        // `Failure` subsumes `Error` structurally, so this arm narrows to `never`; read `link`.
        .otherwise(() => [
          { name: link.name, message: link.message, metadata: {}, ...stack },
        ])
    );
  }
}
