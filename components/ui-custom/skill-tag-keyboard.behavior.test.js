// A SkillTag or SkillTagCount given `onClick` is a control: it is a role=button tab stop that
// Enter and Space activate, like Tag. Keys aimed at the tag's own remove button stay with
// that button, in SkillTag and in Tag.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

async function render(entry, exportName, props) {
	const calls = [];
	const view = await renderComponent({
		entry,
		exportName,
		props: { onClick: () => calls.push("click"), ...props },
	});
	return { calls, view };
}

for (const key of ["Enter", " "]) {
	const keyName = key === " " ? "Space" : key;

	test(`SkillTag with onClick is a button that ${keyName} activates`, async () => {
		const { calls, view } = await render("components/ui-custom/skill-tag.tsx", "SkillTag", { children: "Search", color: "teamwork" });

		assert.deepEqual(view.tabOrder(), ["search"]);
		const tag = view.getByRole("button", { name: "search" });
		await view.focus(tag);
		await view.press(tag, key);

		assert.deepEqual(calls, ["click"]);
	});

	test(`SkillTagCount with onClick is a button that ${keyName} activates`, async () => {
		const { calls, view } = await render("components/ui-custom/skill-tag.tsx", "SkillTagCount", { count: 3 });

		assert.deepEqual(view.tabOrder(), ["+3"]);
		const count = view.getByRole("button", { name: "+3" });
		await view.focus(count);
		await view.press(count, key);

		assert.deepEqual(calls, ["click"]);
	});

	test(`${keyName} on SkillTag's remove button removes without activating the tag`, async () => {
		const { calls, view } = await render("components/ui-custom/skill-tag.tsx", "SkillTag", {
			children: "Search",
			color: "teamwork",
			onRemove: () => calls.push("remove"),
		});
		const remove = view.getByRole("button", { name: "Remove" });

		await view.focus(remove);
		await view.press(remove, key);

		assert.deepEqual(calls, ["remove"]);
	});

	test(`${keyName} on Tag's remove button removes without activating the tag`, async () => {
		const { calls, view } = await render("components/ui/tag.tsx", "Tag", {
			children: "Design",
			color: "blue",
			onRemove: () => calls.push("remove"),
		});
		const remove = view.getByRole("button", { name: "Remove Design" });

		await view.focus(remove);
		await view.press(remove, key);

		assert.deepEqual(calls, ["remove"]);
	});
}

test("SkillTag and SkillTagCount without onClick stay out of the tab order", async () => {
	const view = await renderComponent({
		source: `
import { SkillTag, SkillTagCount } from "@/components/ui-custom/skill-tag";
export default function Harness() {
	return <><SkillTag color="teamwork">Search</SkillTag><SkillTagCount count={2} /></>;
}
`,
	});

	assert.deepEqual(view.tabOrder(), []);
	assert.equal(view.queryByRole("button"), null);
});
