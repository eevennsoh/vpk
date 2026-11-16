const path = require("node:path");

const { normalizeRepoRelativePath } = require("./rovo-app-storage-paths");

const GENERATED_MEDIA_ROUTE = "/api/rovo/generated-media";
const GENERATED_VIDEO_ROOT = "media/videos";
const GENERATED_VIDEO_PATH_PATTERN =
	/(?:^|[\s"'`])((?:\.\/)?media\/videos\/[^\s"'`]+?\.(?:mp4|webm|mov|m4v|ogv))(?:$|[\s"'`])/giu;
const GENERATED_VIDEO_CONTENT_TYPES = new Map([
	[".m4v", "video/x-m4v"],
	[".mov", "video/quicktime"],
	[".mp4", "video/mp4"],
	[".ogv", "video/ogg"],
	[".webm", "video/webm"],
]);

function hasTraversalSegments(value) {
	if (typeof value !== "string") {
		return false;
	}

	return value
		.trim()
		.replace(/\\/g, "/")
		.split("/")
		.some((segment) => segment === "..");
}

function isAllowedGeneratedMediaPath(normalizedPath) {
	return (
		typeof normalizedPath === "string" &&
		(normalizedPath === GENERATED_VIDEO_ROOT ||
			normalizedPath.startsWith(`${GENERATED_VIDEO_ROOT}/`))
	);
}

function inferGeneratedMediaContentType(requestedPath) {
	if (hasTraversalSegments(requestedPath)) {
		return null;
	}

	const normalizedPath = normalizeRepoRelativePath(requestedPath);
	if (!normalizedPath || !isAllowedGeneratedMediaPath(normalizedPath)) {
		return null;
	}

	return GENERATED_VIDEO_CONTENT_TYPES.get(path.extname(normalizedPath).toLowerCase()) || null;
}

function buildGeneratedMediaUrl(requestedPath) {
	if (hasTraversalSegments(requestedPath)) {
		return null;
	}

	const normalizedPath = normalizeRepoRelativePath(requestedPath);
	if (!normalizedPath || !isAllowedGeneratedMediaPath(normalizedPath)) {
		return null;
	}

	if (!inferGeneratedMediaContentType(normalizedPath)) {
		return null;
	}

	return `${GENERATED_MEDIA_ROUTE}?path=${encodeURIComponent(normalizedPath)}`;
}

/** The media path a generated-media URL (as built by buildGeneratedMediaUrl) serves, or null. */
function parseGeneratedMediaUrlPath(url) {
	if (typeof url !== "string" || !url.trim().startsWith(`${GENERATED_MEDIA_ROUTE}?`)) {
		return null;
	}
	const requestedPath = new URLSearchParams(url.trim().slice(GENERATED_MEDIA_ROUTE.length + 1)).get("path");
	return requestedPath && buildGeneratedMediaUrl(requestedPath) ? normalizeRepoRelativePath(requestedPath) : null;
}

function resolveGeneratedMediaAbsolutePath(projectRoot, requestedPath) {
	if (hasTraversalSegments(requestedPath)) {
		return null;
	}

	const normalizedPath = normalizeRepoRelativePath(requestedPath);
	if (!normalizedPath || !isAllowedGeneratedMediaPath(normalizedPath)) {
		return null;
	}

	if (!inferGeneratedMediaContentType(normalizedPath)) {
		return null;
	}

	const resolvedProjectRoot = path.resolve(projectRoot);
	const absolutePath = path.resolve(resolvedProjectRoot, normalizedPath);
	const relativeToProjectRoot = path.relative(resolvedProjectRoot, absolutePath);
	if (
		relativeToProjectRoot.startsWith("..") ||
		path.isAbsolute(relativeToProjectRoot)
	) {
		return null;
	}

	return absolutePath;
}

function extractGeneratedVideoPathFromString(value) {
	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}

	for (const match of value.matchAll(new RegExp(GENERATED_VIDEO_PATH_PATTERN))) {
		const normalizedPath = normalizeRepoRelativePath(match[1]);
		if (!normalizedPath || !isAllowedGeneratedMediaPath(normalizedPath)) {
			continue;
		}

		if (!inferGeneratedMediaContentType(normalizedPath)) {
			continue;
		}

		return normalizedPath;
	}

	return null;
}

function findGeneratedVideoPathInValue(value, depth = 0) {
	if (depth > 6 || value === null || value === undefined) {
		return null;
	}

	if (typeof value === "string") {
		return extractGeneratedVideoPathFromString(value);
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			const nestedMatch = findGeneratedVideoPathInValue(entry, depth + 1);
			if (nestedMatch) {
				return nestedMatch;
			}
		}
		return null;
	}

	if (typeof value !== "object") {
		return null;
	}

	for (const entry of Object.values(value)) {
		const nestedMatch = findGeneratedVideoPathInValue(entry, depth + 1);
		if (nestedMatch) {
			return nestedMatch;
		}
	}

	return null;
}

module.exports = {
	GENERATED_MEDIA_ROUTE,
	buildGeneratedMediaUrl,
	extractGeneratedVideoPathFromString,
	findGeneratedVideoPathInValue,
	inferGeneratedMediaContentType,
	parseGeneratedMediaUrlPath,
	resolveGeneratedMediaAbsolutePath,
};
