// Behavioral contract for the PullRequest flyout, rendered for real in
// happy-dom. The flyout adds the repo name, builds, and the Review / View
// pull request actions on top of the existing branch path and diff metrics.
// Assertions compare strings and booleans, never DOM nodes: a failed assert on
// a node can hang the runner.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROPS = {
	variant: "flyout",
	number: 7,
	title: "SHIL-25: Integrate Pull Request Data",
	status: "Merged",
	provider: "bitbucket",
	author: { name: "Shilpa Airi" },
	repository: "atlassian/shilpas-test-repo",
	branch: "SHIL-25-dev-panel",
	targetBranch: "main",
	additions: 312,
	deletions: 48,
	filesChanged: 9,
	relativeTime: "20d ago",
	builds: { passed: 3, total: 3 },
	href: "https://bitbucket.org/atlassian/shilpas-test-repo/pull-requests/7",
	reviewHref: "https://bitbucket.org/atlassian/shilpas-test-repo/pull-requests/7/review",
};

async function renderFlyout(overrides) {
	const view = await renderComponent({
		entry: "components/blocks/pull-request/components/pull-request.tsx",
		exportName: "PullRequest",
		mocks: {
			"@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false, actualTheme: "light" }; }`,
		},
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

test("flyout adds the repository and builds rows", async () => {
	const { text } = await renderFlyout({});

	assert.match(text, /atlassian\/shilpas-test-repo/u);
	assert.match(text, /3\/3 builds passed/u);
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
	const { text } = await renderFlyout({ repository: undefined, builds: undefined });

	assert.doesNotMatch(text, /shilpas-test-repo/u);
	assert.doesNotMatch(text, /builds? passed/u);
	assert.match(text, /9 files/u);
});

test("flyout singularizes one build", async () => {
	const { text } = await renderFlyout({ builds: { passed: 1, total: 1 } });

	assert.match(text, /1\/1 build passed/u);
});
