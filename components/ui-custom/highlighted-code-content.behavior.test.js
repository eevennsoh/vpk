// HighlightedCodeContent fills the ui Code Block with highlighted lines. Shiki loads
// asynchronously, so the first render shows the plain lines; both must keep every line.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { CodeBlock } from "@/components/ui/code-block";
import { HighlightedCodeContent } from "@/components/ui-custom/highlighted-code-content";
export default function Probe({ code, size, lineNumbers }) {
	return (
		<CodeBlock size={size}>
			<HighlightedCodeContent code={code} language="json" lineNumbers={lineNumbers} />
		</CodeBlock>
	);
}
`;

function lineTexts(view) {
	return [...view.container.querySelectorAll('[data-slot="code-block-line"]')].map((line) => line.textContent);
}

test("renders one line per source line and drops a trailing newline", async () => {
	const view = await renderComponent({ props: { code: '{\n  "a": 1\n}\n' }, source: PROBE });
	assert.deepEqual(lineTexts(view), ["{", '  "a": 1', "}"]);
	await view.unmount();
});

test("keeps lines intact while code streams in", async () => {
	const view = await renderComponent({ props: { code: '{\n  "a"' }, source: PROBE });
	await view.rerender({ code: '{\n  "a": 1,\n  "b": 2\n}' });
	assert.deepEqual(lineTexts(view), ["{", '  "a": 1,', '  "b": 2', "}"]);
	await view.unmount();
});

test("scrollable code stays keyboard reachable and tags its language", async () => {
	const view = await renderComponent({ props: { code: "{}" }, source: PROBE });
	const content = view.container.querySelector('[data-slot="code-block-content"]');
	assert.equal(content.getAttribute("tabindex"), "0");
	assert.equal(content.getAttribute("data-language"), "json");
	await view.unmount();
});

test("compact size and line numbers reach the Code Block", async () => {
	const view = await renderComponent({ props: { code: "{}", lineNumbers: true, size: "sm" }, source: PROBE });
	assert.equal(view.container.querySelector('[data-slot="code-block"]').getAttribute("data-size"), "sm");
	assert.equal(view.container.querySelector('[data-slot="code-block-content"]').hasAttribute("data-numbered"), true);
	await view.unmount();
});
