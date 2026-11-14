// The experimental work item's context column and Activity composer as a user drives them: the
// metadata disclosure and its collapsed preview, the AI Planner's search-review-accept flow below
// the title, the Output resource row, and the composer routing prompts, agents, skills and new sessions.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const React = require("react");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const CSS_MODULE = "export default new Proxy({}, { get: (_, key) => String(key) });";
const MOCKS = {
	"@/components/projects/shared/components/chat-messages.module.css": CSS_MODULE,
	"@/components/projects/sidebar-chat/chat.module.css": CSS_MODULE,
};
const WORK_ITEM = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import JiraWorkItem from "@/components/blocks/jira-work-item";
export default function Probe(props) { return <ThemeWrapper><RovoChatProvider><JiraWorkItem {...props} /></RovoChatProvider></ThemeWrapper>; }
`;
const COMMENT_PLACEHOLDER = "Comment, @mention an agent, or / for skills";

// The chat provider talks to the Rovo threads API; answer locally.
const realFetch = globalThis.fetch;
test.before(() => {
	globalThis.fetch = async (_url, init = {}) => {
		const sent = typeof init.body === "string" ? JSON.parse(init.body) : {};
		const now = new Date(0).toISOString();
		const payload = init.method === "POST" || init.method === "PATCH" || init.method === "PUT"
			? { thread: { messages: [], visibility: "private", ...sent, createdAt: now, updatedAt: now } }
			: { threads: [] };
		return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" }, status: 200 });
	};
});
test.after(() => {
	globalThis.fetch = realFetch;
});

function renderWorkItem(preset) {
	return renderComponent({ mocks: MOCKS, props: { initialExperimentalPreset: preset, initialIssueOpen: true, variant: "experimental" }, source: WORK_ITEM });
}

async function tick(context, ms, step = 20) {
	for (let elapsed = 0; elapsed < ms; elapsed += step) {
		await React.act(async () => {
			context.mock.timers.tick(step);
		});
	}
}

async function settle() {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
	}
}

function placeholderOf(box) {
	return box.getAttribute("placeholder") ?? accessibleName(box);
}

function textbox(view, placeholder) {
	return view.getAllByRole("textbox", { hidden: true }).find((box) => placeholderOf(box) === placeholder);
}

function button(view, name) {
	return view.getAllByRole("button", { hidden: true }).find((candidate) => accessibleName(candidate) === name);
}

function metadataToggle(view) {
	return view.getAllByRole("button", { hidden: true }).find((candidate) => /metadata panel$/u.test(accessibleName(candidate)));
}

function sessionEntries() {
	return [...document.querySelectorAll('[data-jira-activity-entry-id^="activity-session-"]')].map((entry) => entry.textContent);
}

function before(first, second) {
	return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

// ── Metadata disclosure ──────────────────────────────────────────────────────

test("the metadata toggle is a disclosure for its panel, not a pressed toggle", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const view = await renderWorkItem("filled");
	const toggle = metadataToggle(view);
	assert.equal(accessibleName(toggle), "Hide metadata panel");
	assert.equal(toggle.getAttribute("aria-expanded"), "true");
	assert.equal(toggle.getAttribute("aria-controls"), "experimental-work-item-metadata-panel");
	assert.equal(document.getElementById("experimental-work-item-metadata-panel") === null, false);
	assert.equal(toggle.hasAttribute("aria-pressed"), false);
	await view.unmount();
});

test("collapsing the metadata panel locks the toggle and title actions until the exit settles", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const view = await renderWorkItem("filled");
	const inertBefore = document.querySelectorAll("[inert]").length;
	await view.click(metadataToggle(view));
	assert.equal(metadataToggle(view).disabled, true, "the toggle waits for the title actions to exit");
	assert.equal(document.querySelectorAll("[inert]").length > inertBefore, true, "the title actions are inert while they exit");

	await tick(context, 400);
	const toggle = metadataToggle(view);
	assert.equal(toggle.disabled, false);
	assert.equal(accessibleName(toggle), "Show metadata panel");
	assert.equal(toggle.getAttribute("aria-expanded"), "false");
	await view.unmount();
});

function metadataPreview() {
	return document.querySelector('[aria-label="Work item details preview"]');
}

// Hover is a pointer path happy-dom does not synthesise, so dispatch the events a mouse sends.
async function hover(element) {
	await React.act(async () => {
		for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter", "pointermove", "mousemove"]) {
			const init = { bubbles: !type.endsWith("enter"), pointerType: "mouse" };
			element.dispatchEvent(type.startsWith("pointer") && typeof PointerEvent === "function" ? new PointerEvent(type, init) : new MouseEvent(type, init));
		}
	});
}

// The popover's open delay runs on the mocked timers, so advance mocked time until the condition
// holds (bounded) instead of sleeping real time.
async function tickUntil(context, condition, maxMs = 2_000) {
	for (let elapsed = 0; elapsed < maxMs && !condition(); elapsed += 20) {
		await React.act(async () => {
			context.mock.timers.tick(20);
		});
	}
	return condition();
}

test("hovering the collapsed metadata toggle previews the rail", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const view = await renderWorkItem("filled");
	await view.click(metadataToggle(view));
	assert.equal(await tickUntil(context, () => accessibleName(metadataToggle(view)) === "Show metadata panel"), true, "the panel collapses");
	assert.equal(metadataPreview() === null, true, "no preview before hovering");

	await hover(metadataToggle(view));
	assert.equal(await tickUntil(context, () => metadataPreview() !== null), true, "hover opens the preview after its delay");
	const previewTabs = [...metadataPreview().querySelectorAll('[role="tab"]')].map((tab) => tab.textContent);
	assert.equal(previewTabs.includes("Details"), true, "the preview is the metadata rail");
	await view.unmount();
});

test("pressing the collapsed metadata toggle docks the panel instead of previewing it", async (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const view = await renderWorkItem("filled");
	await view.click(metadataToggle(view));
	assert.equal(await tickUntil(context, () => accessibleName(metadataToggle(view)) === "Show metadata panel"), true);

	await view.click(metadataToggle(view));
	assert.equal(await tickUntil(context, () => accessibleName(metadataToggle(view)) === "Hide metadata panel"), true, "a press docks the panel");
	assert.equal(metadataToggle(view).getAttribute("aria-expanded"), "true");
	assert.equal(metadataPreview() === null, true, "a press never opens the hover preview");
	await view.unmount();
});

// ── AI Planner ───────────────────────────────────────────────────────────────

test("the context column runs title, AI Planner, resources, then the description", async () => {
	const view = await renderWorkItem("empty");
	const title = button(view, "Edit work item title");
	const planner = document.querySelector('[data-ai-planner-scope="active"]');
	const description = textbox(view, "Work item description");
	assert.equal(planner === null, false, "the empty preset is planning");
	assert.equal(before(title, planner), true, "the planner sits below the title");
	assert.equal(before(planner, description), true, "and above the description");
	await view.unmount();

	const filled = await renderWorkItem("filled");
	const resources = [...document.querySelectorAll("*")].find((node) => node.children.length === 0 && node.textContent === "Attachments");
	assert.equal(before(button(filled, "Edit work item title"), resources), true);
	assert.equal(before(resources, textbox(filled, "Work item description")), true, "resources sit directly above the description");
	await filled.unmount();
});

test("the AI Planner searches Teamwork Graph, then offers its suggestions for review in place of the comment composer", async (context) => {
	context.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
	const view = await renderWorkItem("empty");
	const scope = () => document.querySelector("[data-ai-planner-scope]")?.getAttribute("data-ai-planner-scope") ?? null;
	assert.equal(scope(), "active");
	assert.equal(document.body.textContent.includes("Teamwork Graph"), true);
	assert.equal(textbox(view, COMMENT_PLACEHOLDER) === undefined, true, "the comment composer waits for the planner");

	await tick(context, 10_000, 100);
	assert.equal(textbox(view, "Tell Rovo what to change") === undefined, false, "review offers a refine prompt");
	assert.equal(button(view, "Reject") === undefined, false);
	assert.equal(button(view, "Accept suggestions") === undefined, false);

	await view.click(button(view, "Accept suggestions"));
	assert.equal(scope(), null, "accepting closes the planner");
	assert.equal(textbox(view, COMMENT_PLACEHOLDER) === undefined, false, "and brings the comment composer back");
	await view.unmount();
});

test("rejecting the AI Planner's suggestions closes it and brings the comment composer back", async (context) => {
	context.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
	const view = await renderWorkItem("empty");
	await tick(context, 10_000, 100);
	await view.click(button(view, "Reject"));
	assert.equal(document.querySelector("[data-ai-planner-scope]") === null, true);
	assert.equal(textbox(view, COMMENT_PLACEHOLDER) === undefined, false);
	await view.unmount();
});

// ── Activity composer routing ────────────────────────────────────────────────

test("Assign agents starts a session with the picked agent", async () => {
	const view = await renderWorkItem("filled");
	await settle();
	const sessionsBefore = sessionEntries().length;
	await view.click(button(view, "Assign agents"));
	await settle();
	const option = [...document.querySelectorAll('[role="option"]')].find((node) => node.textContent.includes("Readiness Checker"));
	await view.click(option);
	await settle();
	const sessions = sessionEntries();
	assert.equal(sessions.length, sessionsBefore + 1);
	assert.equal(sessions.at(-1).includes("Readiness Checker"), true);
	await view.unmount();
});

const COMPOSER = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { JiraWorkItemProvider, useJiraWorkItemState } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { PanelLayoutProvider } from "@/components/blocks/jira-work-item/experimental/context-panel-layout";
import { ActivityComposer } from "@/components/blocks/jira-work-item/experimental/components/activity-composer";
import { RFP_101_WORK_ITEM } from "@/components/projects/jira/data/rfp-work-items";
function Sessions() {
	const state = useJiraWorkItemState();
	return <pre data-sessions="">{JSON.stringify(state.sessions.map((session) => ({ agentId: session.agentId, agentName: session.agentName, command: session.command, replies: session.messages.filter((message) => message.role === "human").map((message) => message.content), title: session.title })))}</pre>;
}
export default function Probe() {
	return <ThemeWrapper><JiraWorkItemProvider initialPreset="empty" workItem={RFP_101_WORK_ITEM}><PanelLayoutProvider><ActivityComposer /><Sessions /></PanelLayoutProvider></JiraWorkItemProvider></ThemeWrapper>;
}
`;

