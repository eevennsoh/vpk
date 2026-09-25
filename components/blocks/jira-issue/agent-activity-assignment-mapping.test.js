const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");

const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

let issueAssignmentBridgePromise;

async function loadIssueAssignmentBridge() {
	issueAssignmentBridgePromise ??= (async () => {
		const result = await esbuild.build({
			stdin: {
				contents: `
					export { toAgentAssignmentAgent } from "./components/blocks/jira-issue/agent-activity";
					export { toAssignmentSessionItem } from "./components/blocks/agent-assignment/components/assignment-session";
				`,
				loader: "ts",
				resolveDir: process.cwd(),
				sourcefile: "agent-activity-assignment-mapping-harness.ts",
			},
			bundle: true,
			format: "cjs",
			loader: { ".css": "text" },
			logLevel: "silent",
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			write: false,
		});

		return loadCjsModuleFromText(result.outputFiles[0].text, "agent-activity-assignment-mapping-harness.cjs");
	})();

	return issueAssignmentBridgePromise;
}

test("Jira activity preserves private expired session identity through the assignment bridge", async () => {
	const { toAgentAssignmentAgent, toAssignmentSessionItem } = await loadIssueAssignmentBridge();
	const invokedBy = { avatarSrc: "/avatar-user/venn/venn.png", name: "Venn" };
	const assigned = toAgentAssignmentAgent({
		agentBrandName: "claude",
		agentVpkLogo: "rovo",
		avatarSrc: "/avatars/claude.svg",
		host: "cloud",
		id: "claude-expired-session",
		invokedBy,
		label: "Expired",
		name: "Claude",
		role: "expired",
		state: "completed",
		timeLabel: "29d",
	});

	assert.deepEqual(assigned, {
		avatarSrc: "/avatars/claude.svg",
		brandName: "claude",
		byline: "",
		host: "cloud",
		id: "claude-expired-session",
		invokedBy,
		name: "Claude",
		role: "expired",
		status: "Expired",
		statusKind: "finished",
		statusLabel: "Expired",
		statusSequence: undefined,
		timeLabel: "29d",
		vpkLogo: "rovo",
	});
	assert.deepEqual(toAssignmentSessionItem(assigned), {
		agent: {
			avatarSrc: "/avatars/claude.svg",
			brandName: "claude",
			id: "claude-expired-session",
			kind: "agent",
			name: "Claude",
		},
		host: "cloud",
		id: "claude-expired-session",
		invokedBy,
		role: "expired",
		state: "complete",
		timeLabel: "29d",
		title: "Claude session expired",
	});
});

test("Jira working narration is normalized once for the assignment status sequence", async () => {
	const { toAgentAssignmentAgent } = await loadIssueAssignmentBridge();
	const assigned = toAgentAssignmentAgent({
		cycleIntervalJitterMs: 75,
		cycleIntervalMs: 1_500,
		id: "claude-running-session",
		label: "Gathering context",
		labels: ["Gathering context", "Reviewing dependencies"],
		name: "Claude",
		state: "working",
	});

	assert.equal(assigned.statusKind, "working");
	assert.deepEqual(assigned.statusSequence, ["Gathering context", "Reviewing dependencies"]);
	assert.equal(assigned.statusCycleIntervalMs, 1_500);
	assert.equal(assigned.statusCycleJitterMs, 75);
});
