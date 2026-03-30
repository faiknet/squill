import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['dist', 'node_modules', 'coverage', '.vite', 'supabase'] },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
    },
  },
]
