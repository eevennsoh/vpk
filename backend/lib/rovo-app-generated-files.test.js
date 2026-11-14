const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
	createRovoAppGeneratedFilesManager,
	extractGeneratedFilesFromStreamedMessages,
} = require("./rovo-app-generated-files");

async function createTempDir(prefix) {
	return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

// A project root that is a git repository: outside one, every file counts as tracked.
async function createProjectRoot(prefix) {
	const projectRoot = await createTempDir(prefix);
	execFileSync("git", ["init", "-q"], { cwd: projectRoot });
	return projectRoot;
}

const createdEvent = (file, toolCallId = "tool-1") => ({
	type: "data-thinking-event",
	data: {
		phase: "result",
		toolName: "create_file",
		toolCallId,
		timestamp: "2026-03-30T00:00:00.000Z",
		outputPreview: `Successfully created ${file}.`,
	},
});

test("extractGeneratedFilesFromStreamedMessages captures file creations from thinking events", async () => {
	const entries = extractGeneratedFilesFromStreamedMessages([{ parts: [createdEvent("app/chat/page.tsx")] }]);

	assert.deepEqual(entries, [
		{
			requestedPath: "app/chat/page.tsx",
			workspacePath: "workspace/source/app/chat/page.tsx.snapshot",
			ownershipSource: "tool_result",
			toolName: "create_file",
			toolCallId: "tool-1",
			firstObservedAt: "2026-03-30T00:00:00.000Z",
			lastObservedAt: "2026-03-30T00:00:00.000Z",
			identity: null,
			change: "created",
		},
	]);
});

test("generated files manager snapshots a run's created files into the thread workspace without removing them", async () => {
	const baseDir = await createTempDir("rovo-app-generated-copy-base-");
	const projectRoot = await createProjectRoot("rovo-app-generated-copy-project-");
	const manager = createRovoAppGeneratedFilesManager({ baseDir, projectRoot, logger: { info() {}, warn() {} } });

	await fs.mkdir(path.join(projectRoot, "app", "chat"), { recursive: true });
	await fs.writeFile(path.join(projectRoot, "app", "chat", "page.tsx"), "export default function SnapshotPage() { return null; }\n", "utf8");

	const [entry] = await manager.recordRunGeneratedFiles("thread-copy", [{ parts: [createdEvent("app/chat/page.tsx")] }]);
	assert.equal(entry.identity.size, 56);

	const captureResult = await manager.captureRootFilesToWorkspace("thread-copy");
	assert.equal(captureResult.copiedCount, 1);
	assert.equal(
		await fs.readFile(path.join(baseDir, "rovo-app", "threads", "thread-copy", "workspace", "source", "app", "chat", "page.tsx.snapshot"), "utf8"),
		"export default function SnapshotPage() { return null; }\n",
	);
	assert.equal(
		await fs.readFile(path.join(projectRoot, "app", "chat", "page.tsx"), "utf8"),
		"export default function SnapshotPage() { return null; }\n",
	);
});
