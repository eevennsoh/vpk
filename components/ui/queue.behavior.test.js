const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const SOURCE = `
import { Queue, QueueSection, QueueSectionContent, QueueSectionTrigger } from "@/components/ui/queue";

export default function Demo() {
	return (
		<Queue variant="inline">
			<QueueSection defaultOpen={false}>
				<QueueSectionTrigger disabled aria-label="2 to do" data-testid="trigger">
					2 to do
				</QueueSectionTrigger>
				<QueueSectionContent>Write tests</QueueSectionContent>
			</QueueSection>
		</Queue>
	);
}
`;

test("the inline Queue trigger keeps the button props it is given", async () => {
	const view = await renderComponent({ source: SOURCE });
	const trigger = view.container.querySelector("[data-testid=trigger]");
	assert.equal(trigger !== null, true, "the trigger forwards data attributes");
	assert.equal(trigger.getAttribute("aria-label"), "2 to do");
	assert.equal(trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true", true, "disabled reaches the trigger");
	await view.click(trigger);
	assert.equal(trigger.getAttribute("aria-expanded"), "false", "a disabled trigger does not open the section");
});
