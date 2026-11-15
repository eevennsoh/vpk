const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const React = require("react");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const READY_STATE = {
	ready: true, title: "Example", url: "https://example.com/",
	viewportWidth: 1280, viewportHeight: 900, canGoBack: false, canGoForward: false,
};

async function renderChromiumPreview() {
	const actions = [];
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, init = {}) => {
		if (init.method === "POST") {
			actions.push({ action: String(url).split("/").pop(), body: JSON.parse(init.body) });
		}
		return new Response(JSON.stringify(READY_STATE), { status: 200, headers: { "Content-Type": "application/json" } });
	};
	const view = await renderComponent({
		source: `import { ChromiumPreviewBody } from "@/components/ui-custom/web-preview-chromium";
			export default function Host() {
				return (
					<div>
						<button type="button">Before preview</button>
						<ChromiumPreviewBody targetUrl="example.com" onUrlChange={() => {}} />
						<button type="button">After preview</button>
					</div>
				);
			}`,
	});
	const viewport = view.container.querySelector("[aria-busy]");
	await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	actions.length = 0;
	return {
		view, viewport, actions,
		async settle() {
			await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
		},
		focusedName() {
			return document.activeElement?.textContent ?? document.activeElement?.getAttribute("aria-label") ?? "";
		},
		async dispose() {
			await view.unmount();
			globalThis.fetch = originalFetch;
		},
	};
}

test("Tab and Shift+Tab move focus out of the Chromium viewport instead of being forwarded", async () => {
	const preview = await renderChromiumPreview();
	try {
		await preview.view.focus(preview.viewport);
		assert.equal(preview.view.isFocused(preview.viewport), true);
		await preview.view.press(null, "Tab");
		await preview.settle();
		assert.equal(preview.focusedName(), "After preview");

		await preview.view.focus(preview.viewport);
		await preview.view.press(null, "Tab", { shiftKey: true });
		await preview.settle();
		assert.equal(preview.focusedName(), "Before preview");
		assert.deepEqual(preview.actions, []);
	} finally {
		await preview.dispose();
	}
});

test("printable keys, Escape and modified Tab chords still reach the Chromium page", async () => {
	const preview = await renderChromiumPreview();
	try {
		await preview.view.focus(preview.viewport);
		await preview.view.press(null, "a");
		await preview.view.press(null, "Escape");
		await preview.view.press(null, "Tab", { ctrlKey: true });
		await preview.settle();
		assert.deepEqual(preview.actions, [
			{ action: "type", body: { text: "a" } },
			{ action: "press", body: { key: "Escape" } },
			{ action: "press", body: { key: "Control+Tab" } },
		]);
		assert.equal(preview.view.isFocused(preview.viewport), true);
	} finally {
		await preview.dispose();
	}
});
