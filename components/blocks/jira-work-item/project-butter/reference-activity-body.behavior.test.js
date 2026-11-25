const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("a wrapping history change keeps its actor tag on the first line instead of centring it on the block", async () => {
	// Regression: the row centred the tag, timestamp and chevron on a two-line action, dropping the tag between lines.
	const view = await renderComponent({
		entry: "components/blocks/jira-work-item/project-butter/reference-activity-body.tsx",
		exportName: "ProjectButterHistoryChange",
		props: {
			actor: { id: "venn", kind: "person", name: "Venn" },
			item: { id: "audit", actor: "Venn", timestamp: "2026-11-25T00:00:00.000Z", icon: "edit", action: "updated description, assignee, due date, parent, labels, components, fix version, story points, and cost center", changes: [] },
			timestamp: "Just now",
		},
	});
	const trigger = view.getByRole("button", { name: /^Venn updated description/u });
	const row = trigger.parentElement;
	const tagTrack = trigger.firstElementChild;
	const action = trigger.lastElementChild;
	assert.equal(row?.classList.contains("items-start"), true, "the row aligns to its first line");
	assert.equal(row?.classList.contains("items-center"), false, "the row must not centre on a wrapped action");
	assert.equal(trigger.classList.contains("items-start"), true, "the tag and action share a top edge");
	assert.equal(["flex", "h-6", "items-center"].every((name) => tagTrack?.classList.contains(name)), true, "the tag centres on the 24px first-line track");
	assert.equal(action?.className.includes("py-[calc((--spacing(6)-1cap)/2)]"), true, "the action's first line centres on the same track");
	assert.equal(row?.querySelector('[data-slot="jira-activity-timestamp"]')?.classList.contains("h-6"), true, "the timestamp stays on the first line");
});
