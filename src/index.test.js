import { createOutline, FunctionNode, LocTree, Loc } from './index.js';
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

describe('LocTree', () => {
	it('.find()', () => {
		const locTree = new LocTree({
			loc: Loc({ line: 1, column: 1}, { line: 15, column: 4}),
			children: [
				{
					loc: Loc({ line: 1, column: 1}, { line: 6, column: 1}),
				},
				{
					loc: Loc({ line: 6, column: 2}, { line: 15, column: 12}),
					children: [
						{ loc: Loc({ line: 7, column: 3}, { line: 7, column: 12}) },
						{ id: 'prev', loc: Loc({ line: 8, column: 1}, { line: 8, column: 2}) },
						{ id: 'cactus', loc: Loc({ line: 8, column: 3}, { line: 8, column: 12}) },
						{ id: 'blah', loc: Loc({ line: 10, column: 5}, { line: 11, column: 13}) },
						{ id: 'rose', loc: Loc({ line: 11, column: 16}, { line: 13, column: 6}) },
					]
				},
				{
					loc: Loc({ line: 15, column: 13}, { line: 15, column: 4}),
				},
			],
		});
		assert.strictEqual(locTree.find(8, 5).id, 'cactus');
		assert.strictEqual(locTree.find(11, 17).id, 'rose');
	});
});

describe('outline', () => {
	it('createOutline', () => {
		const ast = parse(source);
		const { outline } = createOutline(ast);
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
		const { outline } = createOutline(ast);
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
		const { outline } = createOutline(ast);
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

		const { outline } = createOutline(ast, {loc: true});
		assert.deepStrictEqual(outline, [
			{...FunctionNode('foo123'), loc},
		]);
	});

	it('assigns LocTree', () => {
		const source = [
			'class Foo {',
			'someMethod() {}',
			'}',
		].join('\n');
		const ast = parse(source);
		const { outline, locTree } = createOutline(ast, {loc: true});

		const expectedLoc = {
			start: {
				line: 2,
				column: 0,
			},
			end: {
				line: 2,
				column: 10,
			}
		}
		const outlineNode = locTree.find(2, 3);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.strictEqual(outlineNode.loc.start.line, expectedLoc.start.line);
		assert.strictEqual(outlineNode.loc.start.column, expectedLoc.start.column);
		assert.strictEqual(outlineNode.loc.end.line, expectedLoc.end.line);
		assert.strictEqual(outlineNode.loc.end.column, expectedLoc.end.column);
	});

});
