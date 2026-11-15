// Recovering from an expired SLAuth session. In production VPK sits behind the Micros
// Service Proxy with SLAuth; a page loaded with a valid session keeps making background
// fetches, and once the session expires the sidecar answers them with 401, or with a 302
// to Okta marked `x-slauth-result: failure`. A same-origin fetch follows that redirect
// to Okta and fails as a CORS error.
//
// Only a response the sidecar marks `x-slauth-result: failure` is taken at its word. A
// plain 401 may be the app's own (a route whose upstream wants a different sign-in), and
// a fetch can fail for many reasons, so both are checked with one probe of the current
// page (`HEAD`, `redirect: "manual"`): a 401, an opaque redirect, or a failure marker
// there means the session is gone. Either way the page goes through the sidecar's
// `/saml/login?redirect=<current URL>` and comes back signed in.

export const SLAUTH_LOGIN_PATH = "/saml/login";
// One sign-in attempt per window: a login that keeps failing (or a serve with no sidecar)
// must not loop the page.
export const SLAUTH_LOGIN_COOLDOWN_MS = 60_000;
export const SLAUTH_LOGIN_ATTEMPT_KEY = "vpk:slauth-login-attempt";

export interface SlauthResponseShape {
	status: number;
	type?: string;
	slauthResult?: string | null;
}

/** Whether the sidecar marked a response as an SLAuth failure. */
function hasSlauthFailureMarker(slauthResult: string | null | undefined): boolean {
	return slauthResult?.toLowerCase() === "failure";
}

/**
 * Whether the session probe's response says the SLAuth session is missing or expired.
 * The probe asks for the current page with `redirect: "manual"`, so an opaque redirect
 * there is the sidecar sending it to Okta.
 */
export function isSlauthSessionFailure({ status, type, slauthResult }: SlauthResponseShape): boolean {
	if (status === 401) return true;
	if (type === "opaqueredirect") return true;
	return status >= 300 && status < 400 && hasSlauthFailureMarker(slauthResult);
}

/**
 * What a watched same-origin response says about the session: `failure` when the sidecar
 * marked it, `probe` for an unmarked 401 (maybe the app's own), otherwise `ok`. An opaque
 * redirect is the caller's own `redirect: "manual"` and says nothing.
 */
export function classifyWatchedResponse({ status, slauthResult }: SlauthResponseShape): "failure" | "probe" | "ok" {
	if (hasSlauthFailureMarker(slauthResult) && (status === 401 || (status >= 300 && status < 400))) return "failure";
	return status === 401 ? "probe" : "ok";
}

export function buildSlauthLoginUrl(currentHref: string): string {
	return `${SLAUTH_LOGIN_PATH}?redirect=${encodeURIComponent(currentHref)}`;
}

/** Whether a fetch input targets this origin (relative URLs do). Never throws. */
export function isSameOriginRequest(input: RequestInfo | URL, origin: string): boolean {
	try {
		const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
		return new URL(raw, origin).origin === origin;
	} catch {
		return false;
	}
}

export function shouldAttemptSlauthLogin(lastAttemptMs: number | null, nowMs: number): boolean {
	return lastAttemptMs === null || !Number.isFinite(lastAttemptMs) || nowMs - lastAttemptMs >= SLAUTH_LOGIN_COOLDOWN_MS;
}

export interface SlauthSessionHost {
	location: { href: string; origin: string; pathname: string; assign(url: string): void };
	storage: Pick<Storage, "getItem" | "setItem"> | null;
	now(): number;
}

/**
 * A fetch that behaves like `originalFetch` and, when a same-origin request reveals an
 * expired SLAuth session, sends the page through `/saml/login`. The caller still gets
 * the original response or error.
 */
export function createSlauthWatchedFetch(originalFetch: typeof fetch, host: SlauthSessionHost): typeof fetch {
	const redirectToLogin = () => {
		const raw = host.storage?.getItem(SLAUTH_LOGIN_ATTEMPT_KEY) ?? null;
		const lastAttempt = raw === null ? null : Number(raw);
		const now = host.now();
		if (!shouldAttemptSlauthLogin(lastAttempt, now)) return;
		host.storage?.setItem(SLAUTH_LOGIN_ATTEMPT_KEY, String(now));
		host.location.assign(buildSlauthLoginUrl(host.location.href));
	};

	// One probe at a time: a burst of failures (a backend outage) sends one HEAD.
	let probeInFlight: Promise<void> | null = null;
	const probeSession = () => {
		probeInFlight ??= (async () => {
			try {
				const probe = await originalFetch(host.location.pathname, {
					cache: "no-store",
					credentials: "same-origin",
					method: "HEAD",
					redirect: "manual",
				});
				if (isSlauthSessionFailure({ status: probe.status, type: probe.type, slauthResult: probe.headers.get("x-slauth-result") })) {
					redirectToLogin();
				}
			} catch {
				// Offline or the server is down: not a session problem.
			} finally {
				probeInFlight = null;
			}
		})();
		return probeInFlight;
	};

	return async (input, init) => {
		const sameOrigin = isSameOriginRequest(input, host.location.origin);
		try {
			const response = await originalFetch(input, init);
			if (sameOrigin) {
				const verdict = classifyWatchedResponse({
					status: response.status,
					slauthResult: response.headers.get("x-slauth-result"),
				});
				if (verdict === "failure") redirectToLogin();
				else if (verdict === "probe") void probeSession();
			}
			return response;
		} catch (error) {
			const aborted = typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";
			if (sameOrigin && !aborted) void probeSession();
			throw error;
		}
	};
}
