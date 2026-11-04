const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");
const { projectButterDevelopmentChecks } = require("./development-journey-model.ts");

function renderJourney(props = {}) {
	return renderComponent({
		entry: "components/blocks/jira-work-item/project-butter/project-butter-development-journey.tsx",
		exportName: "ProjectButterDevelopmentJourney",
		props: { autoFixEnabled: true, autoMergeEnabled: true, phase: "pr", ...props },
	});
}

test("the PR journey exposes running checks, the accessibility failure, rerun, and merged results", async () => {
	const view = await renderJourney();
	assert.equal(view.queryByText("Add merchant onboarding quickstart") !== null, true);
	assert.equal(view.queryByText("Pull request created · Checks running") !== null, true);
	assert.equal(projectButterDevelopmentChecks("pr").some((check) => check.status === "running"), true);
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "failed" });
	assert.equal(view.queryByText("2 of 3 checks passed") !== null, true);
	assert.equal(view.queryByText(/Inline errors are not associated with their form fields/u) !== null, true);
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "fixing", agentName: "Claude" });
	assert.equal(view.queryByText(/Claude is fixing the failing check/u) !== null, true);
	assert.equal(projectButterDevelopmentChecks("fixing").find((check) => check.id === "accessibility").status, "running");
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "merged" });
	assert.equal(view.queryByText("All 3 checks passed · Merged") !== null, true);
	assert.equal(view.queryByText("Merchant onboarding quickstart merged into main.") !== null, true);
	assert.equal(projectButterDevelopmentChecks("merged").every((check) => check.status === "passed"), true);
	await view.unmount();
});

test("automation changes are controlled and both settings remain available in the dropdown", async () => {
	const changes = [];
	const props = { autoFixEnabled: true, autoMergeEnabled: true, onAutoFixChange: (enabled) => changes.push(["fix", enabled]), onAutoMergeChange: (enabled) => changes.push(["merge", enabled]), phase: "pr" };
	const view = await renderJourney(props);
	await view.click(view.getByRole("button", { name: "CI checks and automation: Auto-fix & auto-merge enabled" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Auto-fix CI & address comments" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Auto-merge when ready" }));
	assert.deepEqual(changes, [["fix", false], ["merge", false]]);
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-fix CI & address comments" }).getAttribute("aria-checked"), "true");
	await view.rerender({ ...props, autoFixEnabled: false, autoMergeEnabled: false });
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-fix CI & address comments" }).getAttribute("aria-checked"), "false");
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-merge when ready" }).getAttribute("aria-checked"), "false");
	await view.press(null, "Escape");
	assert.equal(view.queryByRole("button", { name: "CI checks and automation: Automation disabled" }) !== null, true);
	await view.unmount();
});

test("read-only settings and absent action capabilities are disabled", async () => {
	const view = await renderJourney({ phase: "failed" });
	assert.equal(view.getByRole("button", { name: "Fix accessibility check" }).disabled, true);
	await view.click(view.getByRole("button", { name: "CI checks and automation: Auto-fix & auto-merge enabled" }));
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-fix CI & address comments" }).getAttribute("aria-disabled"), "true");
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-merge when ready" }).getAttribute("aria-disabled"), "true");
	assert.equal(view.queryByRole("button", { name: "Fix Accessibility" }), null);
	await view.press(null, "Escape");
	await view.rerender({ autoFixEnabled: false, autoMergeEnabled: false, phase: "passed" });
	assert.equal(view.getByRole("button", { name: "Merge pull request" }).disabled, true);
	await view.unmount();
});

test("manual fix and merge actions call the journey host", async () => {
	let fixes = 0;
	let merges = 0;
	const view = await renderJourney({ phase: "failed", autoFixEnabled: false, onFixCheck: () => { fixes += 1; } });
	await view.click(view.getByRole("button", { name: "Fix accessibility check" }));
	assert.equal(fixes, 1);
	await view.rerender({ autoFixEnabled: false, autoMergeEnabled: false, phase: "passed", onMergePullRequest: () => { merges += 1; } });
	await view.click(view.getByRole("button", { name: "Merge pull request" }));
	assert.equal(merges, 1);
	await view.unmount();
});

test("running checks can be completed from the open work item only when the host supplies that action", async () => {
	let completions = 0;
	const view = await renderJourney();
	assert.equal(view.queryByRole("button", { name: "Complete checks" }), null);
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "pr", onFailChecks: () => { completions += 1; } });
	await view.click(view.getByRole("button", { name: "Complete checks" }));
	assert.equal(completions, 1);
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "failed", onFailChecks: () => { completions += 1; } });
	assert.equal(view.queryByRole("button", { name: "Complete checks" }), null);
	await view.unmount();
});

test("keyboard users can enter automation and Escape returns focus to its trigger", async () => {
	const view = await renderJourney({ onAutoFixChange() {}, onAutoMergeChange() {} });
	const trigger = view.getByRole("button", { name: "CI checks and automation: Auto-fix & auto-merge enabled" });
	await view.focus(trigger);
	await view.press(trigger, "ArrowDown");
	assert.equal(view.isFocused(view.getByRole("menuitemcheckbox", { name: "Auto-fix CI & address comments" })), true);
	await view.press(null, "ArrowDown");
	assert.equal(view.isFocused(view.getByRole("menuitemcheckbox", { name: "Auto-merge when ready" })), true);
	await view.press(null, "Escape");
	assert.equal(view.isFocused(trigger), true);
	await view.unmount();
});

test("a merged PR keeps its automation settings read-only", async () => {
	let changes = 0;
	const view = await renderJourney({ phase: "merged", onAutoFixChange: () => { changes += 1; }, onAutoMergeChange: () => { changes += 1; } });
	await view.click(view.getByRole("button", { name: "CI checks and automation: Auto-fix & auto-merge enabled" }));
	const fix = view.getByRole("menuitemcheckbox", { name: "Auto-fix CI & address comments" });
	const merge = view.getByRole("menuitemcheckbox", { name: "Auto-merge when ready" });
	assert.equal(fix.getAttribute("aria-disabled"), "true");
	assert.equal(merge.getAttribute("aria-disabled"), "true");
	await view.click(fix);
	await view.click(merge);
	assert.equal(changes, 0);
	await view.unmount();
});
