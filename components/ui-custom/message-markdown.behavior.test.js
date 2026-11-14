// MessageResponse loads the Streamdown runtime on first render and then shows the formatted
// message; the proxied streamdownComponents forward to the runtime's component of the same name.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

test("MessageResponse renders the markdown once the runtime has loaded", async () => {
	const view = await renderComponent({
		source: `
import { MessageResponse } from "@/components/ui-custom/message-markdown";
export default function Probe() { return <MessageResponse>{"Hello **bold words**"}</MessageResponse>; }
`,
	});
	for (let attempt = 0; attempt < 20 && !view.container.innerHTML.includes("bold words</"); attempt += 1) {
		await view.rerender({});
	}
	const html = view.container.innerHTML;
	assert.ok(!html.includes('data-message-markdown="pending"'), html.slice(0, 400));
	assert.ok(/<(strong|span)[^>]*>bold words<\//u.test(html), html.slice(0, 400));
	assert.ok(!html.includes("**bold words**"), "raw markdown is not shown");
	await view.unmount();
});

test("every proxied Streamdown component name matches the runtime's component map", async () => {
	const view = await renderComponent({
		source: `
import { streamdownComponents as proxied } from "@/components/ui-custom/message-markdown";
import { streamdownComponents as runtime } from "@/components/ui-custom/message-markdown-runtime";
export default function Probe() { return <pre>{JSON.stringify([Object.keys(proxied).sort(), Object.keys(runtime).sort()])}</pre>; }
`,
	});
	const [proxied, runtime] = JSON.parse(view.container.querySelector("pre").textContent);
	assert.ok(runtime.length > 10);
	assert.deepEqual(proxied, runtime);
	await view.unmount();
});
