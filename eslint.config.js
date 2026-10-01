import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**', 'scripts/chessboard-element.bundled.js', 'style/materialize.min.js'] },
  js.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.serviceworker } } },
];
