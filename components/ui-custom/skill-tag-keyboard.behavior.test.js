// A SkillTag or SkillTagCount given `onClick` is a control: it is a role=button tab stop that
// Enter and Space activate, like Tag. Keys aimed at the tag's sibling remove button stay with
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

for (const control of ["inline", "overlay", "custom"]) {
	test(`SkillTag's ${control} control is a sibling of its action, in the same focus order`, async () => {
		const calls = [];
		const controlName = control === "custom" ? "Revert search to text" : "Remove search";
		const view = await renderComponent({
			source: `
import { SkillTag } from "@/components/ui-custom/skill-tag";
export default function Harness({ onClick, onControl }) {
	return <SkillTag
		color="teamwork"
		onClick={onClick}
		${control === "custom"
		? 'overlayAction={{ icon: <svg aria-hidden="true" />, label: "Revert search to text", onClick: onControl }}'
		: `onRemove={onControl} removeVariant="${control}" removeButtonLabel="Remove search"`}
	>Search</SkillTag>;
}
`,
			props: {
				onClick: () => calls.push("open"),
				onControl: () => calls.push("control"),
			},
		});
		const action = view.getByRole("button", { name: "search" });
		const secondary = view.getByRole("button", { name: controlName });
		assert.equal(view.getAllByRole("button").length, 2);
		assert.equal(secondary.parentElement.closest('button, [role="button"]') === null, true);
		assert.equal(action.parentElement.closest('button, [role="button"]') === null, true);
		assert.deepEqual(view.tabOrder(), ["search", controlName]);
		await view.press(null, "Tab");
		assert.equal(view.isFocused(action), true);
		await view.press(action, "Enter");
		await view.press(action, " ");
		await view.click(action);
		assert.deepEqual(calls, ["open", "open", "open"]);
		await view.press(action, "Tab");
		assert.equal(view.isFocused(secondary), true);
		await view.press(secondary, "Enter");
		await view.press(secondary, " ");
		await view.click(secondary);
		assert.deepEqual(calls, ["open", "open", "open", "control", "control", "control"]);
	});
}

test("SkillTag forwards a trigger's name, ref, events and tabIndex to its separate action", async () => {
	let target;
	const calls = [];
	const view = await renderComponent({
		entry: "components/ui-custom/skill-tag.tsx",
		exportName: "SkillTag",
		props: {
			"aria-label": "Open search details",
			"aria-expanded": false,
			children: "Search",
			onClick: () => calls.push("open"),
			onKeyDown: (event) => { event.preventDefault(); calls.push("key"); },
			onRemove: () => calls.push("remove"),
			ref: (node) => { target = node; },
			tabIndex: -1,
		},
	});
	const action = view.getByRole("button", { name: "Open search details" });
	assert.equal(target === action, true);
	assert.equal(action.getAttribute("aria-expanded"), "false");
	assert.deepEqual(view.tabOrder(), ["Remove"]);
	await view.focus(action);
	assert.equal(view.isFocused(action), true);
	await view.press(action, "Enter");
	assert.deepEqual(calls, ["key"]);
});

test("a focusable SkillTag mention is a non-button tab stop and honors an explicit tabIndex", async () => {
	let tag;
	const props = {
		children: "Search",
		focusable: true,
		focused: true,
		ref: (node) => { tag = node; },
	};
	const view = await renderComponent({
		entry: "components/ui-custom/skill-tag.tsx",
		exportName: "SkillTag",
		props,
	});
	assert.equal(view.queryByRole("button") === null, true);
	assert.deepEqual(view.tabOrder(), ["search"]);
	await view.press(null, "Tab");
	assert.equal(view.isFocused(tag), true);
	await view.rerender({ ...props, tabIndex: -1 });
	assert.deepEqual(view.tabOrder(), []);
	await view.focus(tag);
	assert.equal(view.isFocused(tag), true);
});
