const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const skills = [
	{ id: "a", name: "Alpha", description: "Alpha skill", skillMd: "---\nname: alpha\ndescription: Alpha skill\n---\nAlpha instructions" },
	{ id: "b", name: "Beta", description: "Beta skill", skillMd: "---\nname: beta\ndescription: Beta skill\n---\nBeta instructions" },
];
const mocks = {
	"@/components/utils/theme-wrapper": `export function useTheme() { return { colorMode: "light", theme: "light", isDark: false }; }`,
	"@/components/ui/dialog": `
		import React from "react";
		export function Dialog({open, children}) { return open ? <section role="dialog">{children}</section> : null; }
		export function DialogContent({children}) { return <div>{children}</div>; }
		export function DialogFooter({children}) { return <footer>{children}</footer>; }
		export function DialogTitle({children}) { return <h2>{children}</h2>; }
		export function DialogClose({children}) { return <div>{children}</div>; }
	`,
	"@/components/blocks/skill-config": `
		import React from "react";
		export function Agent({children}) { return <div>{children}</div>; }
		export function AgentContent({children}) { return <div>{children}</div>; }
		export function AgentConfigFields({config, onTextChange}) {
			return <textarea aria-label="Skill instructions" value={config.instructions} onChange={event => onTextChange("instructions", event.target.value)} />;
		}
	`,
	"@/components/ui/dropdown-menu": `
		import React from "react";
		export const dropdownStyles = { trigger: "", content: "", item: "" };
		export function DropdownMenu({children}) { return <div>{children}</div>; }
		export function DropdownMenuContent({children}) { return <div>{children}</div>; }
		export function DropdownMenuTrigger({children}) { return <div>{children}</div>; }
		export function DropdownMenuItem({children, onSelect}) { return <button onClick={onSelect}>{children}</button>; }
	`,
	"@/components/ui-custom/entity-card": `
		import React from "react";
		export function EntityCardSkillCard({name,moreAction}) { return <article><h3>{name}</h3>{moreAction}</article>; }
	`,
};
async function render(props = {}) {
	let currentProps = { open: true, skills, onOpenChange: () => {}, ...props };
	const view = await renderComponent({
		entry: "components/blocks/skills-directory/components/skills-directory.tsx",
		exportName: "SkillsDirectoryDialog", mocks, props: currentProps,
	});
	const rerender = view.rerender;
	view.rerender = (patch) => {
		currentProps = { ...currentProps, ...patch };
		return rerender(currentProps);
	};
	return view;
}

test("configured detail changes without remounting the dialog or leaking editor drafts", async () => {
	const view = await render({ initialDetailSkillId: "a" });
	assert.equal(view.getByRole("heading", { name: "Alpha" }).textContent, "Alpha");
	await view.fill(view.getByRole("textbox", { name: "Skill instructions" }), skills[0].skillMd + "\nUnsent Alpha draft");
	await view.rerender({ initialDetailSkillId: "b" });
	assert.equal(view.getByRole("heading", { name: "Beta" }).textContent, "Beta");
	assert.equal(view.getByRole("textbox", { name: "Skill instructions" }).value, skills[1].skillMd);
	await view.rerender({ initialDetailSkillId: "a" });
	assert.equal(view.getByRole("textbox", { name: "Skill instructions" }).value, skills[0].skillMd);
});

test("back navigation stays local and reopening reapplies the same configured skill", async () => {
	const view = await render({ initialDetailSkillId: "a" });
	await view.click(view.getByRole("button", { name: "Back to skills" }));
	assert.equal(view.getByRole("heading", { name: "Browse all" }).textContent, "Browse all");
	await view.rerender({ initialDetailSkillId: "a" });
	assert.equal(view.queryByRole("textbox", { name: "Skill instructions" }) === null, true);
	await view.rerender({ open: false });
	await view.rerender({ open: true });
	assert.equal(view.getByRole("heading", { name: "Alpha" }).textContent, "Alpha");
});

test("browse intent and external close reset detail without resetting browse search", async () => {
	const view = await render();
	await view.fill(view.getByRole("textbox", { name: "Search skills" }), "Alpha");
	await view.rerender({ initialDetailSkillId: "a" });
	assert.equal(view.getByRole("heading", { name: "Alpha" }).textContent, "Alpha");
	await view.rerender({ initialDetailSkillId: null });
	assert.equal(view.getByRole("textbox", { name: "Search skills" }).value, "Alpha");
	await view.rerender({ open: false });
	await view.rerender({ open: true });
	assert.equal(view.getByRole("textbox", { name: "Search skills" }).value, "Alpha");
});

test("direct detail exit asks the host to close, while invalid detail intent falls back safely", async () => {
	const changes = [];
	const view = await render({ initialDetailSkillId: "a", closeOnDetailExit: true, onOpenChange: (open) => changes.push(open) });
	await view.click(view.getByRole("button", { name: "Back to skills" }));
	assert.deepEqual(changes, [false]);
	await view.rerender({ initialDetailSkillId: "missing" });
	assert.equal(view.getByRole("heading", { name: "Browse all" }).textContent, "Browse all");
});
