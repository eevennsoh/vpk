const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

// experimental-v4 and experimental-v5 stay selectable variants, but render the one
// experimental-v3 implementation instead of keeping full copies of its tree.
const source = `
import { ExperimentalV3JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v3/experimental-v3-jira-work-item";
import V4Default, { ExperimentalV4JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v4/experimental-v4-jira-work-item";
import V5Default, { ExperimentalV5JiraWorkItem } from "@/components/blocks/jira-work-item/experimental-v5/experimental-v5-jira-work-item";

export function Probe() {
	const shared = [ExperimentalV4JiraWorkItem, V4Default, ExperimentalV5JiraWorkItem, V5Default]
		.every((surface) => surface === ExperimentalV3JiraWorkItem);
	return <p>{shared ? "shared" : "forked"}</p>;
}
`;

test("experimental-v4 and experimental-v5 entries render the experimental-v3 implementation", async () => {
	const view = await renderComponent({
		source,
		exportName: "Probe",
		mocks: {
			"@/components/blocks/jira-work-item/experimental-v3/experimental-v3-jira-work-item":
				"export function ExperimentalV3JiraWorkItem() { return null; } export default ExperimentalV3JiraWorkItem;",
		},
	});
	assert.equal(view.container.textContent, "shared");
	await view.unmount();
});
