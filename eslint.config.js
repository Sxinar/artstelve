import sveltePlugin from 'eslint-plugin-svelte';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import svelteParser from 'svelte-eslint-parser';

export default [

  ...sveltePlugin.configs['flat/recommended'],
  jsxA11y.flatConfigs.recommended,


  {
    files: ['src/**/*.svelte', '**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
    },
    rules: {

      // 'jsx-a11y/alt-text': 'error'
    },
  },

  {
    files: ['src/**/*.js', '**/*.js'],
    rules: {

    },
  },


  {
    ignores: [
      '.svelte-kit/**/*',
      'node_modules/**/*',
      'build/**/*',
      '.vercel/**/*',
      'dist/**/*'
    ],
  }
];
