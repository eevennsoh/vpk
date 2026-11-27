const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("Butter timestamps keep compact relative time visible and reveal details on focus", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/project-butter/activity-comment-tools.tsx",
		exportName: "ProjectButterTimestamp",
		props: { item: { id: "comment", kind: "comment", actor: { id: "annie", name: "Annie Cook", kind: "person" }, body: [], timestamp: "45 minutes ago", createdAtMs: Date.UTC(2026, 10, 1, 15) } },
	});
	const trigger = document.querySelector('[tabindex="0"]');
	assert.equal(trigger.querySelector("time").textContent, "45m");
	assert.equal(trigger.querySelector("time").getAttribute("datetime"), "2026-11-01T15:00:00.000Z");
	await view.focus(trigger);
	const tooltip = view.getByRole("tooltip");
	assert.equal(tooltip.textContent.startsWith("Last run "), true);
	assert.equal(trigger.getAttribute("aria-describedby"), tooltip.id);
	assert.equal(tooltip.textContent.includes("45 minutes ago"), true);
	assert.equal(tooltip.textContent.includes("Nov 1, 2026"), true);
	await view.click(trigger);
	assert.equal(trigger.textContent, "45m");
});

test("Butter timestamps show relative time for an absolute date label", async () => {
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/project-butter/activity-comment-tools.tsx",
		exportName: "ProjectButterTimestamp",
		props: { item: { timestamp: "17 Aug 2026 at 04:10", createdAtMs: Date.UTC(2026, 10, 1, 15) } },
	});
	const trigger = document.querySelector('[tabindex="0"]');
	assert.equal(trigger.textContent.includes("17 Aug 2026"), false);
	assert.equal(trigger.querySelector("time").dateTime, new Date("17 Aug 2026 04:10").toISOString());
	await view.focus(trigger);
	assert.equal(view.getByRole("tooltip").textContent.includes("Aug 17, 2026"), true);
});