test("Use skills starts a Rovo session running the picked skill", async () => {
	const view = await renderComponent({ source: COMPOSER });
	await view.click(button(view, "Use skills"));
	await view.click([...document.querySelectorAll('[role="option"]')].find((node) => node.textContent.includes("Summarize comments")));
	assert.deepEqual(JSON.parse(document.querySelector("[data-sessions]").textContent), [
		{ agentId: "skill:summarize-comments", agentName: "Rovo", command: "/Summarize comments", replies: ["/Summarize comments"], title: "Summarize comments" },
	]);
	await view.unmount();
});

function leafWithText(text) {
	return [...document.querySelectorAll("*")].find((node) => node.children.length === 0 && node.textContent === text);
}

function composerSessions() {
	return JSON.parse(document.querySelector("[data-sessions]").textContent);
}

test("picking an agent from the context pill starts its session with an @agent command", async () => {
	const view = await renderComponent({ source: COMPOSER });
	await view.click(button(view, "Assign agents"));
	await view.click([...document.querySelectorAll('[role="option"]')].find((node) => node.textContent.includes("Readiness Checker")));
	const sessions = composerSessions();
	assert.equal(sessions.length, 1);
	assert.equal(sessions[0].agentName, "Readiness Checker");
	assert.equal(sessions[0].command, "@Readiness Checker");
	await view.unmount();
});

