// JiraWorkItem as a user and a docs page meet it: the standard view's modal and floating Rovo chat,
// each experimental surface's own dialog with a steady comment composer and the shared Rovo chat,
// the experimental presets, the title Open split button, the variant chooser page, and the docs
// layout that supplies the chat runtime.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const React = require("react");

const { accessibleName, renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const CSS_MODULE = "export default new Proxy({}, { get: (_, key) => String(key) });";
const CHAT_MOCKS = {
	"@/components/projects/shared/components/chat-messages.module.css": CSS_MODULE,
	"@/components/projects/sidebar-chat/chat.module.css": CSS_MODULE,
};

const WORK_ITEM = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import JiraWorkItem from "@/components/blocks/jira-work-item";
export default function Probe(props) {
	return (
		<ThemeWrapper>
			<RovoChatProvider>
				<JiraWorkItem {...props} onIssueClose={() => { globalThis.__issueClosed = (globalThis.__issueClosed ?? 0) + 1; }} />
			</RovoChatProvider>
		</ThemeWrapper>
	);
}
`;

const COMMENT_PLACEHOLDER = "Comment, @mention an agent, or / for skills";

async function renderWorkItem(props) {
	const view = await renderComponent({ mocks: CHAT_MOCKS, props, source: WORK_ITEM });
	await settle(view, props);
	return view;
}

// Lazy surfaces and the chat runtime resolve over a few macrotasks.
async function settle(view, props) {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		await view.rerender(props);
	}
}

function buttonNames(view, options) {
	return view.getAllByRole("button", options).map((button) => accessibleName(button));
}

function textboxNames(view) {
	return view.getAllByRole("textbox", { hidden: true }).map(placeholderOf);
}

// The chat provider talks to the Rovo threads API. Answer locally: no saved threads, and a created
// or updated thread echoes what was sent.
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

test.beforeEach(() => {
	globalThis.__issueClosed = 0;
});

function placeholderOf(box) {
	return box.getAttribute("placeholder") ?? accessibleName(box);
}

test("the standard work item opens from its trigger and closes back, telling the host", async () => {
	const closed = await renderWorkItem({ initialIssueOpen: false });
	assert.deepEqual(buttonNames(closed), ["Open work item"]);
	await closed.click(closed.getByRole("button", { name: "Open work item" }));
	assert.equal(buttonNames(closed).includes("AI summary"), true, "the standard modal opens");
	const [close] = closed.getAllByRole("button", { name: "Close" });
	await closed.click(close);
	assert.deepEqual(buttonNames(closed), ["Open work item"]);
	assert.equal(globalThis.__issueClosed, 1);
	await closed.unmount();
});

test("the standard work item's floating Rovo launcher swaps itself for the floating chat", async () => {
	const props = { initialIssueOpen: true };
	const view = await renderWorkItem(props);
	assert.equal(textboxNames(view).includes("Chat message input"), false);
	await view.click(view.getByRole("button", { name: "Open Rovo chat" }));
	await settle(view, props);
	assert.equal(view.queryByRole("button", { name: "Open Rovo chat" }) === null, true, "the launcher hides while the chat is open");
	assert.equal(textboxNames(view).includes("Chat message input"), true);
	await view.unmount();
});

for (const variant of ["experimental", "experimental-v2", "experimental-v3", "team-eu26"]) {
	test(`the ${variant} surface opens its own dialog, and its comment composer stays put on focus`, async () => {
		const view = await renderWorkItem({ initialIssueOpen: true, variant });
		assert.equal(document.querySelectorAll('[role="dialog"]').length, 1);
		assert.equal(buttonNames(view, { hidden: true }).includes("AI summary"), false, "no standard modal underneath");
		const comment = view.getAllByRole("textbox", { hidden: true }).find((box) => placeholderOf(box) === COMMENT_PLACEHOLDER);
		assert.equal(comment === undefined, false, "the comment composer is offered");
		const composer = comment.closest("form") ?? comment.parentElement.parentElement.parentElement;
		const before = [...composer.querySelectorAll("button")].map((button) => accessibleName(button));
		await view.focus(comment);
		await settle(view, { initialIssueOpen: true, variant });
		assert.equal(placeholderOf(comment), COMMENT_PLACEHOLDER, "the placeholder does not switch to an expanded one");
		assert.deepEqual([...composer.querySelectorAll("button")].map((button) => accessibleName(button)), before, "no expanded toolbar appears");
		await view.unmount();
	});
}

test("the experimental surface's Rovo launcher opens the shared Rovo chat", async () => {
	const props = { initialIssueOpen: true, variant: "experimental" };
	const view = await renderWorkItem(props);
	assert.equal(textboxNames(view).includes("Chat message input"), false);
	await view.click(view.getByRole("button", { hidden: true, name: "Open Rovo chat" }));
	await settle(view, props);
	assert.equal(textboxNames(view).includes("Chat message input"), true);
	await view.unmount();
});

test("the filled experimental preset shows subtasks and activity, and the empty preset does not", async () => {
	const filled = await renderWorkItem({ initialExperimentalPreset: "filled", initialIssueOpen: true, variant: "experimental" });
	const filledButtons = buttonNames(filled, { hidden: true });
	assert.equal(filledButtons.some((name) => name.startsWith("Remove RFP-110")), true);
	assert.equal(filledButtons.includes("Reply"), true);
	await filled.unmount();

	const empty = await renderWorkItem({ initialExperimentalPreset: "empty", initialIssueOpen: true, variant: "experimental" });
	const emptyButtons = buttonNames(empty, { hidden: true });
	assert.equal(emptyButtons.some((name) => name.startsWith("Remove RFP-110")), false);
	assert.equal(emptyButtons.includes("Reply"), false);
	await empty.unmount();
});

const TITLE_ACTIONS = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { ContextTitleActions } from "@/components/blocks/jira-work-item/experimental/components/context-title-actions";
export default function Probe(props) { return <ThemeWrapper><ContextTitleActions {...props} /></ThemeWrapper>; }
`;

function menuItems() {
	return [...document.querySelectorAll('[role="menuitem"]')].map((item) => item.textContent.trim());
}

test("the title Open split button opens with Claude and lists the other coding agents", async () => {
	const view = await renderComponent({ props: {}, source: TITLE_ACTIONS });
	assert.equal(view.queryByRole("button", { name: "Open with Claude" }) === null, false);
	for (const name of ["No restrictions", "Share"]) {
		assert.equal(view.queryByRole("button", { name }) === null, false, `${name} sits beside the split button`);
	}
	await view.click(view.getByRole("button", { name: "More open options" }));
	assert.deepEqual(menuItems(), ["Codex", "Rovo CLI", "Cursor", "VS Code", "GitHub Copilot", "Gemini", "Copy prompt"]);
	await view.unmount();
});

test("a collapsed title folds No restrictions, Watch and Share into an Actions menu", async () => {
	const view = await renderComponent({ props: { collapsed: true, primaryAgentId: "codex" }, source: TITLE_ACTIONS });
	assert.equal(view.queryByRole("button", { name: "Open with Codex" }) === null, false);
	assert.equal(view.queryByRole("button", { name: "No restrictions" }) === null, true);
	assert.equal(view.queryByRole("button", { name: "Share" }) === null, true);
	await view.click(view.getByRole("button", { name: "Actions" }));
	assert.deepEqual(menuItems(), ["No restrictions", "Watch1", "Share"]);
	await view.unmount();
});

const SCRIPTS = `
import { SESSION_SCRIPTS } from "@/components/blocks/jira-work-item/data/session-scripts";
export default function Probe() { return <pre>{JSON.stringify(SESSION_SCRIPTS)}</pre>; }
`;

test("the scripted demo sessions use human task titles and two waiting questions", async () => {
	const view = await renderComponent({ source: SCRIPTS });
	const text = view.container.querySelector("pre").textContent;
	const scripts = Object.values(JSON.parse(text));
	const titles = scripts.map((script) => script.title);
	for (const title of ["Map Acmecorp’s compliance requirements", "Review Acmecorp’s bid risks", "Model pricing options for Acmecorp", "Recommend next steps for this work item"]) {
		assert.equal(titles.includes(title), true, title);
	}
	for (const terse of ["Compliance matrix", "Risk review", "Pricing draft", "Work item assistant"]) {
		assert.equal(titles.includes(terse), false, terse);
	}
	assert.equal((text.match(/"waitAfterIndex":/gu) ?? []).length, 2);
	for (const label of ["Add suggested description", "Keep current description", "Assume 5,000 seats", "Model a 5,000–10,000-seat range"]) {
		assert.equal(text.includes(`"label":"${label}"`), true, `waiting option ${label}`);
	}
	await view.unmount();
});

test("the retired floating-session panel files stay removed", () => {
	for (const fileName of ["floating-session-panel.tsx", "floating-session-header.tsx", "floating-session-transcript.tsx", "floating-session-progress.tsx", "floating-session-composer.tsx", "floating-session-launcher.tsx"]) {
		assert.equal(fs.existsSync(path.join(__dirname, "experimental/components", fileName)), false, fileName);
	}
});

const CHOOSER = `
import { ThemeWrapper } from "@/components/utils/theme-wrapper";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import JiraWorkItemPage from "@/components/blocks/jira-work-item/page";
export default function Probe() { return <ThemeWrapper><RovoChatProvider><JiraWorkItemPage /></RovoChatProvider></ThemeWrapper>; }
`;

const CHOOSER_LABELS = ["Open standard session", "Open experimental session", "Open experimental v2 session", "Open experimental v3 session", "Open experimental v4 session", "Open experimental v5 session", "Open Team EU26 session"];

test("the docs page chooses a variant, with the newest fork as the one primary action", async () => {
	const view = await renderComponent({ mocks: CHAT_MOCKS, source: CHOOSER });
	const buttons = CHOOSER_LABELS.map((name) => view.getByRole("button", { name }));
	const outline = buttons.filter((button) => button.getAttribute("data-variant") === "outline").map((button) => accessibleName(button));
	assert.deepEqual(outline, CHOOSER_LABELS.filter((label) => label !== "Open Team EU26 session"), "every older entry is an outline button");
	assert.notEqual(view.getByRole("button", { name: "Open Team EU26 session" }).getAttribute("data-variant"), "outline");

	await view.click(view.getByRole("button", { name: "Open experimental session" }));
	await settle(view, {});
	assert.equal(document.querySelectorAll('[role="dialog"]').length, 1, "the chosen variant opens");
	assert.equal(buttonNames(view, { hidden: true }).some((name) => name.startsWith("Remove RFP-110")), true, "with the filled preset");
	await view.unmount();
});

const DOC_LAYOUT = `
import { Suspense, use } from "react";
import ComponentDocLayout from "@/app/components/[category]/[slug]/layout";
function Resolved({ result }) { return use(result); }
export default function Probe({ category, slug }) {
	const result = ComponentDocLayout({ children: <p>doc body</p>, params: Promise.resolve({ category, slug }) });
	return <Suspense fallback={<p>loading</p>}><Resolved result={result} /></Suspense>;
}
`;
const DOC_LAYOUT_MOCKS = {
	"@/app/components/[category]/[slug]/chat-runtime-provider": "export function ComponentDocChatRuntimeProvider({ children }) { return <div data-chat-runtime=\"\">{children}</div>; }",
};

for (const [slug, expected] of [["jira-work-item", true], ["button", false]]) {
	test(`the component docs layout ${expected ? "wraps" : "does not wrap"} blocks/${slug} in the chat runtime`, async () => {
		const view = await renderComponent({ mocks: DOC_LAYOUT_MOCKS, props: { category: "blocks", slug }, source: DOC_LAYOUT });
		for (let attempt = 0; attempt < 5 && view.container.textContent === "loading"; attempt += 1) {
			await React.act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
			});
		}
		assert.equal(view.container.textContent, "doc body");
		assert.equal(view.container.querySelector("[data-chat-runtime]") !== null, expected);
		await view.unmount();
	});
}
