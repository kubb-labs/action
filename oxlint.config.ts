import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  rules: {
    'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    'typescript/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
    'typescript/no-explicit-any': 'error',
  },
})
