// The Agent Directory dialog as a user meets it on its docs pages and as a host wires it: it opens
// only from a trigger, its one Close control sits in the header beside the title, picking an agent
// closes it, and the New agent action reaches the host.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PAGE_PROBE = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentsDirectoryExperimentalPage, AgentsDirectoryStandardV1Page } from "@/components/blocks/agent-directory/page";

export default function Probe({ page }) {
	return <ThemeWrapper>{page === "experimental" ? <AgentsDirectoryExperimentalPage /> : <AgentsDirectoryStandardV1Page />}</ThemeWrapper>;
}
`;

const DIALOG_PROBE = `
import { useState } from "react";
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentsDirectoryDialog } from "@/components/blocks/agent-directory";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory/agents";

export default function Probe({ title, variant }) {
	const [open, setOpen] = useState(true);
	const record = (entry) => { (globalThis.__directoryCalls ??= []).push(entry); };
	return (
		<ThemeWrapper>
			<AgentsDirectoryDialog
				agents={DEMO_AGENT_BROWSER_AGENTS}
				onCreateAgent={() => record("create")}
				onOpenChange={(next) => { record("open:" + next); setOpen(next); }}
				onSelectAgent={(agent) => record("select:" + agent.id)}
				open={open}
				title={title}
				variant={variant}
			/>
		</ThemeWrapper>
	);
}
`;

function calls() {
	return globalThis.__directoryCalls ?? [];
}

test.beforeEach(() => {
	globalThis.__directoryCalls = [];
});

function assertHeaderClose(view, title) {
	const dialog = view.getByRole("dialog");
	assert.equal(accessibleName(dialog), title);
	const closeButtons = view.getAllByRole("button", { name: "Close" });
	assert.equal(closeButtons.length, 1, "one Close control, no extra corner close");
	const heading = view.getByRole("heading", { name: title });
	assert.equal(heading.parentElement.contains(closeButtons[0]), true, "Close sits in the title's header row");
	return closeButtons[0];
}

for (const [page, trigger] of [["v1", "Open standard directory v1"], ["experimental", "Open experimental directory"]]) {
	test(`the ${page} docs page opens the directory only from its trigger, and Close dismisses it`, async () => {
		const view = await renderComponent({ props: { page }, source: PAGE_PROBE });
		assert.equal(view.queryByRole("dialog") === null, true, "the directory starts closed");

		await view.click(view.getByRole("button", { name: trigger }));
		const close = assertHeaderClose(view, "Browse agents");

		await view.click(close);
		assert.equal(view.queryByRole("dialog") === null, true);
		await view.unmount();
	});
}

test("picking an agent on the docs page closes the directory", async () => {
	const view = await renderComponent({ props: { page: "v1" }, source: PAGE_PROBE });
	await view.click(view.getByRole("button", { name: "Open standard directory v1" }));
	await view.click(view.getByRole("button", { name: "Select Feedback Analyzer" }));
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.unmount();
});

test("the directory header offers New agent and hands it to the host", async () => {
	const view = await renderComponent({ props: {}, source: DIALOG_PROBE });
	assertHeaderClose(view, "Browse agents");
	await view.click(view.getByRole("button", { name: "New agent" }));
	assert.deepEqual(calls(), ["create"]);

	await view.click(view.getByRole("button", { name: "Select Feedback Analyzer" }));
	assert.deepEqual(calls(), ["create", "select:feedback-analyzer"]);
	await view.unmount();
});

test("a host title replaces the default directory title", async () => {
	const view = await renderComponent({ props: { title: "Pick a teammate" }, source: DIALOG_PROBE });
	assertHeaderClose(view, "Pick a teammate");
	await view.unmount();
});

test("the standard v2 directory keeps its own header Close and reports the close to the host", async () => {
	const view = await renderComponent({ props: { variant: "standard-v2" }, source: DIALOG_PROBE });
	const close = assertHeaderClose(view, "Agents");
	await view.click(close);
	assert.deepEqual(calls(), ["open:false"]);
	assert.equal(view.queryByRole("dialog") === null, true);
	await view.unmount();
});

// The opt-in experimental directory: a filter bar instead of the sidebar, results grouped by who
// made the agent, multi-select filters that narrow the count and reset, and a Templates mode.
const EXPERIMENTAL_PROBE = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentsDirectoryDialog } from "@/components/blocks/agent-directory";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory/agents";

const SESSION_AGENTS = [
	{ id: "workflow-synthesizer", name: "Workflow Synthesizer", byline: "by Revenue Operations", attributionKind: "team", description: "Turns requests into workflows." },
];

export default function Probe({ initialTemplateCategory = null, variant = "experimental" }) {
	return (
		<ThemeWrapper>
			<AgentsDirectoryDialog
				agents={DEMO_AGENT_BROWSER_AGENTS}
				initialTemplateCategory={initialTemplateCategory}
				onOpenChange={() => {}}
				open
				sessionAgents={SESSION_AGENTS}
				variant={variant}
			/>
		</ThemeWrapper>
	);
}
`;

function resultCount() {
	const line = [...document.querySelectorAll("*")].find((node) => node.children.length === 0 && /^Showing \d+ results$/u.test(node.textContent));
	return line ? Number(line.textContent.match(/\d+/u)[0]) : null;
}

function sectionLabels() {
	return [...document.querySelectorAll("section[aria-label]")].map((section) => section.getAttribute("aria-label"));
}

function sectionCardNames(label) {
	const section = document.querySelector(`section[aria-label="${label}"]`);
	return section ? [...section.querySelectorAll("h3")].map((heading) => heading.textContent) : [];
}

