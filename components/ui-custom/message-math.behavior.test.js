const assert = require("node:assert/strict");
const test = require("node:test");

function renderMath(math, value) {
	const [rehype, options] = math.rehypePlugin;
	const tree = {
		type: "root",
		children: [{
			type: "element",
			tagName: "code",
			properties: { className: ["math-inline"] },
			children: [{ type: "text", value }],
		}],
	};
	rehype(options)(tree, {
		message(message) {
			throw new Error(message);
		},
	});

	const nodes = [];
	function visit(node) {
		nodes.push(node);
		for (const child of node.children ?? []) {
			visit(child);
		}
	}
	visit(tree);

	return {
		hasMathML: nodes.some((node) => node.tagName === "math"),
		hasUnsafeLink: nodes.some((node) =>
			String(node.properties?.href ?? "").startsWith("javascript:")),
		text: nodes.filter((node) => node.type === "text")
			.map((node) => node.value).join(""),
	};
}

test("message math plugin renders fractions as accessible MathML", async () => {
	const { math } = await import("@streamdown/math");
	const result = renderMath(math, String.raw`\frac{1}{3}`);

	assert.equal(result.hasMathML, true);
	assert.equal(result.text.includes("1"), true);
	assert.equal(result.text.includes("3"), true);
});

test("message math plugin rejects inherited trust when rendering links", async () => {
	const { math } = await import("@streamdown/math");
	const previousTrust = Object.getOwnPropertyDescriptor(Object.prototype, "trust");

	try {
		Object.defineProperty(Object.prototype, "trust", {
			configurable: true,
			writable: true,
			value: true,
		});
		const result = renderMath(math, String.raw`\href{javascript:alert(1)}{x}`);

		assert.equal(result.hasMathML, true);
		assert.equal(result.hasUnsafeLink, false);
	} finally {
		if (previousTrust) {
			Object.defineProperty(Object.prototype, "trust", previousTrust);
		} else {
			delete Object.prototype.trust;
		}
	}
});
