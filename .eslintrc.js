module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  files: ['*.ts', '*.tsx'], // Your TypeScript files extension
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    "@typescript-eslint/no-var-requires": "off"
  },
  root: true,
  env: {
    node: true,
  },
};
