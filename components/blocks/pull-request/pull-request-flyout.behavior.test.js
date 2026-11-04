// Behavioral contract for the PullRequest flyout, rendered for real in
// happy-dom. The flyout adds the repo name, an expandable CI checks row, and the Review / View
// pull request actions on top of the existing branch path and diff metrics.
// Assertions compare strings and booleans, never DOM nodes: a failed assert on
// a node can hang the runner.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const THEME_MOCK = {
	"@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false, actualTheme: "light" }; }`,
};

const PROPS = {
	variant: "flyout",
	number: 7,
	title: "SHIL-25: Integrate Pull Request Data",
	status: "Merged",
	provider: "bitbucket",
	author: { name: "Shilpa Airi" },
	repository: "atlassian/shilpas-test-repo",
	reviewers: { approved: 0, total: 1 },
	branch: "SHIL-25-dev-panel",
	targetBranch: "main",
	additions: 312,
	deletions: 48,
	filesChanged: 9,
	relativeTime: "20d ago",
	checks: [
		{ id: "lint", name: "Lint and typecheck", status: "passed", details: "Completed in 1m 18s" },
		{ id: "unit", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
		{ id: "browser", name: "Guest checkout browser tests", status: "passed", details: "5 scenarios in 1m 32s" },
	],
	href: "https://bitbucket.org/atlassian/shilpas-test-repo/pull-requests/7",
	reviewHref: "https://bitbucket.org/atlassian/shilpas-test-repo/pull-requests/7/review",
};

async function renderFlyout(overrides) {
	const view = await renderComponent({
		entry: "components/blocks/pull-request/components/pull-request.tsx",
		exportName: "PullRequest",
		mocks: THEME_MOCK,
		props: { ...PROPS, ...overrides },
	});
	// Queries read the shared document, so capture everything now and unmount
	// before the next render can leak its own links into the result.
	const snapshot = {
		text: view.container.textContent,
		review: view.queryByRole("link", { name: /^Review$/u }) !== null,
		viewPullRequest: view.queryByRole("link", { name: /^View pull request$/u }) !== null,
	};
	await view.unmount();
	return snapshot;
}

test("flyout adds the repository and a CI summary row", async () => {
	const { text } = await renderFlyout({});

	assert.match(text, /atlassian\/shilpas-test-repo/u);
	assert.match(text, /3\/3 builds passed/u);
});

function trigger(view) {
	return view.getByRole("button", { name: /builds? passed/u });
}

test("the CI summary row expands inline into the full checks list", async () => {
	const view = await renderComponent({
		entry: "components/blocks/pull-request/components/pull-request.tsx",
		exportName: "PullRequest",
		mocks: THEME_MOCK,
		props: { ...PROPS },
	});
	const expandedBefore = trigger(view).getAttribute("aria-expanded");
	await view.click(trigger(view));
	const expandedAfter = trigger(view).getAttribute("aria-expanded");
	const text = view.container.textContent;
	await view.unmount();

	assert.deepEqual([expandedBefore, expandedAfter], ["false", "true"]);
	assert.match(text, /Guest checkout browser tests/u);
	assert.match(text, /5 scenarios in 1m 32s/u);
});

test("the summary reflects failures and in-progress runs", async () => {
	const failed = await renderFlyout({
		checks: [
			{ id: "lint", name: "Lint", status: "failed", details: "Failed after 42s" },
			{ id: "unit", name: "Unit", status: "passed", details: "ok" },
		],
	});
	assert.match(failed.text, /1\/2 builds passed · 1 failed/u);

	const running = await renderFlyout({
		checks: [
			{ id: "lint", name: "Lint", status: "running", details: "Running for 6s" },
			{ id: "unit", name: "Unit", status: "queued", details: "Queued" },
		],
	});
	assert.match(running.text, /0\/2 builds passed/u);
});

test("flyout keeps the branch path, file changes, and author metadata", async () => {
	const { text } = await renderFlyout({});

	assert.match(text, /SHIL-25-dev-panel/u);
	assert.match(text, /main/u);
	assert.match(text, /9 files/u);
	assert.match(text, /\+312/u);
	assert.match(text, /-48/u);
	assert.match(text, /Shilpa Airi/u);
});

test("flyout actions render as links only when their href is supplied", async () => {
	const both = await renderFlyout({});
	assert.deepEqual([both.review, both.viewPullRequest], [true, true]);

	const viewOnly = await renderFlyout({ reviewHref: undefined });
	assert.deepEqual([viewOnly.review, viewOnly.viewPullRequest], [false, true]);

	const none = await renderFlyout({ reviewHref: undefined, href: undefined });
	assert.deepEqual([none.review, none.viewPullRequest], [false, false]);
});

test("flyout omits the repository and builds rows when absent", async () => {
	const { text } = await renderFlyout({ repository: undefined, checks: undefined });

	assert.doesNotMatch(text, /shilpas-test-repo/u);
	assert.doesNotMatch(text, /builds? passed/u);
	assert.match(text, /9 files/u);
});

test("flyout singularizes one build", async () => {
	const { text } = await renderFlyout({
		checks: [{ id: "unit", name: "Unit tests", status: "passed", details: "ok" }],
	});

	assert.match(text, /1\/1 build passed/u);
});

test("the author line ends with the reviewer state", async () => {
	const { text } = await renderFlyout({});

	assert.match(text, /Shilpa Airi·20d·0\/1 reviewer/u);
});

test("reviewer state covers none, partial, and absent", async () => {
	const none = await renderFlyout({ reviewers: { approved: 0, total: 0 } });
	assert.match(none.text, /Shilpa Airi·20d·No reviewers/u);

	const partial = await renderFlyout({ reviewers: { approved: 1, total: 2 } });
	assert.match(partial.text, /·1\/2 reviewers/u);

	const absent = await renderFlyout({ reviewers: undefined });
	assert.doesNotMatch(absent.text, /reviewer/u);
});

test("reviewer state still shows when there is no author", async () => {
	const { text } = await renderFlyout({ author: undefined });

	assert.match(text, /20d · 0\/1 reviewer/u);
});
