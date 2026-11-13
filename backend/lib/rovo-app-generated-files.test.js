const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const {
	createRovoAppGeneratedFilesManager,
	extractGeneratedFilesFromThread,
} = require("./rovo-app-generated-files");

const { execFileSync } = require("node:child_process");

async function createTempDir(prefix) {
	return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

// A project root that is a git repository: outside one, every file counts as tracked.
async function createProjectRoot(prefix) {
	const projectRoot = await createTempDir(prefix);
	execFileSync("git", ["init", "-q"], { cwd: projectRoot });
	return projectRoot;
}

test("extractGeneratedFilesFromThread captures file creations from thinking events", async () => {
	const entries = extractGeneratedFilesFromThread({
		id: "thread-1",
		messages: [
			{
				parts: [
					{
						type: "data-thinking-event",
						data: {
							phase: "result",
							toolName: "create_file",
							toolCallId: "tool-1",
							timestamp: "2026-03-30T00:00:00.000Z",
							outputPreview: "Successfully created app/chat/page.tsx.",
						},
					},
				],
			},
		],
	});

	assert.deepEqual(entries, [
		{
			requestedPath: "app/chat/page.tsx",
			workspacePath: "workspace/source/app/chat/page.tsx.snapshot",
			ownershipSource: "tool_result",
			toolName: "create_file",
			toolCallId: "tool-1",
			firstObservedAt: "2026-03-30T00:00:00.000Z",
			lastObservedAt: "2026-03-30T00:00:00.000Z",
		},
	]);
});

test("generated files manager records a run's file creations and relocates untracked root files", async () => {
	const baseDir = await createTempDir("rovo-app-generated-base-");
	const projectRoot = await createProjectRoot("rovo-app-generated-project-");
	const manager = createRovoAppGeneratedFilesManager({
		baseDir,
		projectRoot,
		logger: console,
	});

	await fs.mkdir(path.join(projectRoot, "app", "chat"), { recursive: true });
	await fs.writeFile(
		path.join(projectRoot, "app", "chat", "page.tsx"),
		"export default function Page() { return null; }\n",
		"utf8",
	);

	await manager.recordRunGeneratedFiles("thread-1", [
		{
			parts: [
				{
					type: "data-thinking-event",
					data: {
						phase: "result",
						toolName: "create_file",
						toolCallId: "tool-1",
						timestamp: "2026-03-30T00:00:00.000Z",
						outputPreview: "Successfully created app/chat/page.tsx.",
					},
				},
			],
		},
	]);

	const syncResult = await manager.syncThreadWorkspace("thread-1");
	assert.equal(syncResult.movedCount, 1);
	assert.equal(
		await fs.readFile(
			path.join(
				baseDir,
				"rovo-app",
				"threads",
				"thread-1",
				"workspace",
				"source",
				"app",
				"chat",
				"page.tsx.snapshot",
			),
			"utf8",
		),
		"export default function Page() { return null; }\n",
	);
	await assert.rejects(
		fs.access(path.join(projectRoot, "app", "chat", "page.tsx")),
		/ENOENT/u,
	);
});

test("generated files manager can snapshot root files into the thread workspace without removing them", async () => {
	const baseDir = await createTempDir("rovo-app-generated-copy-base-");
	const projectRoot = await createTempDir("rovo-app-generated-copy-project-");
	const manager = createRovoAppGeneratedFilesManager({
		baseDir,
		projectRoot,
		logger: console,
	});

	await fs.mkdir(path.join(projectRoot, "app", "chat"), { recursive: true });
	await fs.writeFile(
		path.join(projectRoot, "app", "chat", "page.tsx"),
		"export default function SnapshotPage() { return null; }\n",
		"utf8",
	);

	await manager.seedGeneratedFiles("thread-copy", ["app/chat/page.tsx"], "tool_result");

	const captureResult = await manager.captureRootFilesToWorkspace("thread-copy");
	assert.equal(captureResult.copiedCount, 1);
	assert.equal(
		await fs.readFile(
			path.join(
				baseDir,
				"rovo-app",
				"threads",
				"thread-copy",
				"workspace",
				"source",
				"app",
				"chat",
				"page.tsx.snapshot",
			),
			"utf8",
		),
		"export default function SnapshotPage() { return null; }\n",
	);
	assert.equal(
		await fs.readFile(path.join(projectRoot, "app", "chat", "page.tsx"), "utf8"),
		"export default function SnapshotPage() { return null; }\n",
	);
});

test("generated files manager seeds legacy confirmed paths into the manifest", async () => {
	const baseDir = await createTempDir("rovo-app-generated-seed-");
	const projectRoot = await createTempDir("rovo-app-generated-project-");
	const manager = createRovoAppGeneratedFilesManager({
		baseDir,
		projectRoot,
		logger: console,
	});

	const entries = await manager.seedGeneratedFiles("thread-legacy", [
		"components/blocks/analytics-dashboard/page.tsx",
	]);

	assert.equal(entries.length, 1);
	assert.equal(entries[0].ownershipSource, "legacy_user_confirmed");
	assert.equal(
		entries[0].workspacePath,
		"workspace/source/components/blocks/analytics-dashboard/page.tsx.snapshot",
	);
});
