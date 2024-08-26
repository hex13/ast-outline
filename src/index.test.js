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
					FunctionNode('someMethod', [{name: 'a'}, {name: 'b'}, {name: 'c'}]),
					FunctionNode('otherMethod'),
				],
			},
			{
				type: 'class', name: 'Bar',
				methods: [
					FunctionNode('bar1', [{name:'c'}]),
					FunctionNode('bar2', [{name: '{ someProp, someOtherProp }'}]),
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
					{...FunctionNode('add', [{name: 'a'}, {name: 'b'}]), meta: {info: 'adds two numbers'}},
					FunctionNode('foo'),
					{...FunctionNode('doge'), meta: {animal: 'dog'}},
				],
			}
		]);
	});

	it('functions', () => {
		const source = `
			function foo123() {

			}
			function bar456(a, b) {

			}
		`;
		const ast = parse(source);
		const outline = createOutline(ast);
		assert.deepStrictEqual(outline, [
			FunctionNode('foo123'),
			FunctionNode('bar456', [{name: 'a'}, {name: 'b'}]),
		]);
	});

	it('loc information for functions', () => {
		const source = `
			function foo123() {

			}
		`;
		const ast = parse(source);
		let node, loc;

		node = ast.program.body[0];
		assert.deepStrictEqual(node.type, 'FunctionDeclaration');
		assert.ok(node.loc);
		loc = structuredClone(node.loc);

		const outline = createOutline(ast, {loc: true});
		assert.deepStrictEqual(outline, [
			{...FunctionNode('foo123'), loc},
		]);
	});

});