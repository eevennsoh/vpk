#!/usr/bin/env node

import WebSocket from "ws";
import { readSlauthOption, resolveSlauthHeaders } from "./slauth-auth.mjs";

const usage = "Usage: verify-wss.mjs <base-url> [--discovery] [--allow-tokenless-dev] [--timeout-ms 15000] [--slauth-aud vpk | --no-slauth]";
let baseUrl;
let discovery = false;
let allowTokenlessDev = false;
let timeoutMs = 15000;
// A Micros host sends an SLAuth token for audience vpk by default (slauth-auth.mjs); the
// realtime token is bound to that caller, so the upgrade carries the same token.
const slauthOptions = { audience: null, explicit: false };
let authHeaders = {};
try {
	baseUrl = new URL(process.argv[2]);
	if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
		throw new Error("Use an HTTP(S) URL without credentials");
	}
	for (let index = 3; index < process.argv.length; index += 1) {
		const arg = process.argv[index];
		const slauthArgs = readSlauthOption(process.argv, index, slauthOptions);
		if (slauthArgs) index += slauthArgs - 1;
		else if (arg === "--discovery") discovery = true;
		else if (arg === "--allow-tokenless-dev") allowTokenlessDev = true;
		else if (arg === "--timeout-ms") timeoutMs = Number(process.argv[++index]);
		else throw new Error("Unknown option");
	}
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
		throw new Error("Timeout must be 1-120000 ms");
	}
	const localHost = baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1"
		|| baseUrl.hostname.endsWith(".localhost");
	if (allowTokenlessDev && (!discovery || !localHost)) {
		throw new Error("Tokenless development mode requires discovery on a localhost origin");
	}
	authHeaders = resolveSlauthHeaders(baseUrl, slauthOptions);
} catch (error) {
	console.error(`${usage}\n${error.message}`);
	process.exit(2);
}

async function fetchJson(path, label) {
	let response;
	try {
		response = await fetch(new URL(path, baseUrl.origin), {
			headers: { ...authHeaders, Origin: baseUrl.origin },
			cache: "no-store",
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch {
		throw new Error(`${label} transport failure`);
	}
	if (!response.ok) throw new Error(`${label} HTTP ${response.status}`);
	if (!/\bapplication\/(?:[\w.-]+\+)?json\b/iu.test(response.headers.get("content-type") || "")) {
		throw new Error(`${label} expected JSON`);
	}
	try { return await response.json(); }
	catch { throw new Error(`${label} invalid JSON`); }
}

async function verify() {
	let wsBase = baseUrl.origin.replace(/^http/u, "ws");
	if (discovery) {
		const data = await fetchJson("/api/realtime/ws-url", "WebSocket discovery");
		let candidate;
		try { candidate = new URL(data?.wsUrl); }
		catch { throw new Error("WebSocket discovery returned no valid base URL"); }
		if (!["ws:", "wss:"].includes(candidate.protocol) || candidate.username || candidate.password) {
			throw new Error("WebSocket discovery returned no valid base URL");
		}
		wsBase = candidate.origin;
		console.log("WebSocket discovery: 200");
	}
	const payload = await fetchJson("/api/realtime/audio-conversation-token", "Socket token");
	const token = typeof payload?.token === "string" && payload.token.trim()
		&& Number.isFinite(payload.expiresInMs) && payload.expiresInMs > 0
		? payload.token.trim() : null;
	if (!token && !allowTokenlessDev) throw new Error("Scoped socket token unavailable");
	if (!token) console.log("Tokenless localhost development mode");
	const wsUrl = new URL("/api/realtime/audio-conversation", wsBase);
	if (token) wsUrl.searchParams.set("realtimeToken", token);
	// Discovery may name another host: the SLAuth token goes only to this service's own host.
	const socket = new WebSocket(wsUrl, {
		headers: { ...(wsUrl.host === baseUrl.host ? authHeaders : {}), Origin: baseUrl.origin },
		handshakeTimeout: timeoutMs,
	});
	await new Promise((resolve, reject) => {
		let opened = false;
		let settled = false;
		const deadline = setTimeout(() => finish(opened ? undefined : new Error("WebSocket handshake timed out")), timeoutMs + 5000);
		function finish(error) {
			if (settled) return;
			settled = true;
			clearTimeout(deadline);
			if (socket.readyState !== WebSocket.CLOSED) socket.terminate();
			if (error) reject(error);
			else resolve();
		}
		socket.once("open", () => {
			opened = true;
			console.log(token ? "Authenticated WebSocket upgrade: 101" : "Development WebSocket upgrade: 101");
			socket.close(1000);
		});
		socket.once("close", () => finish(opened ? undefined : new Error("WebSocket closed before upgrade")));
		socket.once("unexpected-response", (_request, response) => {
			response.resume();
			finish(new Error(`WebSocket upgrade HTTP ${response.statusCode}`));
		});
		socket.once("error", () => finish(opened ? undefined : new Error("WebSocket transport error")));
	});
	console.log("Transport verified; microphone and playback remain untested.");
}

verify().catch((error) => {
	console.error(`WebSocket verification failed: ${error.message}`);
	process.exitCode = 1;
});
