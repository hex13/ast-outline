import { createOutline } from './index.js';
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
describe('outline', () => {
	it('', () => {
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
});