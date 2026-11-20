const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

test("timeline keyboard navigation selects a row and previews its label", async () => {
	const view = await renderComponent({
		source: `import React from "react";
			import {useMotionValue} from "motion/react";
			import {JiraWorkItemTimeline} from "@/components/blocks/jira-work-item-timeline";
			const rows = [
				{id:"one",kind:"event",actor:{id:"a",name:"Annie",kind:"person"},timestamp:"Today",segments:[{type:"text",text:"created the work item"}]},
				{id:"two",kind:"event",actor:{id:"b",name:"Liam",kind:"person"},timestamp:"Yesterday",segments:[{type:"text",text:"updated the status"}]},
			];
			export default function Example() {
				const [selected,setSelected] = React.useState("one");
				const progress = useMotionValue(0);
				return <JiraWorkItemTimeline rows={rows} visibleId={selected} progress={progress} onSelect={setSelected} onSeek={()=>{}} />;
			}`,
	});
	const first = view.getByRole("option", { name: /Annie: created the work item/u });
	await view.focus(first);
	await view.press(first, "ArrowRight");
	const second = view.getByRole("option", { name: /Liam: updated the status/u });
	assert.equal(second.getAttribute("aria-selected"), "true");
	assert.equal(view.isFocused(second), true);
	assert.equal(document.querySelector("[data-jira-work-item-timeline-preview]")?.textContent.endsWith("Yesterday"), true);
});
