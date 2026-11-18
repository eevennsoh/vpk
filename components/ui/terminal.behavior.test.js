const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SOURCE = `
import { Terminal } from "@/components/ui/terminal";

export default function Demo() {
	return <Terminal defaultOpen output={"\\u001b[31merror\\u001b[0m: build failed\\nplain line\\n"} />;
}
`;

// The highlighter loads asynchronously; re-render until it has replaced the plain lines.
async function waitFor(view, predicate, timeoutMs = 5000) {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			return false;
		}
		await view.rerender({});
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	return true;
}

test("Terminal decodes ANSI escape sequences instead of printing them", async () => {
	const view = await renderComponent({ source: SOURCE });
	const content = () => view.container.querySelector("[data-slot=terminal-content] [data-slot=code-block-content]");
	assert.notEqual(content(), null, "the open terminal renders its output");
	assert.equal(content().getAttribute("data-language"), "ansi");

	const lines = () => [...content().querySelectorAll("[data-slot=code-block-line]")];
	assert.equal(lines().length, 2, "each output line renders as a code block line");

	const decoded = await waitFor(view, () => !content().textContent.includes("[31m"));
	assert.equal(decoded, true, `escape fragments are still visible: ${JSON.stringify(content().textContent)}`);
	assert.equal(content().textContent.includes("\u001b"), false, "no raw escape characters remain");
	assert.match(lines()[0].textContent, /^error: build failed$/u);
	assert.equal(lines()[1].textContent, "plain line");
});
