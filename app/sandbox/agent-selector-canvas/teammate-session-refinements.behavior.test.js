const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const mocks = {
	"@/components/utils/theme-wrapper": "export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });",
};
const disclosure = { name: /Sessions from your teammates/u };

test("People fold announces both counts and groups real read-only cards only after expansion", async () => {
	const view = await renderComponent({ entry: "app/sandbox/agent-selector-canvas/teammate-session-previews.tsx", exportName: "PeopleFoldPreview", mocks });
	try {
		const trigger = view.getByRole("button", { name: /4 sessions, 3 teammates/u });
		for (const name of ["Teammate A", "Teammate B", "Teammate C"]) {
			assert.equal(view.queryByRole("group", { name }), null);
		}
		for (const title of ["Simplify project navigation", "Give empty states a little warmth", "Make keyboard focus easier to follow", "A clearer welcome to Project Butter"]) {
			assert.equal(view.queryByText(title), null);
		}
		await view.press(trigger, "Enter");
		const groups = ["Teammate A", "Teammate B", "Teammate C"].map((name) => view.getByRole("group", { name }));
		assert.deepEqual(view.getAllByRole("group", { name: /^Teammate [ABC]$/u }).map((group) => group.getAttribute("aria-label")), ["Teammate A", "Teammate B", "Teammate C"]);
		assert.deepEqual(groups.map((group) => [...group.querySelectorAll("li")].map((row) => row.getAttribute("data-testid"))), [
			["agent-session-row-canvas-team-navigation", "agent-session-row-canvas-team-copy"],
			["agent-session-row-canvas-team-empty"],
			["agent-session-row-canvas-team-focus"],
		]);
		assert.equal(groups.every((group) => group.querySelector("button") === null), true);
		assert.equal(groups.every((group) => [...group.querySelectorAll("article")].every((card) => card.tabIndex === 0)), true);
		await view.press(trigger, " ");
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(view.queryByRole("group", { name: "Teammate A" }), null);
		assert.equal(view.tabOrder().some((name) => name.includes("A clearer welcome")), false);
	} finally { await view.unmount(); }
});

const disclosureEntry = "app/sandbox/agent-selector-canvas/teammate-session-disclosure.tsx";
const sample = (id, name, state) => ({ id, title: `Sample ${id}`, agent: { name: "Sample agent" }, invokedBy: { name }, role: "viewer", state });

test("People fold derives avatar initials from names and counts distinct normalized teammates", async () => {
	const view = await renderComponent({ entry: disclosureEntry, exportName: "TeammateSessionDisclosure", mocks, props: {
		approach: "people", items: [sample("b", "Demo Beta", "running"), sample("a", "Sample Alpha", "complete"), sample("a2", " Sample Alpha ", "complete")],
	} });
	try {
		assert.equal(view.getByRole("button", { name: /3 sessions, 2 teammates/u }).getAttribute("aria-expanded"), "false");
		assert.deepEqual([...view.container.querySelectorAll('[data-slot="avatar-fallback"]')].map((avatar) => avatar.textContent), ["DB", "SA"]);
	} finally { await view.unmount(); }
});

test("Activity digest includes every lifecycle state and leaves zero-count states out", async () => {
	const props = { approach: "activity", items: [
		sample("1", "Teammate A", "running"), sample("2", "Teammate B", "needs-input"), sample("3", "Teammate C", "attention"),
		sample("4", "Teammate A", "complete"), sample("5", "Teammate B", "attention"),
	] };
	const view = await renderComponent({ entry: disclosureEntry, exportName: "TeammateSessionDisclosure", mocks, props });
	try {
		assert.equal(view.getByRole("button", { name: /5 sessions, 1 working, 1 needs input, 2 needs attention, 1 complete/u }).getAttribute("aria-expanded"), "false");
		await view.rerender({ ...props, items: props.items.slice(1, 3) });
		const trigger = view.getByRole("button", { name: /2 sessions, 1 needs input, 1 needs attention/u });
		assert.equal(trigger.textContent.includes("working"), false);
		assert.equal(trigger.textContent.includes("complete"), false);
		assert.equal(trigger.textContent.includes("0 "), false);
		await view.click(trigger);
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
	} finally { await view.unmount(); }
});

test("grouped People fold reaches the same accessible open and closed states with reduced motion", async () => {
	const previous = window.happyDOM.settings.device.prefersReducedMotion;
	window.happyDOM.settings.device.prefersReducedMotion = "reduce";
	const view = await renderComponent({ entry: "app/sandbox/agent-selector-canvas/teammate-session-previews.tsx", exportName: "PeopleFoldPreview", mocks });
	try {
		assert.equal(window.matchMedia("(prefers-reduced-motion: reduce)").matches, true);
		const trigger = view.getByRole("button", disclosure);
		await view.press(trigger, "Enter");
		assert.equal(trigger.getAttribute("aria-expanded"), "true");
		assert.equal(view.getAllByRole("listitem").length, 6);
		await view.press(trigger, "Escape");
		assert.equal(trigger.getAttribute("aria-expanded"), "false");
		assert.equal(view.getAllByRole("listitem").length, 2);
		assert.equal(view.isFocused(trigger), true);
	} finally {
		await view.unmount();
		window.happyDOM.settings.device.prefersReducedMotion = previous;
	}
});