// Tag names its remove button "<removeButtonLabel> <tag text>".
const REMOVE_NEW_SESSION = "Continue in existing session instead New session";

// Mention a working agent again and choose "Start a new session" from the target menu.
async function chooseNewSessionFor(view, followUp) {
	await view.fill(textbox(view, COMMENT_PLACEHOLDER), "@Readiness Checker check the bid");
	await view.click(button(view, "Submit"));
	assert.equal(composerSessions().length, 1, "the first mention starts a session");
	await view.fill(textbox(view, COMMENT_PLACEHOLDER), followUp);
	const menu = document.querySelector("[data-jira-work-item-session-target-menu]");
	assert.equal(menu === null, false, "the agent is working, so the target menu appears");
	await view.click([...menu.querySelectorAll('[role="option"]')].find((node) => node.textContent.includes("Start a new session")));
	assert.equal(document.querySelector("[data-jira-work-item-session-target-menu]") === null, true, "choosing closes the menu");
}

test("after choosing Start a new session, a removable New session tag sits by submit and the prompt opens a new session", async (context) => {
	// Session scripts advance on timers; frozen, the first session stays working.
	context.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
	const view = await renderComponent({ source: COMPOSER });
	await chooseNewSessionFor(view, "@Readiness Checker also check pricing");
	assert.equal(leafWithText("New session") === undefined, false, "the New session tag shows");
	assert.equal(button(view, REMOVE_NEW_SESSION) === undefined, false, "the tag is removable");

	await view.click(button(view, "Submit"));
	assert.deepEqual(composerSessions().map(({ command }) => command), [
		"@Readiness Checker check the bid",
		"@Readiness Checker also check pricing",
	], "the prompt starts a second session instead of replying to the first");
	await view.unmount();
});

