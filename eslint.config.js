import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import stylistic from '@stylistic/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default defineConfig([
    {
        name: 'app/files-to-lint',
        files: ['**/*.{js,mjs,jsx,ts,tsx,vue}'],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
        },
        plugins: {
            stylistic,
        },
        rules: {
            'stylistic/semi': ['error', 'always'],
            'stylistic/comma-dangle': ['error', 'always-multiline'],
            'stylistic/quotes': ['error', 'single', { avoidEscape: true }],
            'stylistic/no-trailing-spaces': 'error',
            'stylistic/eol-last': 'error',
            'stylistic/indent': ['error', 4],
            'stylistic/padded-blocks': ['error', 'never'],
            'stylistic/comma-spacing': 'error',
            'stylistic/operator-linebreak': ['error', 'before'],
            'stylistic/new-parens': 'error',
            'stylistic/max-len': [
                'error',
                {
                    code: 160,
                    ignorePattern: 'd="([\\s\\S]*?)"',
                    ignoreStrings: true,
                    ignoreTemplateLiterals: true,
                },
            ],
            'stylistic/block-spacing': 'error',
            'stylistic/no-multiple-empty-lines': ['error', { max: 1 }],
            'vue/script-indent': [
                'error',
                4,
                {
                    baseIndent: 1,
                },
            ],
            'vue/html-indent': [
                'error',
                4,
                {
                    baseIndent: 1,
                    alignAttributesVertically: false,
                },
            ],
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
    },
    {
        files: ['**/*.vue'],
        languageOptions: {
            parserOptions: {
                parser: tsParser,
            },
        },
        rules: {
            'stylistic/indent': 'off',
        },
    },
    globalIgnores([
        '**/dist/**',
        '**/dist-extension/**',
        '**/dist-ssr/**',
        '**/coverage/**',
        '**/.temp/**',
        '**/.cache/**',
    ]),
    js.configs.recommended,
    ...pluginVue.configs['flat/essential'],
]);