async function pickFilterOption(view, trigger, option) {
	await view.click(view.getByRole("button", { name: trigger }));
	const label = [...document.querySelectorAll("label")].find((node) => node.textContent.includes(option));
	assert.equal(label === undefined, false, `${trigger} lists ${option}`);
	await view.click(label);
	await view.press(document.activeElement ?? document.body, "Escape");
}

test("the default directory keeps its sidebar; only the experimental variant shows the filter bar", async () => {
	const standard = await renderComponent({ props: { variant: "default" }, source: EXPERIMENTAL_PROBE });
	assert.equal(standard.queryByRole("button", { name: "Favourite agents" }) === null, false);
	assert.equal(standard.queryByRole("button", { name: "Teams" }) === null, true);
	assert.equal(standard.queryByRole("button", { name: "Templates" }) === null, true);
	await standard.unmount();

	const experimental = await renderComponent({ props: {}, source: EXPERIMENTAL_PROBE });
	for (const name of ["Agents", "Templates", "Filter by my agents", "Teams", "Companies", "Categories"]) {
		assert.equal(experimental.queryByRole("button", { name }) === null, false, `${name} control`);
	}
	assert.equal(experimental.queryByRole("button", { name: "Favourite agents" }) === null, true);
	await experimental.unmount();
});

test("experimental results are grouped by who made them, with the session's agents under My agents", async () => {
	const view = await renderComponent({ props: {}, source: EXPERIMENTAL_PROBE });
	assert.deepEqual(sectionLabels(), ["My agents", "By teams", "By companies"]);
	for (const label of sectionLabels()) {
		assert.equal(document.querySelector(`section[aria-label="${label}"] h2`)?.textContent, label);
	}
	assert.equal(sectionCardNames("My agents").includes("Workflow Synthesizer"), true);
	assert.equal(resultCount() > 1, true);
	await view.unmount();
});

test("the search and filter bar stays outside the scrolling results", async () => {
	const view = await renderComponent({ props: {}, source: EXPERIMENTAL_PROBE });
	const results = document.querySelector('section[aria-label="My agents"]');
	const scroller = results.closest(".overflow-y-auto");
	assert.equal(scroller === null, false, "results sit in a scroll region");
	const search = view.getByRole("textbox", { name: "Search agents" });
	assert.equal(scroller.contains(search), false);
	assert.equal(scroller.contains(view.getByRole("button", { name: "Teams" })), false);
	await view.unmount();
});

test("a team filter narrows results, counts its selections, and Reset restores everything", async () => {
	const view = await renderComponent({ props: {}, source: EXPERIMENTAL_PROBE });
	const total = resultCount();

	await view.click(view.getByRole("button", { name: "Teams" }));
	await view.fill(view.getByRole("textbox", { name: /^Search teams$/iu }), "revenue");
	const options = [...document.querySelectorAll("label")].map((node) => node.textContent.trim()).filter(Boolean);
	assert.deepEqual(options.map((text) => text.replace(/^[A-Z]{2}/u, "")), ["Revenue Operations"]);
	await view.press(document.activeElement ?? document.body, "Escape");

	await pickFilterOption(view, "Teams", "Revenue Operations");
	assert.equal(resultCount(), 1);
	assert.deepEqual(sectionLabels(), ["By teams"]);
	const trigger = view.getByRole("button", { name: /^Filter by teams/u });
	assert.equal(trigger.getAttribute("aria-pressed"), "true");
	assert.equal(trigger.textContent.endsWith("1"), true, "the trigger shows one selection");

	await view.click(view.getByRole("button", { name: "Reset" }));
	assert.equal(resultCount(), total);
	assert.equal(view.queryByRole("button", { name: "Reset" }) === null, true);
	assert.equal(view.getByRole("button", { name: "Teams" }).hasAttribute("aria-pressed"), false);
	await view.unmount();
});

test("Filter by my agents keeps only the agents in My agents", async () => {
	const view = await renderComponent({ props: {}, source: EXPERIMENTAL_PROBE });
	const mine = sectionCardNames("My agents");
	await view.click(view.getByRole("button", { name: "Filter by my agents" }));
	assert.equal(view.getByRole("button", { name: "Filter by my agents" }).getAttribute("aria-pressed"), "true");
	assert.equal(resultCount(), mine.length);
	assert.deepEqual(sectionLabels(), ["My agents"]);
	await view.unmount();
});

test("Templates switches the experimental directory to template categories and back", async () => {
	const view = await renderComponent({ props: {}, source: EXPERIMENTAL_PROBE });
	await pickFilterOption(view, "Teams", "Revenue Operations");
	await view.click(view.getByRole("button", { name: "Templates" }));
	assert.equal(view.queryByRole("button", { name: "Planning" }) === null, false, "template categories are listed");
	assert.equal(view.getAllByRole("button").some((button) => /^Select /u.test(button.getAttribute("aria-label") ?? "")), true, "template cards are listed");
	assert.deepEqual(sectionLabels(), ["Agent templates"]);

	await view.click(view.getByRole("button", { name: "Agents" }));
	assert.deepEqual(sectionLabels(), ["My agents", "By teams", "By companies"], "returning to Agents clears the filters");
	await view.unmount();
});

test("an initial template category opens the experimental directory in Templates mode", async () => {
	const view = await renderComponent({ props: { initialTemplateCategory: "brainstorm" }, source: EXPERIMENTAL_PROBE });
	assert.equal(view.queryByRole("button", { name: "Planning" }) === null, false);
	assert.deepEqual(sectionLabels(), ["Agent templates"]);
	await view.unmount();
});