test("removing the New session tag sends the prompt to the existing session", async (context) => {
	// Session scripts advance on timers; frozen, the first session stays working.
	context.mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
	const view = await renderComponent({ source: COMPOSER });
	await chooseNewSessionFor(view, "@Readiness Checker also check pricing");
	await view.click(button(view, REMOVE_NEW_SESSION));
	assert.equal(button(view, REMOVE_NEW_SESSION) === undefined, true, "the tag is gone");

	await view.click(button(view, "Submit"));
	const sessions = composerSessions();
	assert.equal(sessions.length, 1, "no new session starts");
	assert.equal(sessions[0].replies.at(-1), "@Readiness Checker also check pricing", "the prompt is a reply in the existing session, not a comment");
	await view.unmount();
});

const RESOURCES = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { JiraWorkItemProvider } from "@/components/blocks/jira-work-item/experimental/context-jira-work-item";
import { ContextResources } from "@/components/blocks/jira-work-item/experimental/components/context-resources";
import { RFP_101_WORK_ITEM } from "@/components/projects/jira/data/rfp-work-items";
export default function Probe({ outputs }) {
	return <ThemeWrapper><JiraWorkItemProvider initialPreset="filled" workItem={RFP_101_WORK_ITEM}><ContextResources outputs={outputs} /></JiraWorkItemProvider></ThemeWrapper>;
}
`;

test("the Output resource row shows only when the work item has outputs", async () => {
	const view = await renderComponent({ props: { outputs: [] }, source: RESOURCES });
	assert.equal(leafWithText("Output") === undefined, true, "no outputs, no Output row");

	await view.rerender({ outputs: ["Bid readiness report"] });
	const label = leafWithText("Output");
	assert.equal(label === undefined, false, "outputs add the Output row");
	const output = leafWithText("Bid readiness report");
	assert.equal(output === undefined, false, "the row lists the output");
	assert.equal(before(label, output), true, "the row lists the outputs after its label");
	await view.unmount();
});

test("an @mention in a comment starts a session for that agent", async () => {
	const view = await renderWorkItem("filled");
	await settle();
	const sessionsBefore = sessionEntries().length;
	await view.fill(textbox(view, COMMENT_PLACEHOLDER), "@Readiness Checker check the bid");
	await settle();
	await view.click(view.getAllByRole("button", { hidden: true }).filter((candidate) => accessibleName(candidate) === "Submit").at(-1));
	await settle();
	const sessions = sessionEntries();
	assert.equal(sessions.length, sessionsBefore + 1);
	assert.equal(sessions.at(-1).includes("Readiness Checker"), true);
	await view.unmount();
});

test("mentioning an agent that is already working asks whether to continue or start a new session", async () => {
	const view = await renderWorkItem("filled");
	await settle();
	await view.fill(textbox(view, COMMENT_PLACEHOLDER), "@Readiness Checker check the bid");
	await settle();
	await view.click(view.getAllByRole("button", { hidden: true }).filter((candidate) => accessibleName(candidate) === "Submit").at(-1));
	await settle();

	await view.fill(textbox(view, COMMENT_PLACEHOLDER), "@Readiness Checker also check pricing");
	await settle();
	const menu = document.querySelector("[data-jira-work-item-session-target-menu]");
	assert.equal(menu === null, false, "the session target menu appears");
	const items = [...menu.querySelectorAll('[role="option"], [role="menuitem"], button')].map((node) => node.textContent.trim()).filter(Boolean);
	assert.equal(items.some((text) => text.includes("Continue in existing session")), true);
	assert.equal(items.some((text) => text.includes("Start a new session")), true);
	await view.unmount();
});

test("the retired planner and activity components stay removed", () => {
	for (const fileName of ["context-summary.tsx", "planner-suggestion.tsx", "activity-event-list.tsx", "activity-agent-event.tsx", "activity-human-event.tsx"]) {
		assert.equal(fs.existsSync(path.join(__dirname, "experimental/components", fileName)), false, fileName);
	}
});
