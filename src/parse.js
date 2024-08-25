import * as parser from '@babel/parser';

export function parse(source) {
	return parser.parse(source, {
		tokens: true,
		allowImportExportEverywhere: true,
		sourceType: 'module',
		plugins: [
			'typescript',
			'jsx',
		]
	});
}