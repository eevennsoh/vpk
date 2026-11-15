const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const React = require("react");
const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const READY_STATE = {
	ready: true, title: "Example", url: "https://example.com/",
	viewportWidth: 1280, viewportHeight: 900, canGoBack: false, canGoForward: false,
};

async function renderWebPreview(defaultUrl) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response(JSON.stringify(READY_STATE), {
		status: 200, headers: { "Content-Type": "application/json" },
	});
	const view = await renderComponent({
		source: `import { WebPreview, WebPreviewBody, WebPreviewNavigation, WebPreviewNavigationButton, WebPreviewUrl } from "@/components/ui-custom/web-preview";
			export default function Host({ defaultUrl }) {
				return (
					<WebPreview defaultUrl={defaultUrl}>
						<WebPreviewNavigation>
							<WebPreviewNavigationButton action="back" tooltip="Back"><svg aria-hidden="true" /></WebPreviewNavigationButton>
							<WebPreviewNavigationButton action="reload" tooltip="Reload"><svg aria-hidden="true" /></WebPreviewNavigationButton>
							<WebPreviewNavigationButton tooltip="Open in new tab" aria-label="Open example in new tab"><svg aria-hidden="true" /></WebPreviewNavigationButton>
							<WebPreviewUrl />
						</WebPreviewNavigation>
						<WebPreviewBody />
					</WebPreview>
				);
			}`,
		props: { defaultUrl },
	});
	await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	return {
		view,
		engine: () => (view.container.querySelector("iframe") ? "iframe" : view.container.querySelector("[aria-busy]") ? "chromium" : "none"),
		async dispose() {
			await view.unmount();
			globalThis.fetch = originalFetch;
		},
	};
}

test("auto engine renders full http(s) URLs in the Chromium preview, like bare hosts", async () => {
	for (const url of ["https://example.com", "https://www.theverge.com/tech?x=1", "example.com/path"]) {
		const preview = await renderWebPreview(url);
		try {
			assert.equal(preview.engine(), "chromium", url);
		} finally {
			await preview.dispose();
		}
	}
});

test("auto engine keeps relative and malformed URLs in the iframe", async () => {
	for (const url of ["/preview/home", "https://", "not a url"]) {
		const preview = await renderWebPreview(url);
		try {
			assert.equal(preview.engine(), "iframe", url);
		} finally {
			await preview.dispose();
		}
	}
});

test("icon-only navigation buttons are named by their tooltip unless given an explicit label", async () => {
	const preview = await renderWebPreview("/preview/home");
	try {
		const names = preview.view.getAllByRole("button").map((button) => button.getAttribute("aria-label"));
		assert.deepEqual(names, ["Back", "Reload", "Open example in new tab"]);
	} finally {
		await preview.dispose();
	}
});

test("the web-preview catalog page puts only the External URL demo on the shared Chromium session", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response(JSON.stringify(READY_STATE), {
		status: 200, headers: { "Content-Type": "application/json" },
	});
	const view = await renderComponent({
		source: `import WebPreviewDemo, { WebPreviewDemoBasic, WebPreviewDemoExternal, WebPreviewDemoFullscreen, WebPreviewDemoUrlChange, WebPreviewDemoWithConsole } from "@/components/website/demos/ui-custom/web-preview-demo";
			const demos = { WebPreviewDemo, WebPreviewDemoBasic, WebPreviewDemoExternal, WebPreviewDemoFullscreen, WebPreviewDemoUrlChange, WebPreviewDemoWithConsole };
			export default function Host() {
				return <div>{Object.entries(demos).map(([name, Demo]) => <section key={name} data-demo={name}><Demo /></section>)}</div>;
			}`,
	});
	try {
		await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
		const chromiumDemos = Array.from(view.container.querySelectorAll("[data-demo]"))
			.filter((section) => section.querySelector("[aria-busy]"))
			.map((section) => section.getAttribute("data-demo"));
		assert.deepEqual(chromiumDemos, ["WebPreviewDemoExternal"]);
	} finally {
		await view.unmount();
		globalThis.fetch = originalFetch;
	}
});
