const assert = require("node:assert/strict");
const { test } = require("node:test");
const { act } = require("react");
const { renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");

const source = `
	import { useJiraTeamEu26AgentSessionSync } from "@/components/projects/jira-team-eu26/hooks/use-jira-team-eu26-agent-session-sync";
	import { JIRA_TEAM_EU26_DEFAULT_SYNC_SOURCE as original } from "@/components/projects/jira-team-eu26/data/agent-session-sync";
	const session = original.sessions[0];
	const full = { ...original, sessions: [session], seedOverrides: new Map(), cohortById: new Map([[session.id, "full-path"]]) };
	const empty = { ...original, sessions: [], seedOverrides: new Map(), cohortById: new Map() };
	export default function Probe({ preset = "default", paused = false }) {
		const first = useJiraTeamEu26AgentSessionSync({ active: preset === "default", paused, source: full });
		const second = useJiraTeamEu26AgentSessionSync({ active: preset === "wac", paused, source: empty });
		const selected = preset === "default" ? first : second;
		return <output>{selected.settled ? "settled" : "pending"}:{selected.syncedAgentSessions.length}</output>;
	}
`;

async function withTimers(run) {
	const originalSet = window.setTimeout;
	const originalClear = window.clearTimeout;
	const pending = new Map();
	let id = 0;
	window.setTimeout = (callback) => {
		pending.set(++id, callback);
		return id;
	};
	window.clearTimeout = (timerId) => pending.delete(timerId);
	try {
		await run(async () => {
			const next = pending.entries().next().value;
			assert.ok(next, "the active source has a scheduled transition");
			pending.delete(next[0]);
			await act(async () => next[1]());
		}, pending);
	} finally {
		window.setTimeout = originalSet;
		window.clearTimeout = originalClear;
	}
}

test("sync settles only after the selected source's final arrival and queued transitions", async () => {
	await withTimers(async (advance) => {
		const view = await renderComponent({ source });
		assert.equal(view.container.textContent, "pending:0");
		await advance();
		assert.equal(view.container.textContent, "pending:1");
		await advance();
		assert.equal(view.container.textContent, "pending:1");
		await advance();
		assert.equal(view.container.textContent, "settled:1");
		await view.unmount();
	});
});

test("empty, inactive and paused presets retain independent settlement state", async () => {
	await withTimers(async (advance, pending) => {
		const view = await renderComponent({ source, props: { preset: "wac" } });
		assert.equal(view.container.textContent, "settled:0");
		assert.equal(pending.size, 0);
		await view.rerender({ preset: "default", paused: true });
		assert.equal(view.container.textContent, "pending:0");
		assert.equal(pending.size, 0);
		await view.rerender({ preset: "default", paused: false });
		await advance();
		await advance();
		await advance();
		assert.equal(view.container.textContent, "settled:1");
		await view.rerender({ preset: "wac" });
		assert.equal(view.container.textContent, "settled:0");
		await view.rerender({ preset: "default" });
		assert.equal(view.container.textContent, "settled:1");
		await view.unmount();
	});
});
