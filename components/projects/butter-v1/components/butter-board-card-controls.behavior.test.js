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
