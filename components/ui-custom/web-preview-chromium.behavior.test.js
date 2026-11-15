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
			return document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "";
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
		assert.match(document.getElementById(preview.viewport.getAttribute("aria-describedby") ?? "")?.textContent ?? "", /Press Tab to leave/u);
		await preview.view.focus(preview.viewport);
		assert.equal(preview.view.isFocused(preview.viewport), true);
		await preview.view.press(null, "Tab");
		await preview.settle();
		assert.equal(preview.focusedName(), "After preview");

		await preview.view.focus(preview.viewport);
		await preview.view.press(null, "Tab", { shiftKey: true });
		await preview.settle();
		// The capture toggle is the viewport's previous tab stop.
		assert.equal(preview.focusedName(), "Capture keys");
		await preview.view.press(null, "Tab", { shiftKey: true });
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

test("Enter on the viewport captures keys, forwards Tab to the page, and Escape releases focus to the host", async () => {
	const preview = await renderChromiumPreview();
	try {
		const toggle = preview.view.getByRole("button", { name: "Capture keys" });
		const status = () => preview.view.getByRole("status").textContent;
		assert.equal(toggle.getAttribute("aria-pressed"), "false");
		assert.equal(status(), "");

		await preview.view.focus(preview.viewport);
		await preview.view.press(null, "Enter");
		assert.equal(toggle.getAttribute("aria-pressed"), "true");
		assert.equal(status(), "Keyboard captured — press Escape to release");
		assert.notEqual(preview.view.queryByText("Keyboard captured · Esc to release"), null);

		await preview.view.press(null, "Tab");
		await preview.view.press(null, "Tab", { shiftKey: true });
		await preview.settle();
		assert.equal(preview.view.isFocused(preview.viewport), true);
		assert.deepEqual(preview.actions, [
			{ action: "press", body: { key: "Tab" } },
			{ action: "press", body: { key: "Shift+Tab" } },
		]);

		await preview.view.press(null, "Escape");
		await preview.settle();
		assert.equal(toggle.getAttribute("aria-pressed"), "false");
		assert.equal(status(), "Keyboard released — press Tab to leave the preview");
		assert.equal(preview.view.queryByText("Keyboard captured · Esc to release"), null);
		assert.equal(preview.view.isFocused(preview.viewport), true);
		// Neither the starting Enter nor the releasing Escape reaches the page.
		assert.equal(preview.actions.length, 2);

		await preview.view.press(null, "Tab");
		assert.equal(preview.focusedName(), "After preview");
	} finally {
		await preview.dispose();
	}
});

test("the capture toggle starts capture in the viewport and a second press releases it", async () => {
	const preview = await renderChromiumPreview();
	try {
		const toggle = preview.view.getByRole("button", { name: "Capture keys" });
		await preview.view.focus(toggle);
		await preview.view.press(null, "Enter");
		assert.equal(toggle.getAttribute("aria-pressed"), "true");
		assert.equal(preview.view.isFocused(preview.viewport), true);

		await preview.view.click(toggle);
		assert.equal(toggle.getAttribute("aria-pressed"), "false");
		assert.equal(preview.view.isFocused(preview.viewport), true);
	} finally {
		await preview.dispose();
	}
});

test("moving focus out of a captured viewport releases capture", async () => {
	const preview = await renderChromiumPreview();
	try {
		await preview.view.focus(preview.viewport);
		await preview.view.press(null, "Enter");
		await preview.view.focus(preview.view.getByRole("button", { name: "After preview" }));
		assert.equal(preview.view.getByRole("button", { name: "Capture keys" }).getAttribute("aria-pressed"), "false");
	} finally {
		await preview.dispose();
	}
});
