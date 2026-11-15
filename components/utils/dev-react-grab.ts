export function isAtlasTunnelHostname(hostname: string | null | undefined): boolean {
	if (!hostname) {
		return false;
	}

	const normalized = hostname.trim().toLowerCase();
	return normalized === "atlastunnel.com" || normalized.endsWith(".atlastunnel.com");
}

export function isReactGrabDisabledPath(pathname: string | null): boolean {
	if (!pathname) {
		return false;
	}

	return (
		pathname === "/make"
		|| pathname.startsWith("/make/")
		|| pathname === "/preview/projects/make"
		|| pathname.startsWith("/preview/projects/make/")
		|| pathname === "/html"
		|| pathname.startsWith("/html/")
		|| pathname === "/preview/projects/html"
		|| pathname.startsWith("/preview/projects/html/")
		|| pathname === "/awake"
		|| pathname.startsWith("/awake/")
		|| pathname === "/jira-team-eu26-end"
	);
}

export function shouldDisableReactGrab({
	hostname,
	pathname,
}: Readonly<{
	hostname?: string | null;
	pathname: string | null;
}>): boolean {
	return isReactGrabDisabledPath(pathname) || isAtlasTunnelHostname(hostname);
}

// VPK runs the vpk-grab fork of React Grab (github.com/eevennsoh/vpk-grab).
// `pnpm run update:vpk-grab` moves this, and the `react-grab` tarball in
// package.json, to the latest vpk-grab release.
export const VPK_GRAB_VERSION = "0.2.0-vpk.3";

export const DEFAULT_REACT_GRAB_SCRIPT_SRC = `https://cdn.jsdelivr.net/gh/eevennsoh/vpk-grab@v${VPK_GRAB_VERSION}/dist/vpk-grab.global.js`;

/**
 * Script sources to try in order. A configured build (`NEXT_PUBLIC_REACT_GRAB_SRC`)
 * comes first; the published build stays as the fallback so a worktree that
 * inherits the setting without the build it points at still gets React Grab.
 */
export function resolveReactGrabScriptSources(configuredSrc: string | null | undefined): string[] {
	const trimmedSrc = configuredSrc?.trim();
	if (!trimmedSrc || trimmedSrc === DEFAULT_REACT_GRAB_SCRIPT_SRC) {
		return [DEFAULT_REACT_GRAB_SCRIPT_SRC];
	}

	return [trimmedSrc, DEFAULT_REACT_GRAB_SCRIPT_SRC];
}
