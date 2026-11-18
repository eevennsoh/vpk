const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { act } = require("react");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

const PROBE = `
import { useState } from "react";
import { ButterBoardCardControls } from "@/components/projects/butter-v1/components/butter-board-card-controls";

export default function Probe() {
	const [state, setState] = useState("default");
	return <ButterBoardCardControls value={state} onChange={setState} />;
}
`;

test("board card presets select and wrap with arrow keys", async () => {
	const view = await renderComponent({ source: PROBE });
	const idle = view.getByRole("button", { name: "Idle" });
	const owner = view.getByRole("button", { name: "1 agent (Owner)" });
	const mixed = view.getByRole("button", { name: "1-n agents (Owner + Viewer)" });
	const finished = view.getByRole("button", { name: "Finished" });
	assert.equal(idle.getAttribute("aria-pressed"), "true");
	await view.focus(idle);
	await view.press(idle, "ArrowRight");
	assert.equal(owner.getAttribute("aria-pressed"), "true");
	assert.equal(view.isFocused(owner), true);
	await view.press(owner, "ArrowLeft");
	await view.press(idle, "ArrowLeft");
	assert.equal(finished.getAttribute("aria-pressed"), "true");
	assert.equal(view.isFocused(finished), true);
	await view.press(finished, "ArrowLeft");
	assert.equal(mixed.getAttribute("aria-pressed"), "true");
	await view.unmount();
});

test("finished preset moves the same session from working to finished", async () => {
	const originalSet = window.setTimeout;
	const originalClear = window.clearTimeout;
	let finishTimer;
	window.setTimeout = (callback, delay, ...args) => {
		if (delay === 1000) { finishTimer = callback; return 123456; }
		return originalSet(callback, delay, ...args);
	};
	window.clearTimeout = (id) => { if (id !== 123456) originalClear(id); };
	try {
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/page.tsx",
			props: { variant: "project-butter", boardCardState: "finished" },
			mocks: {
				"@/app/contexts": "export function RovoChatProvider({ children }) { return children; } export function useOptionalRovoChat() { return null; }",
				"@/components/projects/jira-golden-journey-v0/components/jira-golden-journey-v0-rovo-overlay": "export function AsxRovoOverlay() { return null; }",
				"@/components/projects/jira-golden-journey-v0/hooks/use-jira-golden-journey-v0-agent-chat-demo": "export function useAsxAgentChatDemo() { return { openAgentChat() {} }; }",
				"@/components/blocks/jira-issue": `export function JiraIssue({ agentActivities, agentDoneRuns, agentActivityMode }) {
					return <output>{JSON.stringify({ agentActivities, agentDoneRuns, agentActivityMode })}</output>;
				}`,
			},
		});
		const before = JSON.parse(view.container.querySelector("output").textContent);
		assert.equal(before.agentActivityMode, "working");
		assert.equal(before.agentActivities[0].stateTransition, "agent-session");
		assert.equal(typeof finishTimer, "function");
		await act(async () => finishTimer());
		const after = JSON.parse(view.container.querySelector("output").textContent);
		assert.equal(after.agentActivityMode, "completed");
		assert.equal(after.agentDoneRuns.length, 1);
		assert.equal(after.agentDoneRuns[0].id, before.agentActivities[0].id);
		assert.equal(after.agentDoneRuns[0].state, "done");
		assert.equal(after.agentDoneRuns[0].stateTransition, "agent-session");
		await view.unmount();
	} finally {
		window.setTimeout = originalSet;
		window.clearTimeout = originalClear;
	}
});

test("board card opens each displayed agent's matching chat profile", async () => {
	const source = `
		import JiraIssuePage from "@/components/blocks/jira-issue/page";
		import { BUTTER_CHAT_AGENT_PROFILES, resolveButterChatAgentId } from "@/components/projects/butter-v1/data/chat-agent-profiles";
		export default function Probe() {
			return <JiraIssuePage variant="project-butter" boardCardState="multiple-agents-working" chatAgents={{ profiles: BUTTER_CHAT_AGENT_PROFILES, resolveId: resolveButterChatAgentId }} />;
		}
	`;
	const view = await renderComponent({ source, mocks: {
		"@/app/contexts": "export function RovoChatProvider({ children, agentProfiles }) { globalThis.__boardCardProfiles = agentProfiles; return children; } export function useOptionalRovoChat() { return null; }",
		"@/components/projects/jira-golden-journey-v0/components/jira-golden-journey-v0-rovo-overlay": "export function AsxRovoOverlay() { return null; }",
		"@/components/projects/jira-golden-journey-v0/hooks/use-jira-golden-journey-v0-agent-chat-demo": "export function useAsxAgentChatDemo() { return { openAgentChat(scenario) { globalThis.__boardCardChat = scenario; } }; }",
		"@/components/blocks/jira-issue": `export function JiraIssue({ agentActivities, onAgentActivityViewChat }) {
			return <>{agentActivities?.map((activity) => <button data-session-title={activity.sessionTitle} key={activity.id} onClick={() => onAgentActivityViewChat(activity)}>{activity.name}</button>)}</>;
		}`,
	} });
	try {
		for (const [name, id] of [["Claude", "claude-code"], ["Cursor", "cursor"]]) {
			assert.notEqual(view.getByRole("button", { name }).getAttribute("data-session-title"), name);
			await view.click(view.getByRole("button", { name }));
			assert.equal(globalThis.__boardCardChat.agentName, name);
			assert.equal(globalThis.__boardCardChat.agentId, id);
			assert.equal(globalThis.__boardCardProfiles.find((profile) => profile.id === id)?.name, name);
		}
	} finally {
		await view.unmount();
		delete globalThis.__boardCardChat;
		delete globalThis.__boardCardProfiles;
	}
});

