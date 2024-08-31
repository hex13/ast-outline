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

export const Chain = (els) => els || [];

function inRange(line, column, loc) {
	if (loc.start.line > line || loc.end.line < line) {
		return false;
	}
	if (line == loc.start.line && column < loc.start.column) {
		return false;
	}
	if (line == loc.end.line && column >= loc.end.column) {
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
			if (!node.children || node.children.length == 0) {
				return node;
			}
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

const isExpressionStart = path => {
	return path.key == 'expression' || !isNaN(path.key);
};

export function createOutline(ast, opts = {}) {
	const outline = [];
	const locTrees = [];
	const source = opts.source || '';
	const imports = [];
	const chains = [];
	const intoOutlineNode = (node) => {
		const outlineNode = FunctionNode(getName(node), node.params.map(p => ({name: getName(p)})));
		if (opts.loc) outlineNode.loc = structuredClone(node.loc);
		return outlineNode;
	}

	traverse(ast, {
		ImportDeclaration(path) {
			const { node } = path;
			const what = {};
			node.specifiers.forEach(s => {
				let k;
				if (s.type == 'ImportDefaultSpecifier') {
					k = 'default';
				} else if (s.type == 'ImportNamespaceSpecifier') {
					k = '*';
				} else {
					k = s.imported.name;
				}
				what[k] = s.local.name;
			})
			imports.push({what, from: path.node.source.value});
		},
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
		CallExpression: {
			enter(path) {
				if (path.key == 'expression') chains.push(Chain());
			}
		},
		MemberExpression: {
			enter(path) {
				if (isExpressionStart(path)) {
					chains.push(Chain());
				}
			},
			exit(path) {
 				if (path.key == 'callee') {
					chains.at(-1).at(-1).type = 'call';
				}
			}
		},
		Identifier(path) {
			const chainEl = {name: getName(path.node)};
			if (isExpressionStart(path)) {
				chains.push(Chain([chainEl]));
			} else if (chains.length) {
				if (path.key == 'callee') chainEl.type = 'call';
				chains.at(-1).push(chainEl);
			}
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
					} else if (parentType == 'CallExpression' && path.key == 'callee') {
						LocTree.addTag(locNode, 'call');
					} else if (parentType == 'MemberExpression' && path.key == 'object') {
						LocTree.addTag(locNode, 'name');
					} else if (parentType == 'MemberExpression' && path.key == 'property') {
						if (path.parentPath.key == 'callee' && path.parentPath.parentPath.node.type == 'CallExpression') {
							LocTree.addTag(locNode, 'call');
						} else {
							LocTree.addTag(locNode, 'property');
						}
					} else if (parentType == 'ObjectProperty') {
						LocTree.addTag(locNode, 'name');
					} else if (parentType == 'AssignmentExpression' && path.key == 'left') {
						LocTree.addTag(locNode, 'name');
					} else {
						LocTree.addTag(locNode, 'name');
					}
				}
				locTrees.at(-1).children.push(locNode);
			}
		}
	});

	let lastEnd = 0;

	const locTree = new LocTree(locTrees[0]);
	const tokens = [];
	ast.tokens.forEach(tok => {
		if (tok.start > lastEnd) {
			tokens.push({text: source.slice(lastEnd, tok.start)});
		}
		const locNode = locTree.find(tok.loc.start.line, tok.loc.start.column);
		tokens.push({
			start: tok.start, end: tok.end,
			originalToken: tok,
			text: source.slice(tok.start, tok.end),
			tags: locNode?.tags,
		});
		lastEnd = tok.end;
	});
	return { imports, outline, locTree, tokens, chains };
}