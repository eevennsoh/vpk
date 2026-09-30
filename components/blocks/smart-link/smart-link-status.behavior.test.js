// A status picked in the Smart Link card must survive the hover flyout closing
// and reopening (the card unmounts on close), and must not leak to another item.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

// Mirrors SmartLink: the host owns the selection and mounts the card only while "open".
const HOST_SOURCE = `
import { SmartLinkCard, useSmartLinkStatusSelection } from "@/components/blocks/smart-link/components/smart-link";
import { SMART_LINK_DEMO_ITEMS } from "@/components/blocks/smart-link/data/demo-smart-links";
import { ThemeWrapper } from "@/components/utils/theme-wrapper";

// A real demo item whose status offers To do / In progress / Done.
const item = (id) => ({ ...SMART_LINK_DEMO_ITEMS[0], id });

export function Host({ itemId, open }) {
	const current = item(itemId);
	const selection = useSmartLinkStatusSelection(current);
	return <ThemeWrapper>{open ? <SmartLinkCard appearance="flyout" item={current} statusSelection={selection} /> : null}</ThemeWrapper>;
}

export function Standalone() {
	return <ThemeWrapper><SmartLinkCard item={item("solo")} /></ThemeWrapper>;
}
`;

async function pickStatus(view, label) {
	await view.click(view.getByRole("button", { name: /^Status: / }));
	await view.click(view.getByRole("menuitem", { name: label }));
}

function statusLabel(view) {
	return view.getByRole("button", { name: /^Status: / }).getAttribute("aria-label");
}

test("a picked status survives the flyout closing and reopening", async () => {
	const view = await renderComponent({ exportName: "Host", props: { itemId: "A-1", open: true }, source: HOST_SOURCE });
	assert.equal(statusLabel(view), "Status: In progress");

	await pickStatus(view, "Done");
	assert.equal(statusLabel(view), "Status: Done");

	await view.rerender({ itemId: "A-1", open: false });
	assert.equal(view.queryByRole("button", { name: /^Status: / }), null);
	await view.rerender({ itemId: "A-1", open: true });
	assert.equal(statusLabel(view), "Status: Done");
});

test("a status picked for one item does not carry over to another", async () => {
	const view = await renderComponent({ exportName: "Host", props: { itemId: "A-1", open: true }, source: HOST_SOURCE });
	await pickStatus(view, "To do");
	assert.equal(statusLabel(view), "Status: To do");

	await view.rerender({ itemId: "B-2", open: true });
	assert.equal(statusLabel(view), "Status: In progress");
});

test("a card rendered without a host keeps its own selection", async () => {
	const view = await renderComponent({ exportName: "Standalone", source: HOST_SOURCE });
	await pickStatus(view, "Done");
	assert.equal(statusLabel(view), "Status: Done");
});
