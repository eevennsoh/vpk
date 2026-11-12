import { NextResponse } from "next/server";
import { isLoopbackHostname, isLoopbackOrigin } from "@/lib/local-request";

function hostnameOf(request: Request): string | null {
	const host = request.headers.get("host") ?? new URL(request.url).host;
	try {
		return new URL(`http://${host}`).hostname.replace(/^\[(.*)\]$/u, "$1");
	} catch {
		return null;
	}
}

/**
 * True when a browser request to a dev proxy adapter comes from this machine: its Host
 * is localhost, 127.0.0.1, ::1 or a Portless `*.localhost` name, and any Origin is an
 * http(s) origin on one of those hosts. The backend cannot tell these apart because
 * the proxy calls it from loopback without an Origin, so the adapter checks first.
 */
export function isLocalFrontendRequest(request: Request): boolean {
	const hostname = hostnameOf(request);
	if (!hostname || !isLoopbackHostname(hostname, { allowLocalhostSubdomains: true })) {
		return false;
	}
	const origin = request.headers.get("origin");
	return origin === null || isLoopbackOrigin(origin);
}

/** 403 for a non-local request to a dev-only write adapter; null lets it proceed. */
export function refuseNonLocalRequest(request: Request): NextResponse | null {
	return isLocalFrontendRequest(request)
		? null
		: NextResponse.json({ error: "Only local requests are allowed" }, { status: 403 });
}
