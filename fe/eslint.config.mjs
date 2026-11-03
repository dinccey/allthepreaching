import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Next.js 16 removed `next lint`, so linting runs through the ESLint CLI
// (see the "lint" script in package.json). This repo had eslint and
// eslint-config-next installed but no config file at all, which meant nothing
// was ever linted — including in CI, whose lint step failed on the removed
// command.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
