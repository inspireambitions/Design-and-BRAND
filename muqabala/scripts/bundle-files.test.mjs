import test from 'node:test';
import assert from 'node:assert/strict';
import { initialScriptFiles } from './bundle-files.mjs';

test('counts unique scripts and preload hints, decodes brackets and excludes legacy code', () => {
  const html = `<script src="/_next/static/runtime.js" async></script>
    <link rel="preload" as="script" href="/_next/static/runtime.js?dpl=123">
    <script src="/_next/static/polyfill.js" noModule=""></script>
    <link rel="modulepreload" href="/_next/static/%5BroleId%5D/page.js">
    <script src="https://unrelated.example/test.js"></script>
    <link rel="stylesheet" href="/_next/static/layout.css">`;
  assert.deepEqual(initialScriptFiles(html), ['static/runtime.js', 'static/[roleId]/page.js']);
});
test('cannot read a path outside the build directory', () => {
  assert.throws(() => initialScriptFiles('<script src="/_next/static/%2e%2e/%2e%2e/private.js"></script>'));
  assert.deepEqual(initialScriptFiles('<script>window.x = 1</script>'), []);
});
