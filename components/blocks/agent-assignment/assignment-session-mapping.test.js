const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadAssignmentSessionMapper() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					toAssignmentActivity,
					toAssignmentSessionItem,
				} from "./components/blocks/agent-assignment/components/assignment-session";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "assignment-session-mapping-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "assignment-session-mapping-harness.cjs");
}

function assignmentAgent(overrides = {}) {
	return {
		byline: "AI agent",
		id: "release-notes-drafter",
		name: "Release notes drafter",
		statusLabel: "Watching",
		...overrides,
	};
}

test("maps every assigned-agent status to the session and activity states users see", async () => {
	const { toAssignmentActivity, toAssignmentSessionItem } = await loadAssignmentSessionMapper();
	const cases = [
		{ activity: "working", label: "Working", session: "running", statusKind: "working" },
		{ activity: "awaiting-input", label: "Needs input", session: "needs-input", statusKind: "needs-input" },
		{ activity: "completed", label: "Finished", session: "complete", statusKind: "finished" },
		{ activity: "completed", label: "Reviewing", session: "complete", statusKind: "idle" },
	];

	for (const expected of cases) {
		const agent = assignmentAgent({
			statusKind: expected.statusKind,
			statusLabel: expected.statusKind === "idle" ? expected.label : "Ignored for explicit status",
		});

		assert.equal(toAssignmentSessionItem(agent).state, expected.session);
		assert.deepEqual(
			toAssignmentActivity(agent),
			{
				id: "release-notes-drafter",
				label: expected.label,
				name: "Release notes drafter",
				...(expected.statusKind === "needs-input" ? { role: "owner" } : {}),
				state: expected.activity,
			},
		);
	}
});

test("preserves assigned-session identity and narrator metadata through both presenters", async () => {
	const { toAssignmentActivity, toAssignmentSessionItem } = await loadAssignmentSessionMapper();
	const agent = assignmentAgent({
		avatarSrc: "/avatars/release-notes-drafter.svg",
		brandName: "github-copilot",
		host: "local",
		invokedBy: { avatarSrc: "/avatars/mia.svg", name: "Mia Tan" },
		role: "viewer",
		statusKind: "working",
		statusSequence: ["Inspecting release notes"],
	});

	assert.deepEqual(toAssignmentSessionItem(agent), {
		agent: {
			avatarSrc: "/avatars/release-notes-drafter.svg",
			brandName: "github-copilot",
			id: "release-notes-drafter",
			kind: "agent",
			name: "Release notes drafter",
		},
		host: "local",
		id: "release-notes-drafter",
		invokedBy: { avatarSrc: "/avatars/mia.svg", name: "Mia Tan" },
		role: "viewer",
		state: "running",
		title: "Release notes drafter",
	});
	assert.deepEqual(toAssignmentActivity(agent), {
		agentBrandName: "github-copilot",
		avatarSrc: "/avatars/release-notes-drafter.svg",
		host: "local",
		id: "release-notes-drafter",
		invokedBy: { avatarSrc: "/avatars/mia.svg", name: "Mia Tan" },
		label: "Working",
		labels: ["Inspecting release notes"],
		name: "Release notes drafter",
		role: "viewer",
		state: "working",
	});
});

test("uses meaningful status narration to infer working and safely falls back to Assigned", async () => {
	const { toAssignmentActivity, toAssignmentSessionItem } = await loadAssignmentSessionMapper();
	assert.equal(
		toAssignmentSessionItem(assignmentAgent({ statusSequence: ["Preparing a summary"] })).state,
		"running",
	);
	assert.deepEqual(
		toAssignmentActivity(assignmentAgent({ statusLabel: "  ", statusSequence: ["  "] })),
		{
			id: "release-notes-drafter",
			label: "Assigned",
			name: "Release notes drafter",
			state: "completed",
		},
	);
});

test("needs-input viewer sessions preserve access and attribution in both presenters", async () => {
	const { toAssignmentActivity, toAssignmentSessionItem } = await loadAssignmentSessionMapper();
	const agent = assignmentAgent({
		role: "viewer",
		statusKind: "needs-input",
		invokedBy: { name: "Jordan", avatarSrc: "/avatars/jordan.svg" },
	});
	for (const result of [toAssignmentActivity(agent), toAssignmentSessionItem(agent)]) {
		assert.equal(result.role, "viewer");
		assert.deepEqual(result.invokedBy, agent.invokedBy);
	}
});
