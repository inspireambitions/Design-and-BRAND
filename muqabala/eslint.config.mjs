import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // These React Compiler diagnostics expose existing ref/effect patterns across
    // the legacy interview flows. Keep them visible while they are migrated,
    // without making the baseline lint command unusable.
    rules: {
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'build/**',
    'coverage/**',
    'out/**',
    'next-env.d.ts',
  ]),
]);
