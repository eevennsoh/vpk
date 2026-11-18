import assert from "node:assert/strict";
import test from "node:test";

import { AGENT_SESSION_STATUS_LABEL, toAgentSessionMetadataSegments } from "./agent-session-long-metadata.ts";

type Segment = {
	kind: string;
	label?: string;
	prStatus?: string;
	host?: "cloud" | "local";
};

type Input = {
	agentName: string;
	showAgentName?: boolean;
	branch?: string;
	artifactLabel?: string;
	showArtifact?: boolean;
	host?: "cloud" | "local";
	prStatus?: "created" | "merged" | "failed";
	state?: "running" | "needs-input" | "attention" | "complete";
};

const build = toAgentSessionMetadataSegments as (input: Input) => readonly Segment[];

test("an opted-in branch sits between the agent and artifact without changing the default byline", () => {
	assert.deepEqual(build({ agentName: "Jira Coding agent", branch: "feature/VITA-1", artifactLabel: "#1839" }).map((segment) => segment.kind), ["agent", "branch", "artifact", "time"]);
	assert.equal(build({ agentName: "Jira Coding agent", branch: "feature/VITA-1" }).find((segment) => segment.kind === "branch")?.label, "feature/VITA-1");
	assert.equal(build({ agentName: "Jira Coding agent" }).some((segment) => segment.kind === "branch"), false);
});

/** Chunk kinds in order, which is the part the renderer depends on. */
function kinds(input: Input): string[] {
	return build(input).map((segment) => segment.kind);
}

function chunk(input: Input, kind: string): Segment | undefined {
	return build(input).find((segment) => segment.kind === kind);
}

test("a working session shows its agent, artifact, and timestamp", () => {
	assert.deepEqual(
		kinds({
			agentName: "Claude",
			artifactLabel: "#124: Cargo retract",
			host: "local",
			prStatus: "created",
			state: "running",
		}),
		["agent", "artifact", "time"],
	);
	assert.equal(
		chunk({
			agentName: "Claude",
			artifactLabel: "#124: Cargo retract",
			host: "local",
		}, "time")?.host,
		"local",
	);
});

test("metadata never exposes individual tool calls from a session payload", () => {
	const session = { agentName: "Claude", state: "running", toolCalls: ["Editing the shared implementation."] } as const;
	assert.deepEqual(toAgentSessionMetadataSegments(session).map((segment) => segment.kind), ["agent", "time"]);
});

test("agent and time are the only chunks a row always has", () => {
	// A session that declared no host and produced nothing yet still says who ran
	// it and when — never an empty placeholder in between. Progression is the
	// trailing lifecycle icon, not a byline clause.
	assert.deepEqual(kinds({ agentName: "Canva" }), ["agent", "time"]);
});

test("long metadata never states progression in the byline", () => {
	const segments = build({
		agentName: "Claude",
		artifactLabel: "#124: Cargo retract",
		host: "cloud",
	});

	assert.equal(segments.some((segment) => segment.kind === "status"), false);
	assert.equal(segments.some((segment) => segment.label === "Working"), false);
	assert.equal(segments.some((segment) => segment.label === "Needs input"), false);
	assert.equal(segments.some((segment) => segment.label === "Complete"), false);
});

test("an undeclared host stays silent rather than claiming the cloud", () => {
	// `getAgentListHost` answers "cloud" for a payload that never said, which is
	// the right default for behavior and the wrong claim to print on a card.
	assert.equal(chunk({ agentName: "Rovo" }, "host"), undefined);
});

test("the time chunk carries the declared host so icon and clock stay one clause", () => {
	assert.equal(chunk({ agentName: "Claude", host: "local" }, "time")?.host, "local");
	assert.equal(chunk({ agentName: "Claude", host: "cloud" }, "time")?.host, "cloud");
	assert.equal(chunk({ agentName: "Claude", host: "local" }, "host"), undefined);
	assert.equal(kinds({ agentName: "Claude", host: "cloud" }).includes("host"), false);
});

test("status copy stays available for trailing indicators", () => {
	assert.deepEqual(AGENT_SESSION_STATUS_LABEL, {
		attention: "Needs attention",
		complete: "Finished",
		"needs-input": "Needs input",
		running: "Working",
	});
});

test("an artifact chunk needs a real label and carries a glyph status", () => {
	// An empty string is not an artifact. Rendering the chunk anyway would put a
	// pull-request glyph next to nothing at all.
	assert.equal(
		kinds({ agentName: "Claude", artifactLabel: "" }).includes("artifact"),
		false,
	);

	assert.equal(
		chunk({ agentName: "Claude", artifactLabel: "#124: Cargo retract" }, "artifact")?.prStatus,
		"created",
	);
	assert.equal(
		chunk(
			{ agentName: "Claude", artifactLabel: "#124: Cargo retract", prStatus: "merged" },
			"artifact",
		)?.prStatus,
		"merged",
	);
});

test("metadata can omit the pull request while preserving the other segments", () => {
	const input = { agentName: "Claude", artifactLabel: "#124: Cargo retract", host: "cloud" as const };
	assert.deepEqual(kinds(input), ["agent", "artifact", "time"]);
	assert.deepEqual(kinds({ ...input, showArtifact: false }), ["agent", "time"]);
});

test("the builder is pure: same input, equal output, no shared mutation", () => {
	const input: Input = { agentName: "Claude", host: "cloud" };
	const first = build(input);
	const second = build(input);

	assert.deepEqual(first, second);
	assert.notEqual(first, second);
});

test("working and needs-input rows never print the agent name, but keep the agent mark", () => {
	for (const state of ["running", "needs-input", "attention"] as const) {
		const agent = build({ agentName: "Claude", state }).find((segment) => segment.kind === "agent");
		assert.ok(agent, `${state} keeps the agent chunk for its mark`);
		assert.equal(agent.label, undefined, `${state} hides the agent name`);
	}
	assert.equal(build({ agentName: "Claude", state: "complete" }).find((segment) => segment.kind === "agent")?.label, "Claude");
});

test("an explicit name stays visible in the large view for every state", () => {
	for (const state of ["running", "needs-input", "attention", "complete"] as const) {
		const segments = build({ agentName: "Claude", showAgentName: true, state });
		assert.equal(segments.find((segment) => segment.kind === "agent")?.label, "Claude");
		assert.deepEqual(segments.map((segment) => segment.kind), ["agent", "time"]);
	}
});

test("compact metadata can retain a pull request when enabled", () => {
	const compact = (toAgentSessionMetadataSegments as (input: Input & { compact?: boolean }) => readonly Segment[])({
		agentName: "Figma",
		artifactLabel: "#124: Cargo retract",
		compact: true,
		host: "cloud",
		state: "complete",
	});
	assert.deepEqual(compact.map((segment) => segment.kind), ["agent", "artifact", "time"]);
	assert.equal(compact.find((segment) => segment.kind === "agent")?.label, undefined);
});
