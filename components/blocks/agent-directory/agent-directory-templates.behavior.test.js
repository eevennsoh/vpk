// Agent templates inside the Agent Directory, as a user browses and sets them up: the default
// directory lists template categories in its sidebar and shows a category's templates under its
// title; the experimental directory sets a template up in place, one flow per card, and hands the
// built agent back to the host.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const React = require("react");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { AgentsDirectoryDialog } from "@/components/blocks/agent-directory";
import { DEMO_AGENT_BROWSER_AGENTS } from "@/app/data/directory/agents";

const record = (entry) => { (globalThis.__templateCalls ??= []).push(entry); };

export default function Probe({ openConfig = true, variant = "default" }) {
	return (
		<ThemeWrapper>
			<AgentsDirectoryDialog
				agents={DEMO_AGENT_BROWSER_AGENTS}
				onBuildTemplateAgent={(agent) => ({ profileId: "profile-" + agent.id })}
				onOpenBuiltTemplateAgentConfig={openConfig ? (profileId) => record("config:" + profileId) : undefined}
				onOpenChange={() => {}}
				onSelectTemplateAgent={(agent) => record("template:" + agent.id)}
				open
				variant={variant}
			/>
		</ThemeWrapper>
	);
}
`;

const PLANNING_TITLE = ["Turn rough ideas into plans,", "and choose the next step."];

test.beforeEach(() => {
	globalThis.__templateCalls = [];
});

function calls() {
	return globalThis.__templateCalls;
}

function templateSection() {
	return document.querySelector('section[aria-label="Agent templates"]');
}

function cardNames(container) {
	return [...container.querySelectorAll("h3")].map((heading) => heading.textContent);
}

function setupSections() {
	return [...document.querySelectorAll("section[aria-label]")]
		.map((section) => section.getAttribute("aria-label"))
		.filter((label) => label.startsWith("Connect apps for ") || label.startsWith("Build "));
}

async function advance(context, ms) {
	for (let elapsed = 0; elapsed < ms; elapsed += 100) {
		await React.act(async () => {
			context.mock.timers.tick(100);
		});
	}
}

test("the default directory lists template categories and shows a category's templates under its title", async () => {
	const view = await renderComponent({ props: {}, source: PROBE });
	assert.equal(view.queryByRole("button", { name: "Sort by popularity" }) === null, false, "agents mode offers sorting");
	for (const name of ["Planning", "Insights", "Operations", "Writing", "Work management"]) {
		assert.equal(view.queryByRole("button", { name }) === null, false, `${name} category`);
	}

	await view.click(view.getByRole("button", { name: "Planning" }));
	const text = view.getByRole("dialog").textContent;
	for (const line of PLANNING_TITLE) {
		assert.equal(text.includes(line), true, `title line "${line}"`);
	}
	assert.equal(templateSection() === null, false);
	assert.equal(cardNames(templateSection()).length > 0, true);
	assert.equal(view.queryByRole("button", { name: "Sort by popularity" }) === null, true, "the category title replaces sorting");

	await view.click(view.getByRole("button", { name: "All" }));
	// The template grid animates out (Motion exit), so assert what replaces it.
	assert.equal(document.querySelector('section[aria-label="Agents"]') === null, false, "an agent category shows the agents again");
	assert.equal(view.getByRole("button", { name: "All" }).getAttribute("aria-current"), "page");
	assert.equal(view.queryByRole("button", { name: "Sort by popularity" }) === null, false);
	await view.unmount();
});

test("Use template on a default-directory template hands that template to the host", async () => {
	const view = await renderComponent({ props: {}, source: PROBE });
	await view.click(view.getByRole("button", { name: "Planning" }));
	await view.click(view.getAllByRole("button", { name: "Use template" })[0]);
	assert.equal(calls().length, 1);
	assert.equal(calls()[0].startsWith("template:"), true);
	await view.unmount();
});

test("an experimental template opens its own setup flow in place, and Cancel closes only that one", async () => {
	const view = await renderComponent({ props: { variant: "experimental" }, source: PROBE });
	await view.click(view.getByRole("button", { name: "Templates" }));
	assert.equal(document.querySelectorAll("[data-agent-templates-carousel]").length, 1, "templates sit in one carousel");
	const selects = view.getAllByRole("button").filter((button) => /^Select /u.test(accessibleName(button)));
	const [firstName, secondName] = selects.slice(0, 2).map((button) => accessibleName(button).replace(/^Select /u, ""));

	await view.click(selects[0]);
	await view.click(view.getByRole("button", { name: `Select ${secondName}` }));
	assert.deepEqual(setupSections(), [`Connect apps for ${firstName}`, `Connect apps for ${secondName}`]);

	const firstSetup = document.querySelector(`section[aria-label="Connect apps for ${firstName}"]`);
	const cancel = [...firstSetup.querySelectorAll("button")].find((button) => button.textContent.trim() === "Cancel");
	await view.click(cancel);
	assert.deepEqual(setupSections(), [`Connect apps for ${secondName}`]);
	assert.equal(view.queryByRole("button", { name: `Select ${firstName}` }) === null, false, "the cancelled card is back");
	await view.unmount();
});

test("a setup flow's app rows toggle as pressed choices", async () => {
	const view = await renderComponent({ props: { variant: "experimental" }, source: PROBE });
	await view.click(view.getByRole("button", { name: "Templates" }));
	await view.click(view.getAllByRole("button").find((button) => /^Select /u.test(accessibleName(button))));
	const setup = document.querySelector('section[aria-label^="Connect apps for "]');
	const row = [...setup.querySelectorAll("button")].find((button) => !["Continue", "Cancel"].includes(button.textContent.trim()));
	assert.equal(row === undefined, false, "the template lists apps to connect");
	assert.equal(row.hasAttribute("aria-pressed"), false);
	await view.click(row);
	assert.equal(row.getAttribute("aria-pressed"), "true");
	await view.click(row);
	assert.equal(row.hasAttribute("aria-pressed"), false);
	await view.unmount();
});

for (const [openConfig, expected] of [[true, "config:profile-"], [false, "template:"]]) {
	test(`a built template's See agent ${openConfig ? "opens the built agent's config" : "falls back to selecting the template"}`, async (context) => {
		context.mock.timers.enable({ apis: ["setTimeout"] });
		const view = await renderComponent({ props: { openConfig, variant: "experimental" }, source: PROBE });
		await view.click(view.getByRole("button", { name: "Templates" }));
		const select = view.getAllByRole("button").find((button) => /^Select /u.test(accessibleName(button)));
		const templateName = accessibleName(select).replace(/^Select /u, "");
		await view.click(select);
		const setup = document.querySelector(`section[aria-label="Connect apps for ${templateName}"]`);
		await view.click([...setup.querySelectorAll("button")].find((button) => button.textContent.trim().startsWith("Continue")));
		await advance(context, 10_000);
		await view.click(view.getByRole("button", { name: "See agent" }));
		assert.equal(calls().length, 1);
		assert.equal(calls()[0].startsWith(expected), true, calls()[0]);
		await view.unmount();
	});
}
