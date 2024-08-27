import Traverse from '@babel/traverse';
const traverse = Traverse.default;

const getName = node => {
	if (node.type == 'ObjectPattern') {
		return '{ ' + node.properties.map(p => getName(p)).join(', ') + ' }';
	}
	if (node.name) {
		return node.name;
	}
	if (node.key) {
		return node.key.name;
	}
	if (node.id) {
		return node.id.name;
	}
	if (node.left) {
		return node.left.name;
	}
	return '???';
}

export const ClassNode = (name) => ({
	type: 'class',
	name,
	methods: [],
});

export const FunctionNode = (name, params = []) => ({
	type: 'function',
	name,
	params,
});

function inRange(line, column, loc) {
	if (loc.start.line > line || loc.end.line < line) {
		return false;
	}
	if (line == loc.start.line && column < loc.start.column) {
		return false;
	}
	if (line == loc.end.line && column > loc.end.column) {
		return false;
	}
	return true;
}

export class LocTree {
	constructor(data) {
		this.data = data;
	}
	find(line, column) {
		const _search = (node) => {
			const { start, end } = node.loc;
			if (!node.children || node.children.length == 0) return node;
			const ch = node.children.find(ch => {
				return inRange(line, column, ch.loc);
			});
			if (ch) return _search(ch);
		};
		return _search(this.data);
	}
	static addTag(locNode, tag) {
		locNode.tags = locNode.tags || {};
		locNode.tags[tag] = true;
	}
}
export function Loc(start, end) {
	return {
		start,
		end,
	};
}

export function createOutline(ast, opts = {}) {
	const outline = [];
	const locTrees = [];
	const intoOutlineNode = (node) => {
		const outlineNode = FunctionNode(getName(node), node.params.map(p => ({name: getName(p)})));
		if (opts.loc) outlineNode.loc = structuredClone(node.loc);
		return outlineNode;
	}

	traverse(ast, {
		ClassDeclaration(path) {
			const outlineNode = ClassNode(getName(path.node));
			path.node.outlineNode = outlineNode;
			outline.push(outlineNode);

		},
		ClassMethod(path) {
			const classNode = path.parentPath.parentPath.node.outlineNode;
			const functionNode = intoOutlineNode(path.node)
			classNode.methods.push(functionNode);
			if (path.node.leadingComments) {
				path.node.leadingComments.forEach(c => {
					const match = c.value.match(/^@(\w+) +(.*)/);
					if (match) {
						functionNode.meta = functionNode.meta || {};
						functionNode.meta[match[1]] = match[2];
					}
				});
			}
		},
		FunctionDeclaration(path) {
			const functionNode = intoOutlineNode(path.node);
			outline.push(functionNode);
		},
		enter(path) {
			const locNode = {
				type: path.node.type,
				loc: path.node.loc, children: []
			};
			locTrees.push(locNode);
		},
		exit(path) {
			if (locTrees.length > 1) {
				const locNode = locTrees.pop();

				if (path.node.type == 'Identifier') {
					const parentType = path.parentPath.node.type;
					if (
						parentType == 'ClassMethod' ||
						parentType == 'FunctionDeclaration'
					) {
						LocTree.addTag(locNode, 'function');
					}
				}
				locTrees.at(-1).children.push(locNode);
			}
		}
	});
	return { outline, locTree: new LocTree(locTrees[0]) };
}