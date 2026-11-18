const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component.js");

test("the conversation context can still scroll to an explicit follow target", async () => {
	const view = await renderComponent({ source: `
		import { useRef } from "react";
		import { Conversation, ConversationContent } from "@/components/ui-custom/conversation";
		export default function Probe() {
			const context = useRef(null);
			return <>
				<Conversation contextRef={context} initial={false} resize={false} followMode="target" targetScrollTop={() => 42}>
					<ConversationContent>Conversation</ConversationContent>
				</Conversation>
				<button onClick={() => context.current?.scrollToBottom({ animation: "instant" })}>Follow target</button>
			</>;
		}
	` });
	const viewport = view.container.querySelector('[data-slot="message-scroller-viewport"]');
	let target = null;
	viewport.scrollTo = (options) => { target = options.top; };
	await view.click(view.getByRole("button", { name: "Follow target" }));
	assert.equal(target, 42);
});

test("custom follow targets yield to reading and resume on request", async (t) => {
	const originalObserver = globalThis.ResizeObserver;
	const observers = [];
	globalThis.ResizeObserver = class {
		constructor(callback) { this.callback = callback; this.elements = []; observers.push(this); }
		observe(element) { this.elements.push(element); }
		unobserve() {}
		disconnect() {}
	};
	t.after(() => { globalThis.ResizeObserver = originalObserver; });
	const view = await renderComponent({ source: `
		import { useRef } from "react";
		import { Conversation, ConversationContent } from "@/components/ui-custom/conversation";
		export default function Probe() {
			const context = useRef(null);
			return <>
				<Conversation contextRef={context} initial={false} resize="instant" followMode="target" targetScrollTop={() => 42}>
					<ConversationContent>Conversation</ConversationContent>
				</Conversation>
				<button onClick={() => context.current?.scrollToBottom({ animation: "instant", ignoreEscapes: true })}>Resume</button>
			</>;
		}
	` });
	const viewport = view.container.querySelector('[data-slot="message-scroller-viewport"]');
	const observer = observers.find((entry) => entry.elements.includes(viewport) && entry.elements.length === 2);
	assert.ok(observer);
	Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 300 });
	Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 100 });
	let target = null;
	viewport.scrollTo = (options) => { target = options.top; };
	observer.callback([]);
	assert.equal(target, 42);
	target = null;
	viewport.dispatchEvent(new Event("wheel"));
	viewport.dispatchEvent(new Event("scroll"));
	observer.callback([]);
	assert.equal(target, null);
	await view.click(view.getByRole("button", { name: "Resume" }));
	target = null;
	observer.callback([]);
	assert.equal(target, 42);
});
