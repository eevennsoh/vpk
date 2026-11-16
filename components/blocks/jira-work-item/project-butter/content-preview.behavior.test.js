const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

function renderPreview() {
	return renderComponent({
		source: `import React, { useState } from "react";
			import { ProjectButterContentPreview } from "@/components/blocks/jira-work-item/project-butter/content-preview";
			export default function PreviewProbe() {
				const [expanded, setExpanded] = useState(false);
				return <ProjectButterContentPreview expanded={expanded} label="description" onExpandedChange={setExpanded}><button type="button">Edit description</button><p>Long description</p></ProjectButterContentPreview>;
			}`,
	});
}

async function measureOverflow(scrollHeight) {
	const preview = document.querySelector("[id]");
	Object.defineProperties(preview, { clientHeight: { configurable: true, value: 160 }, scrollHeight: { configurable: true, value: scrollHeight } });
	await React.act(async () => {
		preview.dispatchEvent(new Event("scroll"));
		await new Promise((resolve) => requestAnimationFrame(resolve));
	});
}

test("a short description has no disclosure, and an overflowing description expands and collapses", async () => {
	const view = await renderPreview();
	await measureOverflow(100);
	assert.equal(view.queryByRole("button", { name: "Show more description" }), null);
	await measureOverflow(320);
	const more = view.getByRole("button", { name: "Show more description" });
	assert.equal(more.getAttribute("aria-expanded"), "false");
	assert.equal(document.getElementById(more.getAttribute("aria-controls")) !== null, true);
	await view.click(more);
	assert.equal(view.getByRole("button", { name: "Show less description" }).getAttribute("aria-expanded"), "true");
	await view.click(view.getByRole("button", { name: "Show less description" }));
	assert.equal(view.getByRole("button", { name: "Show more description" }).getAttribute("aria-expanded"), "false");
});

test("focusing content expands the preview before editing", async () => {
	const view = await renderPreview();
	await measureOverflow(320);
	await view.focus(view.getByRole("button", { name: "Edit description" }));
	assert.equal(view.getByRole("button", { name: "Show less description" }).getAttribute("aria-expanded"), "true");
	assert.equal(view.isFocused(view.getByRole("button", { name: "Edit description" })), true);
});
