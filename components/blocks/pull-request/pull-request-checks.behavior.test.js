// Behavioral contract for the CI checks permutation gallery, rendered for real
// in happy-dom. Each scenario is the flyout's expandable checks row, opened.
// Assertions compare strings and numbers, never DOM nodes: a failed assert on
// a node can hang the runner.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const IDS = ["queued", "running", "in-progress", "passed", "failed"];

async function renderGallery() {
	return renderComponent({
		entry: "components/blocks/pull-request/checks-page.tsx",
		mocks: {
			"@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false, actualTheme: "light" }; }`,
		},
	});
}

function section(view, id) {
	return view.container.querySelector(`[data-checks-scenario="${id}"]`);
}

function count(view, id, selector) {
	return section(view, id)?.querySelectorAll(selector).length ?? -1;
}

test("gallery shows every CI check state", async () => {
	const view = await renderGallery();
	const text = (id) => section(view, id)?.textContent ?? "";

	assert.match(text("queued"), /Waiting for CI/u);
	assert.match(text("running"), /Running for/u);
	assert.match(text("passed"), /418 tests in 2m 46s/u);
	assert.match(text("failed"), /Failed after 42s/u);
	await view.unmount();
});

test("each summary counts passed checks and calls out failures", async () => {
	const view = await renderGallery();
	const summary = (id) => section(view, id)?.querySelector("button[aria-expanded]")?.textContent ?? "";

	assert.deepEqual(IDS.map(summary), [
		"0/3 builds passed",
		"0/3 builds passed",
		"1/3 builds passed",
		"3/3 builds passed",
		"2/3 builds passed · 1 failed",
	]);
	await view.unmount();
});

test("every scenario starts expanded so its rows are visible", async () => {
	const view = await renderGallery();

	assert.deepEqual(
		IDS.map((id) => section(view, id)?.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded")),
		["true", "true", "true", "true", "true"],
	);
	assert.deepEqual(IDS.map((id) => count(view, id, "li")), [3, 3, 3, 3, 3]);
	await view.unmount();
});

test("the summary draws a status ring unless a check is running, and running checks draw spinners", async () => {
	const view = await renderGallery();
	const rings = (id) => count(view, id, '[data-slot="progress-circle"]');
	const spinners = (id) => count(view, id, '[role="status"]');

	// Rows use the golden-journey glyphs (check-circle, error diamond, dashed circle),
	// so the summary is the only ring, and it gives way to a spinner while any check runs.
	assert.deepEqual(IDS.map(rings), [1, 0, 0, 1, 1]);
	// Spinners: one per running row, plus the summary spinner while any check runs.
	assert.deepEqual(IDS.map(spinners), [0, 4, 2, 0, 0]);
	await view.unmount();
});

test("checks are read-only status lines with no Fix action or link glyph", async () => {
	const view = await renderGallery();

	assert.deepEqual(IDS.map((id) => count(view, id, 'button[aria-label^="Fix "]')), [0, 0, 0, 0, 0]);
	assert.deepEqual(IDS.map((id) => count(view, id, ".rich-text-command-menu-shortcut")), [0, 0, 0, 0, 0]);
	assert.deepEqual(IDS.map((id) => count(view, id, "[data-jira-work-item-failed-check-actions]")), [0, 0, 0, 0, 0]);
	await view.unmount();
});
