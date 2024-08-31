import { createOutline, FunctionNode, LocTree, Loc, Chain } from './index.js';
import { parse } from './parse.js';
import * as assert from 'assert';

import Traverse from '@babel/traverse';
const traverse = Traverse.default;


const source = (
`class Foo {
	someMethod(a, b, c = 123) {}
	otherMethod() {}
}

class Bar {
	bar1(c) {}
	bar2({ someProp, someOtherProp }) {}
}
`);

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

function assertLocEquals(actual, expected) {
	try {
		assert.strictEqual(actual.start.line, expected.start.line);
		assert.strictEqual(actual.start.column, expected.start.column);
		assert.strictEqual(actual.end.line, expected.end.line);
		assert.strictEqual(actual.end.column, expected.end.column);
	} catch (e) {
		console.error(`Incorrect loc\nActual: \n`, actual, '\nExpected:\n', expected);
		throw e;
	}
}

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

	it('import with destructuring', () => {
		const source = `
			import { x1, x2, sth as x3 } from 'first';
		`;
		const ast = parse(source);
		const { outline, imports } = createOutline(ast);
		assert.deepStrictEqual(imports, [
			{what: {x1: 'x1', x2: 'x2', sth: 'x3'}, from: 'first'},
		]);
	});

	it('import default', () => {
		const source = `
			import d from 'second';
		`;
		const ast = parse(source);
		const { outline, imports } = createOutline(ast);
		assert.deepStrictEqual(imports, [
			{what: {default: 'd'}, from: 'second'},
		]);
	});

	it('import namespace', () => {
		const source = `
			import * as S from 'third';
		`;
		const ast = parse(source);
		const { outline, imports } = createOutline(ast);
		assert.deepStrictEqual(imports, [
			{what: {'*': 'S'}, from: 'third'},
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
			'function foo() {',
			'}',
			'doSomething()',
			'someObject.blah()',
			'foo(someObject.blah)',
			'const o = {abc: 123}',
			'o.b = 123',
			'foo(abc, def);',
			'foo123',
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
		};
		let outlineNode;

		outlineNode = locTree.find(1, 9);
		assert.equal(outlineNode, undefined);

		outlineNode = locTree.find(2, 3);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.strictEqual(outlineNode.loc.start.line, expectedLoc.start.line);
		assert.strictEqual(outlineNode.loc.start.column, expectedLoc.start.column);
		assert.strictEqual(outlineNode.loc.end.line, expectedLoc.end.line);
		assert.strictEqual(outlineNode.loc.end.column, expectedLoc.end.column);

		assert.deepStrictEqual(outlineNode.tags, {function: true});

		outlineNode = locTree.find(4, 9);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {function: true});

		outlineNode = locTree.find(6, 1);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {call: true});

		outlineNode = locTree.find(7, 1);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {name: true});

		outlineNode = locTree.find(7, 11);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {call: true});

		outlineNode = locTree.find(8, 17);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {property: true});

		outlineNode = locTree.find(9, 12);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {name: true});

		outlineNode = locTree.find(10, 0);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {name: true});

		outlineNode = locTree.find(11, 4);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {name: true});

		outlineNode = locTree.find(12, 0);
		assert.strictEqual(outlineNode.type, 'Identifier');
		assert.deepStrictEqual(outlineNode.tags, {name: true});
	});

	it('generate tokens', () => {
		const source = `function foo() {
			const value = 123;
		}`;
		const ast = parse(source);
		const { outline, locTree, tokens } = createOutline(ast, {loc: true, source});
		assert.strictEqual(tokens.map(t => t.text).join(''), source);
		tokens.forEach(tok => {
			assert.strictEqual(tok.originalToken?.start, tok.start);
			assert.strictEqual(tok.originalToken?.end, tok.end);
		});
	});

	it('assigns tags for function declaration', () => {
		const source = `function foo() {
			const value = 123;
		}`;
		const ast = parse(source);
		const { outline, locTree, tokens } = createOutline(ast, {loc: true, source});

		const functionIdent = tokens[2];
		assert.strictEqual(functionIdent.text, 'foo');
		assert.deepStrictEqual(functionIdent.tags, {function: true});
	});

	it('assigns tags for method declaration', () => {
		const source = `class Foo {
			someMethod() {

			}
		}`;
		const ast = parse(source);
		const { outline, locTree, tokens } = createOutline(ast, {loc: true, source});
		const functionIdent = tokens[6];
		assert.strictEqual(functionIdent.text, 'someMethod');
		assert.deepStrictEqual(functionIdent.tags, {function: true});
	});

	it('chain: single identifiers', () => {
		const source = `foo; moon`;
		const ast = parse(source);
		const { chains } = createOutline(ast, {loc: false, source});
		assert.deepStrictEqual(chains, [
			Chain([{name: 'foo'}]),
			Chain([{name: 'moon'}]),
		]);
	});

	it('chains of member expressions', () => {
		const source = `foo.bar.baz; qwe.rty`;
		const ast = parse(source);
		const { chains } = createOutline(ast, {loc: false, source});
		assert.deepStrictEqual(chains, [
			Chain([{name: 'foo'}, {name: 'bar'}, {name: 'baz'}]),
			Chain([{name: 'qwe'}, {name: 'rty'}]),
		]);
	});
	it('chains: calls', () => {
		const source = `hey(); hello()`;
		const ast = parse(source);
		const { chains } = createOutline(ast, {loc: false, source});
		assert.deepStrictEqual(chains, [
			Chain([{type: 'call', name: 'hey'}]),
			Chain([{type: 'call', name: 'hello'}]),
		]);
	});


	it('chains: methods', () => {
		const source = `someObject.someMethod()`;
		const ast = parse(source);
		const { chains } = createOutline(ast, {loc: false, source});
		assert.deepStrictEqual(chains, [
			Chain([{name: 'someObject'}, {type: 'call', name: 'someMethod'}]),
		]);
	});

	it('chains: methods + member expressions', () => {
		const source = `someObject.someMethod().x.y.z().aa`;
		const ast = parse(source);
		const { chains } = createOutline(ast, {loc: false, source});
		assert.deepStrictEqual(chains, [
			Chain([
				{name: 'someObject'},
				{type: 'call', name: 'someMethod'},
				{name: 'x'},
				{name: 'y'},
				{type: 'call', name: 'z'},
				{name: 'aa'},
			]),
		]);
	});

	it('chains: functions with arguments', () => {
		const source = `alert(foo);alert(abc.def)`;
		const ast = parse(source);
		const { chains } = createOutline(ast, {loc: false, source});
		assert.deepStrictEqual(chains, [
			Chain([{type: 'call', name: 'alert'}]),
			Chain([{name: 'foo'}]),
			Chain([{type: 'call', name: 'alert'}]),
			Chain([{name: 'abc'}, {name: 'def'}]),
		]);
	});

	it('loc for chains', () => {
		[
			[
				`computer`,
				{
					start: {line: 1, column: 0},
					end: {line: 1, column: 8},
				}
			],
			[
				`foo.bar.baz`,
				{
					start: {line: 1, column: 0},
					end: {line: 1, column: 11},
				}
			],
			[
				`doSth()`,
				{
					start: {line: 1, column: 0},
					end: {line: 1, column: 7},
				}
			],
			[
				`console.log()`,
				{
					start: {line: 1, column: 0},
					end: {line: 1, column: 13},
				}
			],
			[
				`console.log(foo.bar.baz)`,
				[
					{
						start: {line: 1, column: 0},
						end: {line: 1, column: 24},
					},
					{
						start: {line: 1, column: 12},
						end: {line: 1, column: 23},
					},
				]
			],
		].forEach(([source, locs]) => {
			const ast = parse(source);
			const { chains } = createOutline(ast, {loc: true, source});
			(Array.isArray(locs)? locs : [locs])
			.forEach((loc, i) => {
				assertLocEquals(chains[i].loc, loc);
			});
		})

	});

});
