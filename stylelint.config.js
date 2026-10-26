export default {
    overrides: [
        {
            files: ['**/*.vue'],
            customSyntax: 'postcss-html',
        },
    ],
    plugins: ['@stylistic/stylelint-plugin'],
    rules: {
        '@stylistic/indentation': 4,
    },
};
