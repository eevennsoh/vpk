export interface JsonErrorBody {
	error?: unknown;
	details?: unknown;
}

function encodePagePath(pagePath: string): string {
	return pagePath
		.split("/")
		.filter(Boolean)
		.map((part) => encodeURIComponent(part))
		.join("/");
}

export function getVpkHtmlArtifactApiPath(pagePath: string): string {
	return `/api/vpk-html/${encodePagePath(pagePath || "index.html")}`;
}

export function getVpkHtmlNotesApiPath(pagePath: string): string {
	return `/api/vpk-html/notes?page=${encodeURIComponent(pagePath || "index.html")}`;
}

export function getVpkHtmlArtifactDiskPath(pagePath: string, repoRoot?: string): string {
	const normalizedPagePath = (pagePath || "index.html").replace(/^\/+/u, "");
	// Dev-only local artifact pages (local/<repo-relative path>) map to their repo path.
	const relativePath = normalizedPagePath.startsWith("local/")
		? normalizedPagePath.slice("local/".length)
		: `.agents/skills/vpk-html/${normalizedPagePath}`;
	const normalizedRepoRoot = repoRoot?.trim().replace(/\/+$/u, "");

	return normalizedRepoRoot
		? `${normalizedRepoRoot}/${relativePath.replace(/^\.\//u, "")}`
		: relativePath;
}

export function getHtmlDownloadFileName(pagePath: string): string {
	const fileName = pagePath.split("/").filter(Boolean).at(-1) || "index.html";
	const safeName = fileName.replace(/[^a-z0-9._-]+/giu, "-").replace(/^-+|-+$/gu, "");
	return safeName.endsWith(".html") ? safeName : `${safeName || "artifact"}.html`;
}

export function getJsonErrorMessage(payload: JsonErrorBody, fallback: string): string {
	if (typeof payload.error === "string" && payload.error.trim()) {
		return payload.error.trim();
	}
	if (typeof payload.details === "string" && payload.details.trim()) {
		return payload.details.trim();
	}
	return fallback;
}

export async function readJsonResponse<T>(response: Response, fallback: string): Promise<T> {
	const text = await response.text();
	const payload = text ? JSON.parse(text) as JsonErrorBody : {};
	if (!response.ok) {
		throw new Error(getJsonErrorMessage(payload, fallback));
	}

	return payload as T;
}
