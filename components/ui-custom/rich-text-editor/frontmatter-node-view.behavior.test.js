const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

test("frontmatter tool removal names each string chip once and removes only that tool", async () => {
	const view = await renderComponent({
		source: `
import { RichTextEditor } from "@/components/ui-custom/rich-text-editor";
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
export default function Harness(props) {
	return <ThemeWrapper><RichTextEditor {...props} /></ThemeWrapper>;
}
`,
		props: {
			"aria-label": "Skill instructions",
			frontmatter: { enabled: true },
			showToolbar: false,
			showBubbleMenu: false,
			value: "---\nallowed-tools:\n  - Jira\n  - Splunk\n---\n\nWrite a summary",
		},
	});
	const removals = view.getAllByRole("button", { name: /^Remove /u });
	assert.deepEqual(removals.map(accessibleName), ["Remove Jira", "Remove Splunk"]);
	assert.deepEqual(view.tabOrder(), ["Remove Jira", "Remove Splunk", "Skill instructions"]);
	for (const remove of removals) {
		assert.equal(remove.closest('[aria-hidden="true"], [inert]') === null, true);
		assert.equal(remove.parentElement.closest('button, [role="button"]') === null, true);
	}
	await view.press(null, "Tab");
	assert.equal(view.isFocused(removals[0]), true);
	await view.press(removals[0], " ");
	assert.equal(view.queryByRole("button", { name: "Remove Jira" }) === null, true);
	assert.equal(accessibleName(view.getByRole("button", { name: "Remove Splunk" })), "Remove Splunk");
});
