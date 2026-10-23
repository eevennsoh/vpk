const VPK_HTML_PREFIX = "/api/vpk-html/";
const VPK_HTML_INDEX_URL = "/api/vpk-html/index.html";
const LOCAL_PAGE_PREFIX = "local/";
// Same grammar as backend/routes/vpk-html.js LOCAL_ARTIFACT_PATTERN (dev-only artifact pages).
const LOCAL_ARTIFACT_PATTERN = /^(?:artifacts\/vpk-html|output\/vpk-html[a-z0-9-]*)\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)*[A-Za-z0-9][A-Za-z0-9._-]*\.html$/u;
const DEMO_PAGE_PATTERN = /^assets\/demos\/[A-Za-z0-9][A-Za-z0-9._-]*\.html$/u;

export function isLocalArtifactPage(pagePath: string): boolean {
	return typeof pagePath === "string"
		&& pagePath.startsWith(LOCAL_PAGE_PREFIX)
		&& LOCAL_ARTIFACT_PATTERN.test(pagePath.slice(LOCAL_PAGE_PREFIX.length));
}

// The iframe src for /html?page=<param>: catalog demos always; local artifacts only when allowed.
export function resolveHtmlPageSrc(
	param: string | null | undefined,
	{ allowLocal = false }: Readonly<{ allowLocal?: boolean }> = {},
): string {
	const page = typeof param === "string" ? param.trim() : "";
	if (DEMO_PAGE_PATTERN.test(page)) {
		return `${VPK_HTML_PREFIX}${page}`;
	}
	if (allowLocal && isLocalArtifactPage(page)) {
		return `${VPK_HTML_PREFIX}${page.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
	}
	return VPK_HTML_INDEX_URL;
}

function decodePathSegment(segment: string): string {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}

export function normalizeVpkHtmlPagePath(pathname: string): string {
	if (pathname === "/api/vpk-html" || pathname === "/api/vpk-html/") {
		return "index.html";
	}

	if (!pathname.startsWith(VPK_HTML_PREFIX)) {
		return pathname === "about:srcdoc" ? "srcdoc" : pathname.replace(/^\/+/u, "") || "srcdoc";
	}

	const stripped = pathname.slice(VPK_HTML_PREFIX.length);
	return stripped
		.split("/")
		.map(decodePathSegment)
		.join("/") || "index.html";
}

export function getDiskPathForPage(pagePath: string): string | undefined {
	if (!pagePath || pagePath === "srcdoc") {
		return undefined;
	}

	if (pagePath.startsWith(LOCAL_PAGE_PREFIX)) {
		return isLocalArtifactPage(pagePath) ? pagePath.slice(LOCAL_PAGE_PREFIX.length) : undefined;
	}

	return `.agents/skills/vpk-html/${pagePath}`;
}

export function getPageUrlForPin(pagePath: string): string {
	if (!pagePath || pagePath === "srcdoc") {
		return "srcdoc";
	}

	return `/api/vpk-html/${pagePath}`;
}

export function resolveIframePage(
	iframe: HTMLIFrameElement | null,
): { diskPath?: string; pagePath: string; url: string } {
	if (!iframe) {
		return { pagePath: "srcdoc", url: "srcdoc" };
	}

	try {
		const location = iframe.contentWindow?.location;
		if (!location || location.href === "about:srcdoc") {
			return { pagePath: "srcdoc", url: "srcdoc" };
		}

		const pagePath = normalizeVpkHtmlPagePath(location.pathname);
		return {
			diskPath: getDiskPathForPage(pagePath),
			pagePath,
			url: location.href,
		};
	} catch {
		return { pagePath: "srcdoc", url: "srcdoc" };
	}
}
