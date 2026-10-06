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
