import { builtinModules } from 'node:module';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  {
    // libs/domain is isomorphic and imported at runtime by every app — ADR-0043.
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    rules: {
      // `lib: ["dom"]` types the web standards both runtimes share (URL, crypto);
      // globals that exist in only one runtime are banned here.
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'location',
          'localStorage',
          'sessionStorage',
          'process',
          'Buffer',
          'global',
          'require',
          '__dirname',
          '__filename',
        ].map((name) => ({
          name,
          message: 'libs/domain must stay isomorphic (ADR-0043).',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules.map((name) => ({
            name,
            message: 'libs/domain must stay isomorphic (ADR-0043).',
          })),
          patterns: [
            {
              group: ['node:*'],
              message: 'libs/domain must stay isomorphic (ADR-0043).',
            },
          ],
        },
      ],
    },
  },
];
