// Model Selector as a consumer renders it: a dropdown menu whose list is a radio group valued by the
// selected model, grouped under provider labels, where picking a model reports its id and closes the menu.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { useState } from "react";
import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorGroup,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorName,
	ModelSelectorSeparator,
	ModelSelectorTrigger,
} from "@/components/ui-custom/model-selector";

export default function Probe({ closeOnSelect }) {
	const [model, setModel] = useState("gpt-5");
	const record = (entry) => { (globalThis.__modelCalls ??= []).push(entry); };
	return (
		<ModelSelector defaultOpen>
			<ModelSelectorTrigger>{model}</ModelSelectorTrigger>
			<ModelSelectorContent title="Model">
				<ModelSelectorList value={model} onValueChange={(next) => { record("value:" + next); setModel(next); }}>
					<ModelSelectorGroup heading="OpenAI">
						<ModelSelectorItem value="gpt-5"><ModelSelectorName>GPT-5</ModelSelectorName></ModelSelectorItem>
						<ModelSelectorItem value="gpt-5-mini"><ModelSelectorName>GPT-5 mini</ModelSelectorName></ModelSelectorItem>
					</ModelSelectorGroup>
					<ModelSelectorSeparator />
					<ModelSelectorGroup heading="Anthropic">
						<ModelSelectorItem
							closeOnSelect={closeOnSelect}
							onSelect={(value) => record("select:" + value)}
							value="claude-sonnet-4-5"
						>
							<ModelSelectorName>Claude Sonnet 4.5</ModelSelectorName>
						</ModelSelectorItem>
					</ModelSelectorGroup>
				</ModelSelectorList>
			</ModelSelectorContent>
		</ModelSelector>
	);
}
`;

function calls() {
	return globalThis.__modelCalls ?? [];
}

function menuIsOpen() {
	return document.querySelector("[data-slot=dropdown-menu-content]") !== null;
}

test.beforeEach(() => {
	globalThis.__modelCalls = [];
});

test("models are radio items grouped under provider labels, checked by the list value", async () => {
	const view = await renderComponent({ source: PROBE });
	assert.equal(accessibleName(view.getByRole("menu")), "Model");
	const items = view.getAllByRole("menuitemradio");
	assert.deepEqual(items.map(accessibleName), ["GPT-5", "GPT-5 mini", "Claude Sonnet 4.5"]);
	assert.deepEqual(items.map((item) => item.getAttribute("aria-checked")), ["true", "false", "false"]);
	const labels = [...document.querySelectorAll("[data-slot=dropdown-menu-label]")].map((node) => node.textContent);
	assert.deepEqual(labels, ["OpenAI", "Anthropic"]);
	assert.equal(view.getAllByRole("separator").length, 1);
	await view.unmount();
});

test("picking a model reports its id, calls onSelect, and closes the menu", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("menuitemradio", { name: "Claude Sonnet 4.5" }));
	assert.equal(calls().includes("select:claude-sonnet-4-5"), true);
	assert.equal(calls().includes("value:claude-sonnet-4-5"), true);
	assert.equal(accessibleName(view.getByRole("button")), "claude-sonnet-4-5");
	assert.equal(menuIsOpen(), false, "menu closes after picking");
	await view.unmount();
});

test("closeOnSelect={false} keeps the menu open after picking", async () => {
	const view = await renderComponent({ props: { closeOnSelect: false }, source: PROBE });
	await view.click(view.getByRole("menuitemradio", { name: "Claude Sonnet 4.5" }));
	assert.equal(calls().includes("value:claude-sonnet-4-5"), true);
	assert.equal(menuIsOpen(), true, "menu stays open");
	await view.unmount();
});
