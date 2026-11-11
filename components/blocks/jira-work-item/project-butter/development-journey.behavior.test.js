const assert = require("node:assert/strict");
const test = require("node:test");
const { act } = require("react");
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
	assert.equal(view.queryByRole("button", { name: /0\/3 builds passed/u }) !== null, true);
	assert.equal(projectButterDevelopmentChecks("pr").some((check) => check.status === "running"), true);
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "failed" });
	assert.equal(view.queryByRole("button", { name: /2\/3 builds passed · 1 failed/u }) !== null, true);
	assert.equal(projectButterDevelopmentChecks("failed").find((check) => check.id === "accessibility").status, "failed");
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "fixing", agentName: "Claude" });
	assert.equal(view.queryByRole("button", { name: /checks running/u }) !== null, true);
	assert.equal(projectButterDevelopmentChecks("fixing").find((check) => check.id === "accessibility").status, "running");
	await view.rerender({ autoFixEnabled: true, autoMergeEnabled: true, phase: "merged" });
	assert.equal(view.queryByRole("button", { name: /Merged/u }) !== null, true);
	assert.equal(view.queryByRole("button", { name: /builds passed/u }) === null, true);
	assert.equal(projectButterDevelopmentChecks("merged").every((check) => check.status === "passed"), true);
	await view.unmount();
});

