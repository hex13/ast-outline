import { createOutline, FunctionNode } from './index.js';
import { parse } from './parse.js';
import * as assert from 'assert';

const source = `
class Foo {
	someMethod(a, b, c = 123) {}
	otherMethod() {}
}

class Bar {
	bar1(c) {}
	bar2({ someProp, someOtherProp }) {}
}
`;

const sourceWithDocs = `
class Calculator {
	//@info adds two numbers
	add(a, b) {

	}
	// some comment
	foo() {

	}
	//@animal dog
	doge() {

	}

}
`;
describe('outline', () => {
	it('createOutline', () => {
		const ast = parse(source);
		const outline = createOutline(ast);
		assert.deepStrictEqual(outline, [
			{
				type: 'class', name: 'Foo',
				methods: [
					{type: 'function', name: 'someMethod', params: [{name: 'a'}, {name: 'b'}, {name: 'c'}]},
					{type: 'function', name: 'otherMethod', params: []}
				],
			},
			{
				type: 'class', name: 'Bar',
				methods: [
					{type: 'function', name: 'bar1', params: [{name: 'c'}]},
					{type: 'function', name: 'bar2',
						params: [
							{name: '{ someProp, someOtherProp }'}
						]
					}
				],
			},
		]);
	});
	it('parses docs', () => {
		const ast = parse(sourceWithDocs);
		const outline = createOutline(ast);
		assert.deepStrictEqual(outline, [
			{
				type: 'class', name: 'Calculator', 
				methods: [
					{
						type: 'function', name: 'add', params: [{name: 'a'}, {name: 'b'}],
						meta: {
							info: 'adds two numbers',
						}
					},
					FunctionNode('foo'),
					{...FunctionNode('doge'), meta: {animal: 'dog'}},
				],
			}
		]);
	});

});