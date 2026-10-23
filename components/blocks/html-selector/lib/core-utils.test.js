const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
	buildAncestryChain,
	buildSelectorPath,
	getComposedTarget,
	isReviewUiEvent,
	resolveVarChain,
	splitSharedAndLocalCss,
	truncateOuterHtml,
} = require(path.join(process.cwd(), ".agents/skills/vpk-html/assets/selector/core-utils.js"));

function createElement({
	tagName,
	id = "",
	className = "",
	children = [],
} = {}) {
	const element = {
		tagName,
		localName: tagName.toLowerCase(),
		id,
		className,
		children,
		parentElement: null,
	};
	element.classList = className ? className.split(/\s+/u) : [];
	for (const child of children) {
		child.parentElement = element;
	}
	return element;
}

function attachDocument(root, selectorMap = new Map()) {
	const ownerDocument = {
		querySelectorAll(selector) {
			return selectorMap.get(selector) ?? [];
		},
	};

	function visit(node) {
		node.ownerDocument = ownerDocument;
		for (const child of node.children ?? []) {
			visit(child);
		}
	}

	visit(root);
	return ownerDocument;
}

test("buildSelectorPath prefers a unique id selector", () => {
	const target = createElement({ tagName: "section", id: "hero" });
	attachDocument(target, new Map([["#hero", [target]]]));

	assert.equal(buildSelectorPath(target), "#hero");
});

test("buildSelectorPath prefers a unique tag and class combo before nth-of-type", () => {
	const target = createElement({ tagName: "article", className: "card featured" });
	attachDocument(target, new Map([["article.card.featured", [target]]]));

	assert.equal(buildSelectorPath(target), "article.card.featured");
});

test("buildSelectorPath falls back to an nth-of-type chain", () => {
	const first = createElement({ tagName: "li" });
	const second = createElement({ tagName: "li" });
	const list = createElement({ tagName: "ul", children: [first, second] });
	const body = createElement({ tagName: "body", children: [list] });
	const html = createElement({ tagName: "html", children: [body] });
	attachDocument(html);

	assert.equal(
		buildSelectorPath(second),
		"html:nth-of-type(1) > body:nth-of-type(1) > ul:nth-of-type(1) > li:nth-of-type(2)",
	);
});

test("buildAncestryChain returns a root-first capped element chain", () => {
	const heading = createElement({ tagName: "h1", className: "title" });
	const hero = createElement({ tagName: "section", id: "hero", children: [heading] });
	const main = createElement({ tagName: "main", children: [hero] });
	const body = createElement({ tagName: "body", children: [main] });
	const html = createElement({ tagName: "html", children: [body] });
	attachDocument(html);

	const chain = buildAncestryChain(heading, 3);

	assert.deepEqual(chain.map((entry) => entry.tagSummary), [
		"main",
		"section#hero",
		"h1.title",
	]);
	assert.equal(chain[2].element, heading);
});

test("splitSharedAndLocalCss separates sentinel-delimited design-system CSS", () => {
	const css = [
		"body { color: black; }",
		"/* vpk-shared:start */",
		":root { --brand: red; }",
		"/* vpk-shared:end */",
		"h1 { color: var(--brand); }",
	].join("\n");

	assert.deepEqual(splitSharedAndLocalCss(css), {
		hasSharedBlock: true,
		shared: "\n:root { --brand: red; }\n",
		local: "body { color: black; }\n\nh1 { color: var(--brand); }",
	});
});

test("splitSharedAndLocalCss treats missing sentinels as page-local CSS", () => {
	assert.deepEqual(splitSharedAndLocalCss("h1 { color: red; }"), {
		hasSharedBlock: false,
		shared: "",
		local: "h1 { color: red; }",
	});
});

test("resolveVarChain follows nested custom property references", () => {
	const chain = resolveVarChain("--brand", {
		"--brand": "var(--accent-primary)",
		"--accent-primary": "var(--blue-500)",
		"--blue-500": "#2563eb",
	});

	assert.deepEqual(chain, [
		{ name: "--brand", value: "var(--accent-primary)" },
		{ name: "--accent-primary", value: "var(--blue-500)" },
		{ name: "--blue-500", value: "#2563eb" },
	]);
});

test("truncateOuterHtml caps long snippets with an ASCII suffix", () => {
	const snippet = truncateOuterHtml({ outerHTML: "<div>" + "x".repeat(40) + "</div>" }, 24);

	assert.equal(snippet.length, 24);
	assert.ok(snippet.endsWith("..."));
});

function fakeNode(attributes = {}) {
	return {
		nodeType: 1,
		hasAttribute(name) {
			return Object.prototype.hasOwnProperty.call(attributes, name);
		},
	};
}

test("T-SEL1 getComposedTarget returns composedPath()[0] and falls back to target", () => {
	const textarea = fakeNode();
	const host = fakeNode({ "data-vpk-review-ui": "" });
	const retargeted = { target: host, composedPath: () => [textarea, host] };
	assert.equal(getComposedTarget(retargeted), textarea);
	const textNode = { nodeType: 3 };
	assert.equal(getComposedTarget({ target: host, composedPath: () => [textNode, host] }), host);
	assert.equal(getComposedTarget({ target: host }), host);
	assert.equal(getComposedTarget(null), null);
});

test("T-SEL2 isReviewUiEvent is true when the composed path holds the review UI host", () => {
	const host = fakeNode({ "data-vpk-review-ui": "" });
	const button = fakeNode();
	assert.equal(isReviewUiEvent({ composedPath: () => [button, host, fakeNode()] }), true);
	assert.equal(isReviewUiEvent({ composedPath: () => [fakeNode({ "data-vpk-review": "" })] }), false);
	assert.equal(isReviewUiEvent({ target: host }), false);
	assert.equal(isReviewUiEvent({ composedPath: () => [{ nodeType: 9 }] }), false);
});
