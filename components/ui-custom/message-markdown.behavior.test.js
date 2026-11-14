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

// A stand-in runtime whose import the test settles: a module that exports `then` makes the
// dynamic import adopt it, so each import() call asks `globalThis.__markdownRuntime` how to settle.
const CONTROLLED_RUNTIME = `
const runtime = {
	MessageResponse: ({ children }) => <p data-runtime-message=""><strong>{String(children).replaceAll("**", "")}</strong></p>,
	streamdownComponents: {},
};
export function then(resolve, reject) {
	const control = globalThis.__markdownRuntime;
	control.attempts += 1;
	control.settle(() => resolve(runtime), () => reject(new Error("chunk load failed")));
}
`;
const RUNTIME_MOCKS = { "@/components/ui-custom/message-markdown-runtime": CONTROLLED_RUNTIME };
const PROBE = `
import { MessageResponse } from "@/components/ui-custom/message-markdown";
export default function Probe({ text }) { return <MessageResponse>{text}</MessageResponse>; }
`;

async function settle(view, times = 5) {
	for (let attempt = 0; attempt < times; attempt += 1) {
		await view.rerender(view.lastProps);
	}
}

test("while the runtime loads, the message is a busy box with its text hidden", async () => {
	let finish = null;
	globalThis.__markdownRuntime = { attempts: 0, settle: (resolve) => { finish = resolve; } };
	const view = await renderComponent({ mocks: RUNTIME_MOCKS, props: { text: "Hello **pending**" }, source: PROBE });
	view.lastProps = { text: "Hello **pending**" };
	const pending = view.container.querySelector('[data-message-markdown="pending"]');
	assert.equal(pending?.getAttribute("aria-busy"), "true", view.container.innerHTML);
	assert.ok(pending.className.split(" ").includes("invisible"), "pending text is laid out but not shown");
	assert.equal(view.container.querySelector("[data-runtime-message]"), null);

	finish();
	await settle(view);
	assert.equal(view.container.querySelector('[data-message-markdown="pending"]'), null);
	assert.equal(view.container.querySelector("[aria-busy]"), null);
	assert.equal(view.container.querySelector("[data-runtime-message] strong")?.textContent, "Hello pending");
	assert.equal(globalThis.__markdownRuntime.attempts, 1);
	await view.unmount();
});

test("a failed runtime load shows the text and is retried on the next render, not in a loop", async () => {
	let failuresLeft = 1;
	globalThis.__markdownRuntime = {
		attempts: 0,
		settle: (resolve, reject) => {
			if (failuresLeft > 0) {
				failuresLeft -= 1;
				reject();
				return;
			}
			resolve();
		},
	};
	const view = await renderComponent({ mocks: RUNTIME_MOCKS, props: { text: "first **chunk**" }, source: PROBE });
	view.lastProps = { text: "first **chunk**" };
	await settle(view);
	const unavailable = view.container.querySelector('[data-message-markdown="unavailable"]');
	assert.equal(unavailable?.textContent, "first **chunk**", view.container.innerHTML);
	assert.ok(!unavailable.className.split(" ").includes("invisible"), "the text stays readable");
	assert.equal(unavailable.getAttribute("aria-busy"), null);
	assert.equal(globalThis.__markdownRuntime.attempts, 1, "re-renders with the same props do not refetch");

	view.lastProps = { text: "first **chunk** and more" };
	await settle(view);
	assert.equal(globalThis.__markdownRuntime.attempts, 2);
	assert.equal(view.container.querySelector("[data-message-markdown]"), null, view.container.innerHTML);
	assert.equal(view.container.querySelector("[data-runtime-message] strong")?.textContent, "first chunk and more");
	await view.unmount();
});
