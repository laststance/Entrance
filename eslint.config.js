import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'out', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Main/preload run in Node, not the browser.
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'electron.vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // shadcn-generated ui files export variants alongside components by design.
    files: ['src/renderer/src/components/ui/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
