const assert = require("node:assert/strict");
const { test } = require("node:test");
const { renderComponent } = require("../../../../scripts/lib/render-component.js");

test("scripted agents and skills can be created and remain available to the demo", async () => {
	const view = await renderComponent({ source: `
		import { ButterScriptedCreationProvider, useButterScriptedCreation } from "@/components/projects/butter-v1/components/butter-scripted-creation";
		function Controls() {
			const catalog = useButterScriptedCreation();
			if (!catalog) return null;
			return <><button onClick={() => catalog.open("agent")}>New agent</button><button onClick={() => catalog.open("skill")}>New skill</button><div data-testid="catalog">{catalog.agents.map((agent) => agent.name).join(",")} | {catalog.skills.map((skill) => skill.name).join(",")}</div></>;
		}
		export default function Fixture() { return <ButterScriptedCreationProvider><Controls /></ButterScriptedCreationProvider>; }
	` });
	await view.click(view.getByRole("button", { name: "New agent" }));
	await view.fill(view.getByRole("textbox", { name: "Name" }), "Release assistant");
	await view.fill(view.getByRole("textbox", { name: "Description" }), "Review releases");
	await view.click(view.getByRole("button", { name: "Create agent" }));
	assert.equal(view.container.querySelector('[data-testid="catalog"]').textContent, "Release assistant | ");
	await view.click(view.getByRole("button", { name: "New skill" }));
	await view.fill(view.getByRole("textbox", { name: "Name" }), "Release review");
	await view.click(view.getByRole("button", { name: "Create skill" }));
	assert.equal(view.container.querySelector('[data-testid="catalog"]').textContent, "Release assistant | Release review");
});
