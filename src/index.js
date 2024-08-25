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

const ClassNode = (name) => ({
	type: 'class',
	name,
	methods: [],
});

const FunctionNode = (name, params = []) => ({
	type: 'function',
	name,
	params,
});


export function createOutline(ast) {
	const outline = [];

	traverse(ast, {
		ClassDeclaration(path) {
			const outlineNode = ClassNode(getName(path.node));
			path.node.outlineNode = outlineNode;
			outline.push(outlineNode);
		},
		ClassMethod(path) {
			const classNode = path.parentPath.parentPath.node.outlineNode;
			const functionNode = FunctionNode(getName(path.node), path.node.params.map(p => ({name: getName(p)})));
			classNode.methods.push(functionNode);
		}
	});

	return outline;
}