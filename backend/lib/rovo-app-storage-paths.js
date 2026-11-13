const path = require("node:path");

const { requireStorageId } = require("./input-schemas");

function getRovoAppRootDir(baseDir) {
	return path.join(baseDir, "rovo-app");
}

function getRovoAppThreadsRootDir(baseDir) {
	return path.join(getRovoAppRootDir(baseDir), "threads");
}

function getRovoAppIndicesRootDir(baseDir) {
	return path.join(getRovoAppRootDir(baseDir), "indices");
}

function getRovoAppLegacyDocumentsDir(baseDir) {
	return path.join(getRovoAppRootDir(baseDir), "documents");
}

function getRovoAppLegacyVotesDir(baseDir) {
	return path.join(getRovoAppRootDir(baseDir), "votes");
}

function getRovoAppLegacyUploadsRootDir(baseDir) {
	return path.join(getRovoAppRootDir(baseDir), "uploads");
}

function normalizeThreadId(threadId) {
	return typeof threadId === "string" && threadId.trim() ? threadId.trim() : null;
}

function normalizeRepoRelativePath(requestedPath) {
	if (typeof requestedPath !== "string") {
		return null;
	}

	const normalizedSlashes = requestedPath.trim().replace(/\\/g, "/");
	if (!normalizedSlashes || normalizedSlashes.startsWith("/")) {
		return null;
	}

	const withoutLeadingDots = normalizedSlashes.replace(/^(?:\.\/*)+/u, "");
	if (!withoutLeadingDots) {
		return null;
	}

	const normalizedPath = path.posix.normalize(withoutLeadingDots);
	if (
		normalizedPath === "." ||
		normalizedPath === ".." ||
		normalizedPath.startsWith("../") ||
		normalizedPath.includes("/../")
	) {
		return null;
	}

	return normalizedPath;
}

function buildRovoAppThreadPaths(baseDir, threadId) {
	const normalizedThreadId = normalizeThreadId(threadId);
	if (!normalizedThreadId) {
		throw new Error("A non-empty Rovo threadId is required.");
	}
	// The id is one directory name under threads/; a 400 for anything else.
	requireStorageId(normalizedThreadId, "threadId");

	const threadsRootDir = getRovoAppThreadsRootDir(baseDir);
	const threadDir = path.join(threadsRootDir, normalizedThreadId);
	const workspaceDir = path.join(threadDir, "workspace");
	const workspaceSourceDir = path.join(workspaceDir, "source");

	return {
		threadDir,
		threadFilePath: path.join(threadDir, "thread.json"),
		generatedFilesPath: path.join(threadDir, "generated-files.json"),
		votesFilePath: path.join(threadDir, "votes.json"),
		documentsDir: path.join(threadDir, "documents"),
		uploadsDir: path.join(threadDir, "uploads"),
		workspaceDir,
		workspaceSourceDir,
	};
}

function buildRovoAppWorkspacePath(baseDir, threadId, requestedPath) {
	const workspaceRelativePath = buildRovoAppWorkspaceRelativePath(requestedPath);
	if (!workspaceRelativePath) {
		return null;
	}

	const { threadDir } = buildRovoAppThreadPaths(baseDir, threadId);
	return path.join(threadDir, workspaceRelativePath);
}

function buildRovoAppWorkspaceRelativePath(requestedPath) {
	const normalizedPath = normalizeRepoRelativePath(requestedPath);
	if (!normalizedPath) {
		return null;
	}

	return path.posix.join("workspace", "source", `${normalizedPath}.snapshot`);
}

module.exports = {
	buildRovoAppThreadPaths,
	buildRovoAppWorkspacePath,
	buildRovoAppWorkspaceRelativePath,
	getRovoAppRootDir,
	getRovoAppThreadsRootDir,
	getRovoAppIndicesRootDir,
	getRovoAppLegacyDocumentsDir,
	getRovoAppLegacyVotesDir,
	getRovoAppLegacyUploadsRootDir,
	normalizeThreadId,
	normalizeRepoRelativePath,
};