test("automation changes are controlled and both settings remain available in the dropdown", async () => {
	const changes = [];
	const props = { autoFixEnabled: true, autoMergeEnabled: true, onAutoFixChange: (enabled) => changes.push(["fix", enabled]), onAutoMergeChange: (enabled) => changes.push(["merge", enabled]), phase: "pr" };
	const view = await renderJourney(props);
	await view.click(view.getByRole("button", { name: "Configure", exact: true }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Auto-fix" }));
	await view.click(view.getByRole("menuitemcheckbox", { name: "Merge when ready" }));
	assert.deepEqual(changes, [["fix", false], ["merge", false]]);
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-fix" }).getAttribute("aria-checked"), "true");
	await view.rerender({ ...props, autoFixEnabled: false, autoMergeEnabled: false });
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-fix" }).getAttribute("aria-checked"), "false");
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Merge when ready" }).getAttribute("aria-checked"), "false");
	await view.press(null, "Escape");
	assert.equal(view.queryByRole("button", { name: "Configure", exact: true }) !== null, true);
	await view.unmount();
});

test("PR settings remain available when the first pull request appears", async () => {
	const props = { autoFixEnabled: true, autoMergeEnabled: true, phase: undefined, onAutoFixChange() {}, onAutoMergeChange() {} };
	const view = await renderJourney(props);
	await view.click(view.getByRole("button", { name: "Configure", exact: true }));
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-fix" }).getAttribute("aria-checked"), "true");
	await view.click(view.getByRole("menuitemcheckbox", { name: "Auto-archive on merge or close" }));
	await view.press(null, "Escape");
	await view.rerender({ ...props, phase: "pr" });
	await view.click(view.getByRole("button", { name: "Configure", exact: true }));
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-archive on merge or close" }).getAttribute("aria-checked"), "true");
	await view.unmount();
});

test("read-only settings and absent action capabilities are disabled", async () => {
	const view = await renderJourney({ phase: "failed" });
	assert.equal(view.queryByRole("button", { name: "Fix accessibility check" }), null);
	await view.click(view.getByRole("button", { name: /#284 Add merchant onboarding quickstart/u }));
	assert.equal(view.getByRole("button", { name: "Fix PR" }).disabled, true);
	await view.press(null, "Escape");
	await view.click(view.getByRole("button", { name: "Configure", exact: true }));
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Auto-fix" }).getAttribute("aria-disabled"), "true");
	assert.equal(view.getByRole("menuitemcheckbox", { name: "Merge when ready" }).getAttribute("aria-disabled"), "true");
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
	assert.equal(view.queryByRole("button", { name: "Fix accessibility check" }), null);
	await view.click(view.getByRole("button", { name: /#284 Add merchant onboarding quickstart/u }));
	assert.equal(view.getByRole("button", { name: "Review" }).disabled, false);
	await view.click(view.getByRole("button", { name: "Fix PR" }));
	assert.equal(fixes, 1);
	await view.press(null, "Escape");
	await view.rerender({ autoFixEnabled: false, autoMergeEnabled: false, phase: "passed", onMergePullRequest: () => { merges += 1; } });
	await view.click(view.getByRole("button", { name: "Merge pull request" }));
	assert.equal(merges, 1);
	await view.unmount();
});

test("running checks are shown without a manual completion action", async () => {
	const view = await renderJourney();
	assert.equal(view.queryByRole("button", { name: "Complete checks" }), null);
	assert.equal(view.queryByRole("button", { name: /checks running/u }) !== null, true);
	await view.unmount();
});

test("keyboard users can enter automation and Escape returns focus to its trigger", async () => {
	const view = await renderJourney({ onAutoFixChange() {}, onAutoMergeChange() {} });
	const trigger = view.getByRole("button", { name: "Configure", exact: true });
	await view.focus(trigger);
	await view.press(trigger, "Enter");
	await view.focus(view.getByRole("menuitemcheckbox", { name: "Auto-fix" }));
	assert.equal(view.isFocused(view.getByRole("menuitemcheckbox", { name: "Auto-fix" })), true);
	await view.press(null, "Escape");
	assert.equal(view.isFocused(trigger), true);
	await view.unmount();
});

test("automation settings remain editable after the PR is merged", async () => {
	const changes = [];
	const props = { phase: "merged", autoFixEnabled: true, autoMergeEnabled: true, onAutoFixChange: (enabled) => changes.push(["fix", enabled]), onAutoMergeChange: (enabled) => changes.push(["merge", enabled]) };
	const view = await renderJourney(props);
	await view.click(view.getByRole("button", { name: "Configure", exact: true }));
	const fix = view.getByRole("menuitemcheckbox", { name: "Auto-fix" });
	const merge = view.getByRole("menuitemcheckbox", { name: "Merge when ready" });
	const archive = view.getByRole("menuitemcheckbox", { name: "Auto-archive on merge or close" });
	assert.equal(fix.disabled, false);
	assert.equal(merge.disabled, false);
	assert.equal(archive.disabled, false);
	await view.click(fix);
	await view.click(merge);
	await view.click(archive);
	assert.deepEqual(changes, [["fix", false], ["merge", false]]);
	assert.equal(archive.getAttribute("aria-checked"), "true");
	await view.rerender({ ...props, autoFixEnabled: false, autoMergeEnabled: false });
	assert.equal(fix.getAttribute("aria-checked"), "false");
	assert.equal(merge.getAttribute("aria-checked"), "false");
	await view.unmount();
});

test("the standalone gallery runs the failed check through auto-fix and merge", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/project-butter/project-butter-development-journey.tsx",
		exportName: "ProjectButterDevelopmentGallery",
		props: { author: { name: "Venn", avatarUrl: "/avatar-user/venn/venn.png", assistedBy: { name: "Claude", brandName: "claude" } } },
	});
	const phase = () => view.container.querySelector("[data-project-butter-development]")?.getAttribute("data-project-butter-development");
	const advance = async (ms = 5100) => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); }); };
	assert.equal(phase(), "failed");
	assert.equal(view.queryByRole("button", { name: /2\/3 builds passed · 1 failed/u }) !== null, true);
	await view.click(view.getByRole("button", { name: /#284 Add merchant onboarding quickstart/u }));
	assert.equal(view.queryByRole("group", { name: "Claude, used by Venn" }) !== null, true);
	await view.press(null, "Escape");
	await advance();
	assert.equal(phase(), "fixing");
	await view.click(view.getByRole("button", { name: /#284 Add merchant onboarding quickstart/u }));
	assert.equal(view.getByRole("button", { name: "Fix PR" }).disabled, true);
	assert.equal(view.getByRole("button", { name: "Fix PR" }).getAttribute("aria-busy"), "true");
	await advance();
	assert.equal(phase(), "passed");
	await advance();
	assert.equal(phase(), "merged");
	assert.equal(view.queryByRole("button", { name: /#284 Add merchant onboarding quickstart Merged/u }) !== null, true);
	await view.unmount();
});
