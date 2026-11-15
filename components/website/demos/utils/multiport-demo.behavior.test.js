const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const React = require("react");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

// Each mocked port mirrors the real composer's order: header control, chat input, composer controls.
// The input is a contenteditable textbox like the live Tiptap composer, and it honours
// autoFocusComposer the way ChatPanel forwards it to the editor's autofocus.
const mocks = {
	"@/app/contexts": `export function RovoChatProvider({ children }) { return children; }`,
	"@/components/projects/sidebar-chat/page": `
		import { useEffect, useRef } from "react";
		let nextPort = 0;
		export default function ChatPanel({ autoFocusComposer = false }) {
			const port = useRef(nextPort++ % 3).current;
			const inputRef = useRef(null);
			useEffect(() => {
				if (autoFocusComposer) inputRef.current?.focus();
			}, [autoFocusComposer]);
			return (
				<section>
					<button type="button">Port {port} header</button>
					<div ref={inputRef} contentEditable role="textbox" tabIndex={0} aria-label="Chat message input" data-port={port} />
					<button type="button">Port {port} send</button>
				</section>
			);
		}
	`,
};

async function renderMultiport() {
	return renderComponent({
		source: `import MultiportDemo from "@/components/website/demos/utils/multiport-demo";
			export default function Host() {
				return <div><MultiportDemo /><button type="button">After demo</button></div>;
			}`,
		mocks,
	});
}

const focusedName = () => document.activeElement?.getAttribute("aria-label") === "Chat message input"
	? `Port ${document.activeElement.getAttribute("data-port")} input`
	: document.activeElement?.textContent || "";

async function settleEffects() {
	await React.act(async () => {});
}

test("multiport focuses the first composer and Tab reaches each port's controls in document order", async () => {
	const view = await renderMultiport();
	try {
		await settleEffects();
		assert.equal(focusedName(), "Port 0 input");
		const reached = [];
		for (let step = 0; step < 7; step += 1) {
			await view.press(null, "Tab");
			reached.push(focusedName());
		}
		assert.deepEqual(reached, [
			"Port 0 send", "Port 1 header", "Port 1 input", "Port 1 send",
			"Port 2 header", "Port 2 input", "Port 2 send",
		]);
		await view.press(null, "Tab");
		assert.equal(focusedName(), "After demo");
	} finally {
		await view.unmount();
	}
});

test("Shift+Tab from the first composer reaches its header instead of wrapping to the last composer", async () => {
	const view = await renderMultiport();
	try {
		await settleEffects();
		assert.equal(focusedName(), "Port 0 input");
		await view.press(null, "Tab", { shiftKey: true });
		assert.equal(focusedName(), "Port 0 header");
	} finally {
		await view.unmount();
	}
});
