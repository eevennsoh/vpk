const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderStatus() {
	return renderComponent({
		source: `import React from "react";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			import { ProjectButterStatus } from "@/components/blocks/jira-work-item/project-butter/project-butter-status";
			import { useProjectButterContent } from "@/components/blocks/jira-work-item/project-butter/use-project-butter-content";
			export default function StatusTest() {
				const content = useProjectButterContent("filled");
				return <ThemeWrapper><ProjectButterStatus content={content} /><ProjectButterStatus appearance="field" content={content} /></ThemeWrapper>;
			}`,
	});
}

test("status changes reuse the controlled circle and synchronize the header and Details", async () => {
	const view = await renderStatus();
	const initialCircle = view.getByRole("button", { name: "Change status, In progress" }).querySelector('[data-slot="progress-circle"]');
	assert.equal(initialCircle?.getAttribute("aria-valuenow"), "50");
	assert.equal(initialCircle.querySelector('[data-slot="progress-circle-dashes"]').style.animationPlayState, "running");
	let currentStatus = "In progress";
	for (const [status, progress] of [["To do", "0"], ["In progress", "50"], ["Done", "100"], ["To do", "0"]]) {
		await view.click(view.getByRole("button", { name: `Change status, ${currentStatus}` }));
		assert.equal(view.queryByRole("menuitem", { name: currentStatus }) === null, true);
		const option = view.getByRole("menuitem", { name: status });
		assert.equal(option.querySelector('[data-slot="progress-circle"]')?.getAttribute("aria-valuenow"), progress);
		if (status !== "Done") {
			assert.equal(option.querySelector('[data-slot="progress-circle-dashes"]').style.animationPlayState, "paused");
		}
		assert.equal(option.querySelector('[data-slot="lozenge"]') === null, true);
		await view.click(option);
		const headerCircle = view.getByRole("button", { name: `Change status, ${status}` }).querySelector('[data-slot="progress-circle"]');
		const detailsCircle = view.getByRole("button", { name: `Change status in details, ${status}` }).querySelector('[data-slot="progress-circle"]');
		assert.equal(headerCircle === initialCircle, true);
		assert.equal(headerCircle?.getAttribute("aria-valuenow"), progress);
		assert.equal(detailsCircle?.getAttribute("aria-valuenow"), progress);
		if (status !== "Done") {
			assert.equal(headerCircle.querySelector('[data-slot="progress-circle-dashes"]').style.animationPlayState, "running");
			assert.equal(detailsCircle.querySelector('[data-slot="progress-circle-dashes"]').style.animationPlayState, "running");
		}
		if (status === "To do") {
			assert.equal(headerCircle.querySelector('[data-slot="progress-circle-dashes"]').classList.contains("text-icon-subtlest"), true);
			assert.equal(detailsCircle.querySelector('[data-slot="progress-circle-dashes"]').classList.contains("text-icon-subtlest"), true);
		}
		currentStatus = status;
	}
});

test("filled progress circles use the subtlest icon color at zero", async () => {
	const view = await renderComponent({
		entry: "components/ui-custom/progress-circle.tsx",
		exportName: "ProgressCircle",
		props: { value: 0, variant: "filled", dashed: true },
	});
	assert.equal(view.getByRole("progressbar").querySelector('[data-slot="progress-circle-dashes"]').classList.contains("text-icon-subtlest"), true);
	await view.rerender({ value: 50, variant: "filled", dashed: true, colorByProgress: true });
	assert.equal(view.getByRole("progressbar").querySelector('[data-slot="progress-circle-dashes"]').classList.contains("text-icon-information"), true);
});

test("custom review status uses the review progress state and can be renamed", async () => {
	const view = await renderStatus();
	await view.click(view.getByRole("button", { name: "Change status, In progress" }));
	await view.click(view.getByRole("menuitem", { name: "Create status" }));
	await view.fill(view.getByRole("textbox", { name: "Status name" }), "In review");
	await view.click(view.getByRole("button", { name: "Create and apply" }));
	const reviewCircle = view.getByRole("button", { name: "Change status, In review" }).querySelector('[data-slot="progress-circle"]');
	assert.equal(reviewCircle?.getAttribute("aria-valuenow"), "75");
	await view.click(view.getByRole("button", { name: "Change status in details, In review" }));
	await view.click(view.getByRole("menuitem", { name: "Edit status" }));
	await view.fill(view.getByRole("textbox", { name: "Status name" }), "Waiting for approval");
	await view.click(view.getByRole("button", { name: "Save status" }));
	assert.equal(view.queryByRole("button", { name: "Change status, Waiting for approval" }) !== null, true);
	assert.equal(view.queryByRole("button", { name: "Change status in details, Waiting for approval" }) !== null, true);
});
