import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    // This repository predates the React 19 compiler lint rules and contains
    // intentional state restoration effects and render-time refs throughout.
    // Keep the previous lint baseline while retaining Next.js correctness,
    // accessibility, import and ordinary hooks checks for new work.
    rules: {
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);
