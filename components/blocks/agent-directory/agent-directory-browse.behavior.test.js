// Browsing the default Agent Directory: the category sidebar and its team and company groups, the
// single results grid with favourites and merged session agents, and the two independently
// scrolling columns. The docs page's session agents carry descriptive bylines.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentsDirectoryDialog } from "@/components/blocks/agent-directory";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory/agents";

const OWN_AGENTS = [
	{ id: "alpha", name: "Alpha", byline: "by Team A", description: "First.", rating: 4.5, feedbackCount: 12, chatCount: 3400, favorite: true, verified: true },
	{ id: "beta", name: "Beta", byline: "by Team B", description: "Second." },
];
const SESSION_AGENTS = [
	{ id: "alpha", name: "Alpha", byline: "by Team A", description: "First." },
	{ id: "session-three", name: "Session Three", byline: "by Me", description: "Made this session." },
];

export default function Probe({ demo = false }) {
	return (
		<ThemeWrapper>
			<AgentsDirectoryDialog
				agents={demo ? DEMO_AGENT_BROWSER_AGENTS : OWN_AGENTS}
				onOpenChange={() => {}}
				onSelectAgent={(agent) => { (globalThis.__browseCalls ??= []).push(agent.id); }}
				open
				sessionAgents={demo ? [] : SESSION_AGENTS}
			/>
		</ThemeWrapper>
	);
}
`;

const PAGE_PROBE = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import AgentsDirectoryPage from "@/components/blocks/agent-directory/page";
export default function Probe() { return <ThemeWrapper><AgentsDirectoryPage /></ThemeWrapper>; }
`;

test.beforeEach(() => {
	globalThis.__browseCalls = [];
});

function resultNames() {
	return [...document.querySelectorAll('section[aria-label="Agents"] h3')].map((heading) => heading.textContent);
}

function cardText(name) {
	const heading = [...document.querySelectorAll('section[aria-label="Agents"] h3')].find((node) => node.textContent === name);
	return heading?.closest("li")?.textContent.replace(/\s+/gu, " ") ?? "";
}

function sidebar() {
	return document.querySelector('[aria-label="Agent categories"]');
}


test("results are one Agents grid, with session agents merged into the directory once", async () => {
	const view = await renderComponent({ props: {}, source: PROBE });
	assert.deepEqual([...document.querySelectorAll("section[aria-label]")].map((section) => section.getAttribute("aria-label")), ["Agents"]);
	assert.equal(view.queryByRole("heading", { name: "Recommended" }) === null, true);
	assert.equal(view.queryByRole("heading", { name: "All agents" }) === null, true);
	assert.deepEqual(resultNames(), ["Alpha", "Beta", "Session Three"]);
	assert.equal(cardText("Alpha").includes("4.5 (12 feedback)"), true, "a session copy keeps the directory's rating");
	assert.equal(cardText("Alpha").includes("3.4K chats"), true);
	await view.unmount();
});

test("the category sidebar marks the selected category and Favourite agents keeps only favourites", async () => {
	const view = await renderComponent({ props: {}, source: PROBE });
	assert.equal(view.getByRole("button", { name: "All" }).getAttribute("aria-current"), "page");
	await view.click(view.getByRole("button", { name: "Favourite agents" }));
	assert.equal(view.getByRole("button", { name: "Favourite agents" }).getAttribute("aria-current"), "page");
	assert.equal(view.getByRole("button", { name: "All" }).hasAttribute("aria-current"), false);
	assert.deepEqual(resultNames(), ["Alpha"]);
	await view.unmount();
});

const GROUPS_PROBE = `
import { DEFAULT_AGENTS_DIRECTORY_SIDEBAR_GROUPS } from "@/components/blocks/agent-directory/data/sidebar-groups";
import { DEMO_AGENT_BROWSER_SIDEBAR_GROUPS } from "@/app/data/directory/agents";
export default function Probe() {
	return <pre>{JSON.stringify([DEFAULT_AGENTS_DIRECTORY_SIDEBAR_GROUPS, DEMO_AGENT_BROWSER_SIDEBAR_GROUPS])}</pre>;
}
`;

const TEAMS = [
	["Product Experience", "/avatar-project/compass.svg"],
	["Platform Engineering", "/avatar-project/code.svg"],
	["Customer Success", "/avatar-project/service-bell.svg"],
	["Revenue Operations", "/avatar-project/graph.svg"],
];

