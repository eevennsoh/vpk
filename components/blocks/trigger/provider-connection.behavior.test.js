const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

// Two Slack triggers prove the connection is provider-wide; the hourly schedule never needs one.
function probe(dialog) {
	return `import { useState } from "react";
	import { ThemeWrapper } from "@/components/utils/theme-wrapper";
	import { ${dialog} } from "@/components/blocks/trigger/page";
	import { createAgentAutomationRule, createAgentTriggerValue } from "@/components/blocks/trigger/data/trigger-catalog";
	const RULE = createAgentAutomationRule({
		id: "rule-1",
		name: "Slack follow-up",
		triggers: [
			{ ...createAgentTriggerValue("scheduled", "every-hour", 1), connectionState: "connected" },
			{ ...createAgentTriggerValue("slack", "new-message", 2), connectionState: "needs-connection" },
			{ ...createAgentTriggerValue("slack", "new-message", 3), connectionState: "needs-connection" },
		],
	});
	export default function ConnectionProbe({ onConnectTrigger }) {
		const [open, setOpen] = useState(true);
		return <ThemeWrapper>
			<${dialog} automationRule={RULE} onConnectTrigger={onConnectTrigger} onOpenChange={setOpen} onSave={() => {}} open={open} />
		</ThemeWrapper>;
	}`;
}

async function advance(context, ms) {
	let elapsed = 0;
	do {
		const slice = Math.min(100, ms - elapsed);
		await React.act(async () => {
			context.mock.timers.tick(slice);
		});
		elapsed += slice;
	} while (elapsed < ms);
}

const countText = (text) => [...document.body.querySelectorAll("span")].filter((node) => node.textContent.trim() === text).length;

for (const dialog of ["TriggerAutomationDialog", "TriggerConfigAutomationDialog"]) {
	test(`${dialog}: connecting a provider spins its triggers for 1.2 s, then connects them all`, async (context) => {
		context.mock.timers.enable({ apis: ["setTimeout"] });
		const connected = [];
		const view = await renderComponent({ props: { onConnectTrigger: (trigger) => connected.push(trigger.providerId) }, source: probe(dialog) });
		assert.equal(countText("Requires connection"), 2);
		const [connect] = view.getAllByRole("button", { name: "Connect" });
		await view.click(connect);
		assert.deepEqual(connected, ["slack"], "the host hears about the connect at once");
		assert.equal(countText("Connecting"), 2, "both Slack triggers spin together");
		assert.equal(countText("Requires connection"), 0);
		await advance(context, 1_100);
		assert.equal(countText("Connecting"), 2);
		await advance(context, 100);
		assert.equal(countText("Connecting"), 0);
		assert.equal(countText("Requires connection"), 0, "both Slack triggers are connected");
		assert.equal(view.queryByRole("button", { name: "Connect" }), null);
	});

	test(`${dialog}: unmounting mid-connection leaves no timer behind`, async (context) => {
		context.mock.timers.enable({ apis: ["setTimeout"] });
		const view = await renderComponent({ props: {}, source: probe(dialog) });
		await view.click(view.getAllByRole("button", { name: "Connect" })[0]);
		await view.unmount();
		await advance(context, 5_000);
		assert.equal(document.body.textContent.includes("Connecting"), false);
	});
}
