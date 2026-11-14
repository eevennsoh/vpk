// AgentCard's directory variants as a reader sees them: the template card's teammate, app and skill
// sections with no footer call to action, the expanded ticket with its seam and scrolling detail,
// and the experimental profile card's host action, select overlay and stat line.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentCard } from "@/components/blocks/agent-card";

const STATS = [{ value: "12", label: "Remix" }, { value: "3.4K", label: "Chats" }, { value: "2d ago", label: "Last update" }];

export default function Probe({ variant }) {
	const shared = { description: "Drafts the plan.", name: "Planner", publisher: "Atlassian", stats: STATS };
	return (
		<ThemeWrapper>
			{variant === "template" ? (
				<AgentCard
					{...shared}
					collaborators={[{ name: "Ann", src: "/avatar-user/ann.png" }]}
					skills={[{ label: "Summarise" }]}
					sources={[{ id: "jira", label: "Jira", provider: "jira" }]}
					variant="template"
				/>
			) : variant === "expanded" ? (
				<AgentCard {...shared} capabilities={["Find blockers", "Draft updates"]} variant="expanded" />
			) : (
				<AgentCard
					{...shared}
					moreAction={<button type="button">Host actions</button>}
					onSelect={() => { globalThis.__cardSelected = (globalThis.__cardSelected ?? 0) + 1; }}
					variant="experimental-profile"
				/>
			)}
		</ThemeWrapper>
	);
}
`;

function slot(view, name) {
	return view.container.querySelector(`[data-slot="${name}"]`);
}

function sectionLabels(view) {
	return [...view.container.querySelectorAll('[data-slot="agent-card-section"]')].map((section) => section.firstElementChild?.textContent.trim());
}

test("the template card shows who uses it, what it works with and its skills, with no footer call to action", async () => {
	const view = await renderComponent({ props: { variant: "template" }, source: PROBE });
	assert.deepEqual(sectionLabels(view), ["Trusted by teammates", "Works with", "Skills"]);
	assert.equal(view.container.textContent.toLowerCase().includes("summarise"), true, "the skill is listed");
	assert.equal(slot(view, "agent-card-footer") === null, true);
	assert.equal(view.queryByRole("button", { name: "Use template" }) === null, true);
	await view.unmount();
});

test("the expanded card is a ticket: a header, a seam with a tear line, then the scrolling detail", async () => {
	const view = await renderComponent({ props: { variant: "expanded" }, source: PROBE });
	const ticket = slot(view, "agent-card-ticket");
	assert.equal(ticket === null, false);
	const order = [...ticket.querySelectorAll("[data-slot]")].map((node) => node.getAttribute("data-slot"));
	const at = (name) => order.indexOf(name);
	for (const name of ["agent-card-sticky-header", "agent-card-ticket-seam", "agent-card-ticket-tear-line", "agent-card-scroll"]) {
		assert.notEqual(at(name), -1, `${name} is part of the ticket`);
	}
	assert.equal(at("agent-card-sticky-header") < at("agent-card-ticket-seam"), true);
	assert.equal(at("agent-card-ticket-seam") < at("agent-card-scroll"), true);
	assert.equal(slot(view, "agent-card-scroll").textContent.includes("Find blockers"), true, "capabilities scroll below the seam");
	await view.unmount();
});

test("the expanded card shows only its first two stats", async () => {
	const view = await renderComponent({ props: { variant: "expanded" }, source: PROBE });
	const stats = [...view.container.querySelectorAll('[data-slot="agent-card-stat"]')].map((node) => node.textContent.trim());
	assert.deepEqual(stats, ["12 remix", "3.4K chats"]);
	await view.unmount();
});

test("the experimental profile card renders the host's action, selects from its overlay, and skips remix counts", async () => {
	globalThis.__cardSelected = 0;
	const view = await renderComponent({ props: { variant: "experimental-profile" }, source: PROBE });
	assert.equal(view.queryByRole("button", { name: "Host actions" }) === null, false);
	const select = slot(view, "agent-card-select");
	assert.equal(select === null, false);
	await view.click(select);
	assert.equal(globalThis.__cardSelected, 1);
	const stats = [...view.container.querySelectorAll('[data-slot="agent-card-stat"]')].map((node) => node.textContent.trim());
	assert.deepEqual(stats, ["3.4K chats", "2d ago"], "remix is hidden and the last update shows only its value");
	await view.unmount();
});