test("board card keeps its mounted card across presets and replays Finished", async () => {
	const originalSet = window.setTimeout;
	const originalClear = window.clearTimeout;
	const timers = new Map();
	let nextTimer = 10000;
	window.setTimeout = (callback, delay, ...args) => {
		if (delay !== 1000) return originalSet(callback, delay, ...args);
		const id = nextTimer++;
		timers.set(id, callback);
		return id;
	};
	window.clearTimeout = (id) => { if (!timers.delete(id)) originalClear(id); };
	try {
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/page.tsx",
			props: { variant: "project-butter", boardCardState: "default" },
			mocks: {
				"@/app/contexts": "export function RovoChatProvider({ children }) { return children; } export function useOptionalRovoChat() { return null; }",
				"@/components/projects/jira-golden-journey-v0/components/jira-golden-journey-v0-rovo-overlay": "export function AsxRovoOverlay() { return null; }",
				"@/components/projects/jira-golden-journey-v0/hooks/use-jira-golden-journey-v0-agent-chat-demo": "export function useAsxAgentChatDemo() { return { openAgentChat() {} }; }",
				"@/components/blocks/jira-issue": `export function JiraIssue({ agentActivities, agentActivityMode, assignment }) {
					return <div data-testid="card"><output>{JSON.stringify({ agentActivities, agentActivityMode })}</output><button onClick={() => assignment.onAgentAssign({ id: "extra", name: "Extra" })}>Assign</button></div>;
				}`,
			},
		});
		const card = view.container.querySelector('[data-testid="card"]');
		const content = () => JSON.parse(view.container.querySelector("output").textContent);
		await view.rerender({ variant: "project-butter", boardCardState: "single-agent-working" });
		assert.equal(view.container.querySelector('[data-testid="card"]') === card, true);
		assert.equal(content().agentActivities.length, 1);
		await view.click(view.getByRole("button", { name: "Assign" }));
		assert.equal(content().agentActivities.length, 2);
		await view.rerender({ variant: "project-butter", boardCardState: "default" });
		assert.equal(view.container.querySelector('[data-testid="card"]') === card, true);
		assert.equal(content().agentActivityMode, "none");
		for (const [state, count] of [["multiple-agents-working", 2], ["multiple-agents-working-viewer", 2], ["mixed-agents-working", 3]]) {
			await view.rerender({ variant: "project-butter", boardCardState: state });
			assert.equal(view.container.querySelector('[data-testid="card"]') === card, true);
			assert.equal(content().agentActivities.length, count);
		}
		await view.rerender({ variant: "project-butter", boardCardState: "finished" });
		assert.equal(timers.size, 1);
		await view.rerender({ variant: "project-butter", boardCardState: "default" });
		assert.equal(timers.size, 0);
		for (let attempt = 0; attempt < 2; attempt += 1) {
			await view.rerender({ variant: "project-butter", boardCardState: "finished" });
			assert.equal(content().agentActivityMode, "working");
			const [id, callback] = [...timers.entries()][0];
			timers.delete(id);
			await act(async () => callback());
			assert.equal(content().agentActivityMode, "completed");
			await view.rerender({ variant: "project-butter", boardCardState: "default" });
		}
		assert.equal(view.container.querySelector('[data-testid="card"]') === card, true);
		await view.unmount();
	} finally {
		window.setTimeout = originalSet;
		window.clearTimeout = originalClear;
	}
});

test("viewer sessions in board card presets are private to their teammates", async () => {
	for (const boardCardState of ["multiple-agents-working-viewer", "mixed-agents-working"]) {
		const view = await renderComponent({
			entry: "components/blocks/jira-issue/page.tsx",
			props: { variant: "project-butter", boardCardState },
			mocks: {
				"@/app/contexts": "export function RovoChatProvider({ children }) { return children; } export function useOptionalRovoChat() { return null; }",
				"@/components/projects/jira-golden-journey-v0/components/jira-golden-journey-v0-rovo-overlay": "export function AsxRovoOverlay() { return null; }",
				"@/components/projects/jira-golden-journey-v0/hooks/use-jira-golden-journey-v0-agent-chat-demo": "export function useAsxAgentChatDemo() { return { openAgentChat() {} }; }",
				"@/components/blocks/jira-issue": "export function JiraIssue({ agentActivities }) { return <output>{JSON.stringify(agentActivities)}</output>; }",
			},
		});
		const activities = JSON.parse(view.container.querySelector("output").textContent);
		const viewers = activities.filter((activity) => activity.role === "viewer");
		assert.equal(viewers.length, 2);
		for (const activity of viewers) assert.equal(activity.privateTo, activity.invokedBy.name);
		for (const activity of activities.filter((item) => item.role === "owner")) assert.equal(activity.privateTo, undefined);
		await view.unmount();
	}
});
