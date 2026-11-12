const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const source = `
import { TerminalStageJiraPane } from "@/components/projects/jira-golden-journey-v1/components/terminal-stage-jira-pane";
import { JIRA_GOLDEN_JOURNEY_V1_TERMINAL_STORY } from "@/components/projects/jira-golden-journey-v1/data/terminal-demo-script";

const pane = { transcript: [], promptDraft: "", working: false };
const items = [{ key: "PAY-1", title: "Billing", summary: "Carry the artwork", status: "working", age: "2m" }];

export function Harness({ dashboardVisible }) {
	return <TerminalStageJiraPane pane={pane} items={items} dashboardVisible={dashboardVisible} activeStep={null} revealCount={0} selectedKey={null} story={JIRA_GOLDEN_JOURNEY_V1_TERMINAL_STORY} />;
}
`;

for (const dashboardVisible of [false, true]) {
	test(`the Jira pane's scroll region is keyboard reachable (${dashboardVisible ? "dashboard" : "shell"})`, async () => {
		const view = await renderComponent({ source, exportName: "Harness", props: { dashboardVisible } });
		const region = view.getByRole("region", { name: "Jira terminal" });
		assert.equal(region.getAttribute("tabindex"), "0");
		assert.deepEqual(view.tabOrder(), ["Jira terminal"]);
		await view.unmount();
	});
}
