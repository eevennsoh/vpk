import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types test runner requires the explicit .ts extension here.
import { AGENT_SESSION_STATUS_LABEL, toAgentSessionMetadataSegments } from "./agent-session-long-metadata.ts";

type Segment = {
	kind: string;
	label?: string;
	prStatus?: string;
	host?: "cloud" | "local";
	toolCalls?: readonly string[];
};

type Input = {
	agentName: string;
	artifactLabel?: string;
	host?: "cloud" | "local";
	prStatus?: "created" | "merged" | "failed";
	toolCalls?: readonly string[];
};

const build = toAgentSessionMetadataSegments as (input: Input) => readonly Segment[];

/** Chunk kinds in order, which is the part the renderer depends on. */
function kinds(input: Input): string[] {
	return build(input).map((segment) => segment.kind);
}

function chunk(input: Input, kind: string): Segment | undefined {
	return build(input).find((segment) => segment.kind === kind);
}

test("a fully described session reads agent, tool call, artifact, then host-tagged time", () => {
	assert.deepEqual(
		kinds({
			agentName: "Claude",
			artifactLabel: "#124: Cargo retract",
			host: "local",
			prStatus: "created",
			toolCalls: ["Reading the relevant files.", "Editing the shared implementation."],
		}),
		["agent", "tool-call", "artifact", "time"],
	);
	assert.deepEqual(
		chunk({ agentName: "Claude", toolCalls: ["Reading the relevant files.", "Editing the shared implementation."] }, "tool-call")?.toolCalls,
		["Reading the relevant files.", "Editing the shared implementation."],
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

test("empty tool-call labels are omitted instead of leaving a blank clause", () => {
	assert.deepEqual(
		kinds({ agentName: "Claude", toolCalls: ["", "  "] }),
		["agent", "time"],
	);
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
		complete: "Complete",
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

test("the builder is pure: same input, equal output, no shared mutation", () => {
	const input: Input = { agentName: "Claude", host: "cloud" };
	const first = build(input);
	const second = build(input);

	assert.deepEqual(first, second);
	assert.notEqual(first, second);
});
