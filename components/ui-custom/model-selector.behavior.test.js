// Model Selector as a consumer renders it: a dropdown menu holding a searchable command list valued by
// the selected model, grouped under provider headings, where picking a model reports its id and closes the menu.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { useState } from "react";
import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorInput,
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
				<ModelSelectorInput />
				<ModelSelectorList value={model} onValueChange={(next) => { record("value:" + next); setModel(next); }}>
					<ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
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

function optionNames() {
	return [...document.querySelectorAll("[role=option]")].map(accessibleName);
}

test("models are options grouped under provider headings, checked by the list value", async () => {
	const view = await renderComponent({ source: PROBE });
	assert.equal(accessibleName(view.getByRole("menu")), "Model");
	assert.equal(accessibleName(view.getByRole("listbox")), "Models");
	assert.deepEqual(optionNames(), ["GPT-5", "GPT-5 mini", "Claude Sonnet 4.5"]);
	const checked = [...document.querySelectorAll("[role=option]")].map((item) => item.getAttribute("aria-checked"));
	assert.deepEqual(checked, ["true", "false", "false"]);
	const headings = [...document.querySelectorAll("[cmdk-group-heading]")].map((node) => node.textContent);
	assert.deepEqual(headings, ["OpenAI", "Anthropic"]);
	await view.unmount();
});

test("typing in the search field filters models and shows the empty state when nothing matches", async () => {
	const view = await renderComponent({ source: PROBE });
	const search = view.getByRole("combobox");
	await view.fill(search, "claude");
	assert.deepEqual(optionNames(), ["Claude Sonnet 4.5"]);
	await view.fill(search, "zzzz");
	assert.deepEqual(optionNames(), []);
	assert.equal(document.querySelector("[data-slot=command-empty]")?.textContent, "No models found.");
	await view.unmount();
});

test("picking a model reports its id, calls onSelect, and closes the menu", async () => {
	const view = await renderComponent({ source: PROBE });
	await view.click(view.getByRole("option", { name: "Claude Sonnet 4.5" }));
	assert.equal(calls().includes("select:claude-sonnet-4-5"), true);
	assert.equal(calls().includes("value:claude-sonnet-4-5"), true);
	assert.equal(accessibleName(view.getByRole("button")), "claude-sonnet-4-5");
	assert.equal(menuIsOpen(), false, "menu closes after picking");
	await view.unmount();
});

test("closeOnSelect={false} keeps the menu open after picking", async () => {
	const view = await renderComponent({ props: { closeOnSelect: false }, source: PROBE });
	await view.click(view.getByRole("option", { name: "Claude Sonnet 4.5" }));
	assert.equal(calls().includes("value:claude-sonnet-4-5"), true);
	assert.equal(menuIsOpen(), true, "menu stays open");
	await view.unmount();
});
