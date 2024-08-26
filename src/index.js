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


export function createOutline(ast, opts = {}) {
	const outline = [];

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
		}
	});

	return outline;
}