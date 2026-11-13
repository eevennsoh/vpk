// Tag takes `ref` as a regular prop (React 19), not through forwardRef: a ref passed by a
// caller, or merged in by a Base UI `render={<Tag />}` trigger, still lands on the tag's span.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

test("a ref passed to Tag receives the rendered span", async () => {
	const nodes = [];
	const view = await renderComponent({
		entry: "components/ui/tag.tsx",
		exportName: "Tag",
		props: { children: "Design", color: "blue", ref: (node) => nodes.push(node ? `${node.tagName}:${node.textContent}` : null) },
	});
	assert.deepEqual(nodes, ["SPAN:Design"]);
	await view.unmount();
	assert.deepEqual(nodes, ["SPAN:Design", null], "React clears the ref on unmount");
});
