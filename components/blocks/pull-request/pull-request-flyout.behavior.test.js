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
		titleHref: view.queryByRole("link", { name: "SHIL-25: Integrate Pull Request Data" })?.getAttribute("href"),
		numberIsLinked: view.container.querySelector("a")?.textContent.includes("#7") ?? false,
		viewPullRequest: view.queryByRole("link", { name: /^View pull request$/u }) !== null,
		fix: view.queryByRole("button", { name: "Fix PR" }) !== null,
		fixDisabled: view.queryByRole("button", { name: "Fix PR" })?.disabled,
	};
	await view.unmount();
	return snapshot;
}

test("flyout adds the repository and a CI summary row", async () => {
	const { text } = await renderFlyout({});

	assert.match(text, /atlassian\/shilpas-test-repo/u);
	assert.match(text, /3\/3 builds passed/u);
});

test("summary flyout keeps its header and author without the details section", async () => {
	const { text, review, titleHref } = await renderFlyout({ showDetails: false });
	assert.match(text, /#7 SHIL-25: Integrate Pull Request Data/u);
	assert.match(text, /Merged/u);
	assert.match(text, /Shilpa Airi/u);
	assert.match(text, /20d/u);
	assert.doesNotMatch(text, /atlassian\/shilpas-test-repo|SHIL-25-dev-panel|9 files|312|48|builds passed/u);
	assert.equal(review, false);
	assert.equal(titleHref, PROPS.href);
});

test("pull request authors can include an assisting agent across card layouts", async () => {
	for (const variant of ["dropdown", "spacious", "flyout"]) {
		const view = await renderComponent({
			entry: "components/blocks/pull-request/components/pull-request.tsx",
			exportName: "PullRequest",
			mocks: THEME_MOCK,
			props: { ...PROPS, variant, author: { name: "Venn", avatarUrl: "/avatar-user/venn/venn.png", assistedBy: { name: "Claude", brandName: "claude" } } },
		});
		assert.equal(view.queryByRole("group", { name: "Claude, used by Venn" }) !== null, true, variant);
		await view.unmount();
	}
});

test("development rows show the four pull request status icons and colors", async () => {
	const statuses = ["Draft", "Open", "Merged", "Failed"];
	const view = await renderComponent({
		entry: "components/blocks/development-panel/development-panel.tsx",
		exportName: "DevelopmentPanel",
		mocks: THEME_MOCK,
		props: {
			workItem: { code: "PAY-1", summary: "Work", description: "" },
			pullRequests: statuses.map((status, index) => ({ number: index + 1, title: "Example", status, additions: 0, deletions: 0 })),
		},
	});
	const rows = statuses.map((status, index) => {
		const button = view.getByRole("button", { name: `#${index + 1} Example ${status}` });
		const icon = button.querySelector('[data-slot="icon"]');
		return {
			classes: icon?.className,
			paths: [...button.querySelectorAll("svg path")].map((path) => path.getAttribute("d")),
		};
	});
	await view.unmount();
	assert.match(rows[0].classes, /text-icon-accent-gray/u);
	assert.match(rows[1].classes, /text-icon-accent-lime/u);
	assert.match(rows[2].classes, /text-icon-accent-purple/u);
	assert.match(rows[3].classes, /text-icon-danger/u);
	assert.deepEqual(rows[0].paths, rows[1].paths);
	assert.notDeepEqual(rows[2].paths, rows[1].paths);
	assert.notDeepEqual(rows[3].paths, rows[2].paths);
});

test("development rows summarize checks for non-merged pull requests without showing check details", async () => {
	const checks = [
		{ id: "lint", name: "Lint details", status: "passed", details: "Complete" },
		{ id: "test", name: "Test details", status: "running", details: "Running" },
		{ id: "browser", name: "Browser details", status: "queued", details: "Queued" },
	];
	const view = await renderComponent({
		entry: "components/blocks/development-panel/development-panel.tsx",
		exportName: "DevelopmentPanel",
		mocks: THEME_MOCK,
		props: {
			workItem: { code: "PAY-1", summary: "Work", description: "" },
			pullRequests: [
				{ number: 1, title: "Running", status: "Open", checks, additions: 0, deletions: 0 },
				{ number: 2, title: "Merged", status: "Merged", checks, additions: 0, deletions: 0 },
				{ number: 3, title: "No checks", status: "Draft", additions: 0, deletions: 0 },
				{ number: 4, title: "Failed", status: "Failed", checks: [{ ...checks[0], status: "failed" }], additions: 0, deletions: 0 },
			],
		},
	});
	const running = view.getByRole("button", { name: /#1 Running/u });
	const merged = view.getByRole("button", { name: /#2 Merged/u });
	const noChecks = view.getByRole("button", { name: /#3 No checks/u });
	const failed = view.getByRole("button", { name: /#4 Failed/u });
	assert.match(running.textContent, /1\/3 builds passed/u);
	assert.match(running.textContent, /checks running/u);
	assert.doesNotMatch(running.textContent, /Lint details|Test details|Browser details/u);
	assert.doesNotMatch(merged.textContent, /builds? passed/u);
	assert.doesNotMatch(noChecks.textContent, /builds? passed/u);
	assert.match(failed.textContent, /0\/1 build passed · 1 failed/u);
	assert.equal(running.querySelectorAll("button").length, 0);
	await view.unmount();
});

test("flyout displays every pull request status", async () => {
	for (const status of ["Draft", "Open", "Merged", "Failed"]) {
		const { text } = await renderFlyout({ status });
		assert.match(text, new RegExp(status, "u"));
	}
});

test("Jira pull request icons and flyouts agree on each status", async () => {
	for (const [status, triggerLabel, cardStatus] of [
		["failed", "Pull request failed", "Failed"],
		["open", "Pull request", "Open"],
		["merged", "Pull request merged", "Merged"],
		[undefined, "Pull request", "Open"],
	]) {
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/pull-request-cluster.tsx",
			exportName: "JiraIssuePullRequestCluster",
			mocks: THEME_MOCK,
			props: { pullRequestNumber: 7, pullRequestTitle: "Example", pullRequestStatus: status, usesStrokeChrome: true },
		});
		await view.click(view.getByRole("button", { name: `${triggerLabel} #7: Example` }));
		const card = view.getByRole("group", { name: "Pull request #7: Example" });
		assert.equal(card.textContent.includes(cardStatus), true);
		await view.unmount();
	}
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

test("a non-expandable CI summary keeps full pull request details without a disclosure", async () => {
	const view = await renderComponent({
		entry: "components/blocks/pull-request/components/pull-request.tsx",
		exportName: "PullRequest",
		mocks: THEME_MOCK,
		props: { ...PROPS, checksExpandable: false },
	});
	assert.match(view.container.textContent, /atlassian\/shilpas-test-repo/u);
	assert.match(view.container.textContent, /SHIL-25-dev-panel/u);
	assert.match(view.container.textContent, /9 files/u);
	assert.match(view.container.textContent, /3\/3 builds passed/u);
	assert.equal(view.queryByRole("button", { name: /builds? passed/u }) === null, true);
	assert.doesNotMatch(view.container.textContent, /Guest checkout browser tests/u);
	await view.unmount();
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

test("flyout title links to the pull request and review remains optional", async () => {
	const both = await renderFlyout({});
	assert.deepEqual([both.review, both.titleHref, both.viewPullRequest, both.fix], [true, PROPS.href, false, false]);
	assert.equal(both.numberIsLinked, false);

	const viewOnly = await renderFlyout({ reviewHref: undefined });
	assert.deepEqual([viewOnly.review, viewOnly.titleHref, viewOnly.viewPullRequest], [false, PROPS.href, false]);

	const none = await renderFlyout({ reviewHref: undefined, href: undefined });
	assert.deepEqual([none.review, none.titleHref, none.viewPullRequest], [false, undefined, false]);
});

test("Fix PR appears for failed checks and passes only failures to the handler", async () => {
	const checks = [
		{ id: "lint", name: "Lint", status: "failed", details: "Failed" },
		{ id: "unit", name: "Unit", status: "passed", details: "Passed" },
	];
	const fixed = [];
	const withoutHandler = await renderFlyout({ checks, status: "Open" });
	assert.equal(withoutHandler.fix, true);
	assert.equal(withoutHandler.fixDisabled, true);
	assert.equal((await renderFlyout({ checks, status: "Open", showFix: false })).fix, false);
	assert.equal((await renderFlyout({ checks, status: "Merged" })).fix, false);
	const view = await renderComponent({
		entry: "components/blocks/pull-request/components/pull-request.tsx",
		exportName: "PullRequest",
		mocks: THEME_MOCK,
		props: { ...PROPS, status: "Open", checks, onFix: (failed) => fixed.push(failed) },
	});
	await view.click(view.getByRole("button", { name: "Fix PR" }));
	assert.deepEqual(fixed, [[checks[0]]]);
	await view.rerender({ ...PROPS, status: "Open", checks: [{ ...checks[0], status: "running" }], isFixing: true, onFix: (failed) => fixed.push(failed) });
	const fixingButton = view.getByRole("button", { name: "Fix PR" });
	assert.equal(fixingButton.disabled, true);
	assert.equal(fixingButton.getAttribute("aria-busy"), "true");
	assert.equal(fixingButton.querySelector('[data-slot="spinner"]') !== null, true);
	await view.rerender({ ...PROPS, status: "Open", checks: [{ ...checks[0], status: "passed" }] });
	assert.equal(view.queryByRole("button", { name: "Fix PR" }) === null, true);
	await view.rerender({ ...PROPS, status: "Merged", checks: [{ ...checks[0], status: "passed" }], onFix: (failed) => fixed.push(failed) });
	assert.equal(view.queryByRole("button", { name: "Fix PR" }), null);
	await view.unmount();
});

test("the review placeholder remains enabled when no review destination is available", async () => {
	const view = await renderComponent({
		entry: "components/blocks/pull-request/components/pull-request.tsx",
		exportName: "PullRequest",
		mocks: THEME_MOCK,
		props: { ...PROPS, reviewHref: undefined, showReview: true },
	});
	assert.equal(view.getByRole("button", { name: "Review" }).disabled, false);
	await view.click(view.getByRole("button", { name: "Review" }));
	await view.unmount();
});

test("flyout stays a container when an activation callback is supplied", async () => {
	const view = await renderComponent({
		entry: "components/blocks/pull-request/components/pull-request.tsx",
		exportName: "PullRequest",
		mocks: THEME_MOCK,
		props: { ...PROPS, onActivate: () => undefined },
	});
	const link = view.getByRole("link", { name: "SHIL-25: Integrate Pull Request Data" });
	assert.equal(link.closest("button") === null, true);
	assert.equal(link.getAttribute("target"), "_blank");
	await view.unmount();
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
