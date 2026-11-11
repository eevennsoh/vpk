const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../../scripts/lib/render-component.js");

const entry = "app/sandbox/agent-selector-canvas/teammate-session-previews.tsx";
const disclosure = { name: /Sessions from your teammates/u };
const selection = { name: "Preview selection" };
const mocks = {
	"@/components/utils/theme-wrapper": "export const useTheme = () => ({ theme: 'light', actualTheme: 'light', setTheme: () => {} });",
};

for (const exportName of ["QuietDisclosurePreview", "PeopleFoldPreview", "ActivityDigestPreview"]) {
	test(`${exportName}: two personal cards, four folded teammate cards, keyboard toggle and focus return`, async () => {
		const view = await renderComponent({ entry, exportName, mocks });
		try {
			const trigger = view.getByRole("button", disclosure);
			assert.equal(trigger.getAttribute("aria-expanded"), "false");
			assert.equal(view.getAllByRole("listitem").length, 2);
			assert.equal(view.queryByRole("button", { name: /More actions/u }), null);
			assert.equal(view.tabOrder().some((name) => name.includes("Simplify project navigation")), false);
			assert.equal(view.queryByText("Simplify project navigation"), null);

			await view.focus(trigger);
			await view.press(trigger, "Enter");
			assert.equal(trigger.getAttribute("aria-expanded"), "true");
			assert.equal(view.getAllByRole("listitem").length, 6);
			assert.equal(view.isFocused(trigger), true);
			const teammateCard = view.getByText("Simplify project navigation").closest("article");
			assert.equal(teammateCard.getAttribute("tabindex"), "0");
			assert.equal(teammateCard.querySelector("button"), null);

			await view.focus(teammateCard);
			await view.press(teammateCard, "Enter");
			assert.equal(view.getByRole("status", selection).textContent, "");
			await view.press(teammateCard, "Escape");
			assert.equal(trigger.getAttribute("aria-expanded"), "true", "the first Escape dismisses the focused card’s privacy tooltip");
			await view.press(teammateCard, "Escape");
			assert.equal(trigger.getAttribute("aria-expanded"), "false");
			assert.equal(view.isFocused(trigger), true);
			assert.equal(view.getAllByRole("listitem").length, 2);
			assert.equal(view.tabOrder().some((name) => name.includes("Simplify project navigation")), false);

			await view.press(trigger, " ");
			assert.equal(trigger.getAttribute("aria-expanded"), "true");
			assert.equal(view.getAllByRole("listitem").length, 6);
			await view.click(trigger);
			assert.equal(trigger.getAttribute("aria-expanded"), "false");
		} finally {
			await view.unmount();
		}
	});
}

test("samples handle viewer-only, personal-only and empty menus without a misleading divider or disclosure", async () => {
	const view = await renderComponent({ entry, exportName: "QuietDisclosurePreview", mocks });
	try {
		const sample = view.getByRole("combobox", { name: "Sample" });
		await view.fill(sample, "teammates-only");
		assert.equal(view.queryByRole("list"), null);
		assert.equal(view.queryByRole("separator"), null);
		assert.equal(view.getByRole("button", disclosure).getAttribute("aria-expanded"), "false");
		await view.click(view.getByRole("button", disclosure));
		assert.equal(view.getAllByRole("listitem").length, 4);
		assert.equal(view.queryByRole("button", { name: /More/u }), null);

		await view.fill(sample, "yours-only");
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.getAllByRole("listitem").length, 2);
		assert.equal(view.queryByRole("separator"), null);

		await view.fill(sample, "empty");
		assert.equal(view.queryByRole("list"), null);
		assert.equal(view.queryByRole("button", disclosure), null);
		assert.equal(view.getByText("No sessions yet.").textContent, "No sessions yet.");

		await view.fill(sample, "mixed");
		assert.equal(view.getByRole("button", disclosure).getAttribute("aria-expanded"), "false");
		assert.equal(view.getAllByRole("listitem").length, 2);
	} finally {
		await view.unmount();
	}
});

test("personal selection stays local and survives folding teammates", async () => {
	const view = await renderComponent({ entry, exportName: "QuietDisclosurePreview", mocks });
	try {
		await view.click(view.getByRole("button", { name: /^Polish the agent handoff/u }));
		assert.equal(view.getByRole("status", selection).textContent, "Selected “Polish the agent handoff” · Preview only");
		await view.click(view.getByRole("button", disclosure));
		await view.click(view.getByRole("button", disclosure));
		assert.equal(view.getByRole("status", selection).textContent, "Selected “Polish the agent handoff” · Preview only");
	} finally {
		await view.unmount();
	}
});

test("previews have independent open states and unique disclosure targets", async () => {
	const view = await renderComponent({
		source: 'import { QuietDisclosurePreview, PeopleFoldPreview } from "@/app/sandbox/agent-selector-canvas/teammate-session-previews"; export default function Pair() { return <><QuietDisclosurePreview /><PeopleFoldPreview /></>; }',
		mocks,
	});
	try {
		const [first, second] = view.getAllByRole("button", disclosure);
		await view.click(first);
		assert.equal(first.getAttribute("aria-expanded"), "true");
		assert.equal(second.getAttribute("aria-expanded"), "false");
		await view.click(second);
		assert.equal(typeof first.getAttribute("aria-controls"), "string");
		assert.notEqual(first.getAttribute("aria-controls"), second.getAttribute("aria-controls"));
		await view.click(first);
		assert.equal(first.getAttribute("aria-expanded"), "false");
		assert.equal(second.getAttribute("aria-expanded"), "true");
	} finally {
		await view.unmount();
	}
});
