// Local ESLint rules for node:test suites.
//
// no-dom-node-assert (testing.md): when assert.equal and its siblings fail, node:assert inspects both
// values to build the message. For a happy-dom node that walks the whole document; on 18–19 Nov 2026 that
// ran a unit batch out of memory (exit 137, no test name) and cancelled the suite beside it.
//
// "Is a DOM node" is decided from syntax alone, so the rule only reports what is a node whatever the
// types say: a query call (renderComponent's and Testing Library's *By* queries, querySelector, closest,
// getElementById, ...), a DOM-only property (activeElement, parentElement, ...) read off the global
// document or off a value that is itself one of these, an element picked out of such a result (at,
// find, [0], ...), a const bound to any of those, and a call to a same-file helper with no parameters
// that returns one. Anything read off a node (.textContent, .getAttribute(), .length, === null,
// Boolean()) is a plain value and passes. A node that arrives through a function parameter, a let, an
// object property or a helper that takes arguments is not seen.

const ASSERT_METHODS = new Set(["equal", "strictEqual", "notEqual", "notStrictEqual", "deepEqual", "deepStrictEqual"]);
const ASSERT_MODULES = new Set(["assert", "assert/strict", "node:assert", "node:assert/strict"]);
const QUERY_METHOD = /^(get|query|find)(All)?By(Role|Text|LabelText|PlaceholderText|DisplayValue|AltText|Title|TestId)$/u;
const DOM_METHODS = new Set([
	"closest",
	"elementFromPoint",
	"getElementById",
	"getElementsByClassName",
	"getElementsByName",
	"getElementsByTagName",
	"querySelector",
	"querySelectorAll",
]);
// `children` is left out: React elements have props.children too.
const DOM_PROPERTIES = new Set([
	"activeElement",
	"childNodes",
	"documentElement",
	"firstChild",
	"firstElementChild",
	"lastChild",
	"lastElementChild",
	"nextElementSibling",
	"offsetParent",
	"ownerDocument",
	"parentElement",
	"parentNode",
	"previousElementSibling",
]);
// Only off the global document: a response or request also has a body.
const DOCUMENT_PROPERTIES = new Set(["body", "head"]);
// Methods that return an element (or elements) of the collection they are called on.
const SELECTION_METHODS = new Set(["at", "filter", "find", "findLast", "item", "slice"]);
const FUNCTION_TYPES = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);
const TS_WRAPPERS = new Set(["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "TSTypeAssertion"]);

function propertyName(member) {
	if (!member.computed && member.property.type === "Identifier") return member.property.name;
	if (member.computed && member.property.type === "Literal" && typeof member.property.value === "string") return member.property.value;
	return null;
}

function calleeName(callee) {
	if (callee.type === "Identifier") return callee.name;
	if (callee.type === "MemberExpression") return propertyName(callee);
	return null;
}

function findVariable(scope, name) {
	for (let current = scope; current; current = current.upper) {
		const variable = current.set.get(name);
		if (variable) return variable;
	}
	return null;
}

function requireSource(node) {
	if (node?.type !== "CallExpression" || node.callee.type !== "Identifier" || node.callee.name !== "require") return null;
	const [source] = node.arguments;
	return source?.type === "Literal" && typeof source.value === "string" ? source.value : null;
}

function createDomValueCheck(sourceCode) {
	// The single const binding a name resolves to, and the pattern position it holds in that declarator.
	function constInitializer(identifier) {
		const variable = findVariable(sourceCode.getScope(identifier), identifier.name);
		if (!variable || variable.defs.length !== 1) return null;
		const [definition] = variable.defs;
		if (definition.type !== "Variable" || definition.parent.kind !== "const" || !definition.node.init) return null;
		const { id, init } = definition.node;
		if (id.type === "Identifier") return { collection: false, init };
		// const [first] = view.getAllByRole("tab"): an element of a node collection is a node.
		if (id.type === "ArrayPattern" && id.elements.includes(definition.name)) return { collection: true, init };
		return null;
	}

	// The result expression of a same-file helper with no parameters: `const content = () => view.container.querySelector(...)`.
	// Only an expression body or a body with exactly one return; anything that takes arguments is not followed.
	function zeroParameterResult(identifier) {
		const variable = findVariable(sourceCode.getScope(identifier), identifier.name);
		if (!variable || variable.defs.length !== 1) return null;
		const [definition] = variable.defs;
		let fn = null;
		if (definition.type === "FunctionName" && variable.references.every((reference) => !reference.isWrite())) fn = definition.node;
		const init = definition.type === "Variable" && definition.parent.kind === "const" && definition.node.id.type === "Identifier" ? definition.node.init : null;
		if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") fn = init;
		if (!fn || fn.params.length !== 0) return null;
		if (fn.body.type !== "BlockStatement") return fn.body;
		const returns = [];
		const visit = (node) => {
			if (!node || typeof node.type !== "string" || FUNCTION_TYPES.has(node.type)) return;
			if (node.type === "ReturnStatement") returns.push(node);
			for (const key of sourceCode.visitorKeys[node.type] ?? []) {
				const child = node[key];
				if (Array.isArray(child)) child.forEach(visit);
				else visit(child);
			}
		};
		fn.body.body.forEach(visit);
		return returns.length === 1 ? returns[0].argument : null;
	}

	function isGlobalDocument(node) {
		if (node.type !== "Identifier" || node.name !== "document") return false;
		const variable = findVariable(sourceCode.getScope(node), "document");
		return !variable || variable.defs.length === 0;
	}

	function isDomValue(node, seen = new Set()) {
		if (!node || seen.has(node)) return false;
		seen.add(node);
		if (node.type === "AwaitExpression") return isDomValue(node.argument, seen);
		if (node.type === "ChainExpression" || TS_WRAPPERS.has(node.type)) return isDomValue(node.expression, seen);
		if (node.type === "SpreadElement") return isDomValue(node.argument, seen);
		if (node.type === "Identifier") {
			const binding = constInitializer(node);
			return binding !== null && isDomValue(binding.init, seen);
		}
		if (node.type === "CallExpression") {
			const name = calleeName(node.callee);
			if (name === null) return false;
			if (QUERY_METHOD.test(name) || DOM_METHODS.has(name)) return true;
			if (node.callee.type === "Identifier") return isDomValue(zeroParameterResult(node.callee), seen);
			if (node.callee.type !== "MemberExpression") return false;
			if (SELECTION_METHODS.has(name)) return isDomValue(node.callee.object, seen);
			// Array.from(nodeList) without a mapping function.
			const isArrayFrom = name === "from" && node.callee.object.type === "Identifier" && node.callee.object.name === "Array";
			return isArrayFrom && node.arguments.length === 1 && isDomValue(node.arguments[0], seen);
		}
		if (node.type === "MemberExpression") {
			if (node.computed && node.property.type === "Literal" && typeof node.property.value === "number") return isDomValue(node.object, seen);
			const name = propertyName(node);
			if (DOM_PROPERTIES.has(name)) return isGlobalDocument(node.object) || isDomValue(node.object, seen);
			return DOCUMENT_PROPERTIES.has(name) && isGlobalDocument(node.object);
		}
		if (node.type === "LogicalExpression") {
			// `node && node.textContent` is the node only when it is falsy, so only `??` and `||` pass a node on.
			return node.operator === "&&" ? isDomValue(node.right, seen) : isDomValue(node.left, seen) || isDomValue(node.right, seen);
		}
		if (node.type === "ConditionalExpression") return isDomValue(node.consequent, seen) || isDomValue(node.alternate, seen);
		if (node.type === "ArrayExpression") return node.elements.some((element) => isDomValue(element, seen));
		return false;
	}

	return isDomValue;
}

// assert.equal(...), assert.strict.equal(...), t.assert.equal(...), or equal(...) imported from node:assert.
function assertMethodName(callee, sourceCode) {
	if (callee.type === "MemberExpression") {
		const name = propertyName(callee);
		if (!ASSERT_METHODS.has(name)) return null;
		const { object } = callee;
		if (object.type === "Identifier" && object.name === "assert") return name;
		if (object.type === "MemberExpression" && propertyName(object) === "assert") return name;
		if (object.type === "MemberExpression" && propertyName(object) === "strict" && object.object.type === "Identifier" && object.object.name === "assert") return name;
		return null;
	}
	if (callee.type !== "Identifier") return null;
	const variable = findVariable(sourceCode.getScope(callee), callee.name);
	const definition = variable?.defs.length === 1 ? variable.defs[0] : null;
	if (!definition) return null;
	if (definition.type === "ImportBinding") {
		const { node, parent } = definition;
		if (node.type !== "ImportSpecifier" || !ASSERT_MODULES.has(parent.source.value)) return null;
		const imported = node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
		return ASSERT_METHODS.has(imported) ? imported : null;
	}
	if (definition.type === "Variable" && definition.node.id.type === "ObjectPattern" && ASSERT_MODULES.has(requireSource(definition.node.init))) {
		const property = definition.node.id.properties.find((entry) => entry.type === "Property" && entry.value === definition.name);
		const key = property && !property.computed && property.key.type === "Identifier" ? property.key.name : null;
		return ASSERT_METHODS.has(key) ? key : null;
	}
	return null;
}

const noDomNodeAssert = {
	meta: {
		type: "problem",
		docs: {
			description: "Disallow equality asserts on DOM nodes: a failed one prints the whole document and can kill the test run.",
		},
		messages: {
			domNode:
				"assert.{{method}} on a DOM node: when it fails, node:assert prints the whole document and can run the test process out of memory with no test name (testing.md). Assert on a string or boolean instead: assert.equal(view.queryByText(\"x\") === null, true), assert.ok(...) on a boolean, or compare .textContent / .getAttribute(...).",
		},
		schema: [],
	},
	create(context) {
		const { sourceCode } = context;
		const isDomValue = createDomValueCheck(sourceCode);
		return {
			CallExpression(node) {
				const method = assertMethodName(node.callee, sourceCode);
				if (method === null) return;
				// The third argument is the failure message, which node:assert prints as given. A spread in the
				// first two hides which argument is an operand and which the message, so that call is skipped.
				const operands = node.arguments.slice(0, 2);
				if (operands.some((argument) => argument.type === "SpreadElement")) return;
				const domArgument = operands.find((argument) => isDomValue(argument));
				if (domArgument) context.report({ data: { method }, messageId: "domNode", node: domArgument });
			},
		};
	},
};

const plugin = {
	meta: { name: "vpk-tests" },
	rules: {
		"no-dom-node-assert": noDomNodeAssert,
	},
};

export default plugin;
