const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      // Release-step migrator (ADR-0046), run as `node migrate.js`.
      additionalEntryPoints: [
        { entryName: 'migrate', entryPath: './src/migrate.ts' },
      ],
      tsConfig: './tsconfig.webpack.json',
      assets: [
        './src/assets',
        // SQL migrations, read by migrate.js from `__dirname/drizzle`.
        {
          input: '../../libs/database/drizzle',
          glob: '**/*',
          output: 'drizzle',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
      // Type checking is the `typecheck` target's job (tsc -b over project references).
      typeCheckOptions: false,
    }),
  ],
};