test("both sidebar group sets group agents By teams and By companies, each with Show all", async () => {
	const view = await renderComponent({ source: GROUPS_PROBE });
	const sets = JSON.parse(view.container.querySelector("pre").textContent);
	assert.equal(sets.length, 2);
	for (const groups of sets) {
		const byTitle = Object.fromEntries(groups.map((group) => [group.title, group]));
		assert.equal(byTitle["By teams"]?.showAll, true);
		assert.equal(byTitle["By companies"]?.showAll, true);
		for (const [label, avatarSrc] of TEAMS) {
			assert.deepEqual(byTitle["By teams"].items.find((item) => item.label === label)?.avatarSrc, avatarSrc, label);
		}
		for (const retired of ["Favourites", "By my teams", "By partners"]) {
			assert.equal(retired in byTitle, false, `no ${retired} group`);
		}
	}
	await view.unmount();
});

test("the rendered sidebar lists the team rows and offers Show all, and a company row selects its agent", async () => {
	const view = await renderComponent({ props: { demo: true }, source: PROBE });
	const rows = [...sidebar().querySelectorAll("button")].map((button) => button.textContent.trim());
	for (const [label] of TEAMS) {
		assert.equal(rows.some((row) => row.endsWith(label)), true, `team row ${label}`);
	}
	assert.equal(rows.filter((row) => row === "Show all").length, 2, "Show all under both groups");

	const showAll = [...sidebar().querySelectorAll("button")].filter((button) => button.textContent.trim() === "Show all");
	const companyRow = showAll[1].closest("li").previousElementSibling.querySelector("button");
	await view.click(companyRow);
	assert.equal(globalThis.__browseCalls.length, 1, "a company row selects its agent");
	await view.unmount();
});

test("the category sidebar and the results scroll independently", async () => {
	const view = await renderComponent({ props: {}, source: PROBE });
	const results = document.querySelector('section[aria-label="Agents"]');
	const resultsScroller = results.closest(".overflow-y-auto");
	const sidebarScroller = sidebar().closest(".overflow-y-auto") ?? sidebar();
	assert.equal(resultsScroller === null, false);
	assert.equal(sidebarScroller.className.split(/\s+/u).includes("overflow-y-auto"), true);
	assert.equal(resultsScroller.contains(sidebar()), false);
	assert.equal(sidebarScroller.contains(results), false);
	await view.unmount();
});

test("the docs page's session agents carry descriptive bylines", async () => {
	const view = await renderComponent({ source: PAGE_PROBE });
	const yours = [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.trim() === "Your agents");
	await view.click(yours);
	const cardFor = (name) => [...document.querySelectorAll("h3")].find((heading) => heading.textContent === name)?.closest("article")?.textContent ?? "";
	assert.equal(cardFor("Workflow Synthesizer").includes("Workflow design by Revenue Operations"), true);
	assert.equal(cardFor("Research Brief Writer").includes("Research synthesis by Alex Kim"), true);
	for (const name of ["Workflow Synthesizer", "Research Brief Writer"]) {
		assert.equal(cardFor(name).includes("Custom agent"), false, `${name} has a descriptive byline`);
	}
	await view.unmount();
});

test("a directory card selects from its own button, and More actions opens a menu that presses its trigger", async () => {
	const view = await renderComponent({ props: {}, source: PROBE });
	const card = [...document.querySelectorAll('section[aria-label="Agents"] h3')].find((node) => node.textContent === "Alpha").closest("li");
	assert.equal(card.querySelectorAll('[role="button"]').length, 0, "the card itself is not a button, so its controls nest validly");
	const select = view.getByRole("button", { name: "Select Alpha" });
	assert.equal(select.tagName, "BUTTON");

	const more = view.getByRole("button", { name: "More actions for Alpha" });
	assert.equal(more.hasAttribute("aria-pressed"), false);
	await view.click(more);
	assert.equal(more.getAttribute("aria-pressed"), "true");
	assert.deepEqual([...document.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent.trim()), ["Learn more"]);
	await view.click([...document.querySelectorAll('[role="menuitem"]')][0]);
	assert.deepEqual(globalThis.__browseCalls, ["alpha"], "Learn more selects the agent");
	await view.unmount();
});
