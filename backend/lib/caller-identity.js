// @ts-check
"use strict";

// Who is calling. In production VPK runs behind the Micros Service Proxy with SLAuth:
// the sidecar authenticates the request (an SLAuth token from the CLI, or the SAML
// session cookie from a browser) and forwards it with X-Slauth-Subject set to the staff
// ID. The backend trusts that header only because the container's port is reachable
// through the sidecar alone; the sidecar replaces any X-Slauth-* header a client sends.
//
// Outside production there is no sidecar, so every caller is the fixed owner "local".
//
// Modes:
//   slauth — the caller is X-Slauth-Subject; a request without it is refused (401).
//            The default when NODE_ENV=production.
//   local  — the caller is "local", whatever the headers say. The default otherwise.
// VPK_CALLER_IDENTITY=local|slauth overrides the default. A local production serve
// (CI smoke, A/B builds) has no sidecar and sets local; the Micros descriptor never does.
// Any other value in production fails closed to slauth.

const LOCAL_CALLER_OWNER = "local";
const SLAUTH_SUBJECT_HEADER = "x-slauth-subject";
const MAX_SUBJECT_LENGTH = 256;
const CALLER_IDENTITY_MODES = Object.freeze(["local", "slauth"]);

/**
 * @typedef {"local" | "slauth"} CallerIdentityMode
 * @typedef {{ owner: string, local: boolean }} Caller
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ warn?: (...args: unknown[]) => void }} [logger]
 * @returns {CallerIdentityMode}
 */
function resolveCallerIdentityMode(env = process.env, logger = console) {
	const production = env.NODE_ENV === "production";
	const fallback = production ? "slauth" : "local";
	const raw = typeof env.VPK_CALLER_IDENTITY === "string" ? env.VPK_CALLER_IDENTITY.trim().toLowerCase() : "";
	if (!raw) return fallback;
	if (raw === "local" || raw === "slauth") return raw;
	logger.warn?.(`[STARTUP] VPK_CALLER_IDENTITY must be one of ${CALLER_IDENTITY_MODES.join(", ")}; using ${fallback}.`);
	return fallback;
}

/**
 * The SLAuth subject a request carries, or null. Only the first value counts; a value
 * with control characters or longer than 256 characters is not a subject.
 * @param {Record<string, unknown> | undefined} headers
 * @returns {string | null}
 */
function readSlauthSubject(headers) {
	const raw = headers?.[SLAUTH_SUBJECT_HEADER];
	const first = Array.isArray(raw) ? raw[0] : raw;
	if (typeof first !== "string") return null;
	const subject = first.trim();
	if (!subject || subject.length > MAX_SUBJECT_LENGTH) return null;
	if (/[\u0000-\u001f\u007f]/u.test(subject)) return null;
	return subject;
}

/**
 * @param {{ headers?: Record<string, unknown> }} request - an Express request or an upgrade request
 * @param {CallerIdentityMode} mode
 * @returns {{ ok: true, caller: Caller } | { ok: false }}
 */
function resolveCallerIdentity(request, mode) {
	if (mode !== "slauth") {
		return { ok: true, caller: { owner: LOCAL_CALLER_OWNER, local: true } };
	}
	const subject = readSlauthSubject(request?.headers);
	return subject ? { ok: true, caller: { owner: subject, local: false } } : { ok: false };
}

/**
 * Whether a stored record with this owner is the caller's. A record with no owner was
 * written before owners were stored: only a local caller sees it, never an SLAuth one.
 * @param {unknown} recordOwner
 * @param {Caller | null | undefined} caller
 * @returns {boolean}
 */
function isOwnedByCaller(recordOwner, caller) {
	if (!caller) return false;
	if (typeof recordOwner === "string" && recordOwner) return recordOwner === caller.owner;
	return caller.local;
}

module.exports = {
	CALLER_IDENTITY_MODES,
	LOCAL_CALLER_OWNER,
	SLAUTH_SUBJECT_HEADER,
	isOwnedByCaller,
	readSlauthSubject,
	resolveCallerIdentity,
	resolveCallerIdentityMode,
};
