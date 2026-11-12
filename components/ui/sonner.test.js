const assert = require("node:assert/strict");
const test = require("node:test");
const { renderComponent } = require("../../scripts/lib/render-component");

test("toast displays its title, description, and working action", async () => {
	let actions = 0;
	const view = await renderComponent({
		source: `import React from "react";
			import { SonnerToast } from "@/components/ui/sonner";
			export default function Toast({ onAction }) { return <SonnerToast title="Event created" description="Monday" action={{ label: "Undo", onClick: onAction }} />; }`,
		props: { onAction: () => { actions += 1; } },
	});
	try {
		assert.equal(document.body.textContent.includes("Event created"), true);
		assert.equal(document.body.textContent.includes("Monday"), true);
		await view.click(view.getByRole("button", { name: "Undo" }));
		assert.equal(actions, 1);
	} finally {
		await view.unmount();
	}
});
