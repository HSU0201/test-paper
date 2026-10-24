import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipRegExps: true, skipTemplates: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: ['useEditor'] },
      ],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^(?!\\u0000.*\\.css$)\\u0000'],
            ['^node:'],
            ['^react$', '^react-dom', '^react-konva'],
            ['^@?\\w'],
            ['^'],
            ['^\\.'],
            ['^\\u0000.*\\.css$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
    },
  },
])
