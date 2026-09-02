/**
 * Module hooks for unit tests that import application modules directly.
 *
 * Node's type stripping runs the TypeScript as is, so three things the Next
 * build normally handles have to be handled here:
 *  - `import 'server-only'` throws outside a React server bundle; it resolves
 *    to an empty module.
 *  - `@/lib/...` aliases map to the project root.
 *  - extensionless relative imports try `.ts`, `.tsx` and `/index.ts`.
 *
 * Register with `register('./test-hooks/ts-paths.mjs', import.meta.url)` at
 * the top of a test, then load modules with dynamic `import()`.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const SERVER_ONLY = 'muqabala-test:server-only';

function withExtension(filePath) {
  if (path.extname(filePath) && existsSync(filePath)) return filePath;
  for (const candidate of [`${filePath}.ts`, `${filePath}.tsx`, path.join(filePath, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') return { url: SERVER_ONLY, shortCircuit: true };

  if (specifier.startsWith('@/')) {
    const resolved = withExtension(path.join(projectRoot, specifier.slice(2)));
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }

  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = path.dirname(fileURLToPath(context.parentURL));
    const resolved = withExtension(path.resolve(base, specifier));
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === SERVER_ONLY) return { format: 'module', source: 'export {};', shortCircuit: true };
  return nextLoad(url, context);
}
