#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyInitialTheme } from "./verify-initial-theme.mjs";
import { verifyStaticDelivery } from "./verify-static-delivery.mjs";

const usage = "Usage: verify-runtime.mjs <base-url> [route ...] [--profile static|backend|chat|full] [--check-ads-theme] [--check-static-delivery] [--report path] [--expect-html-file path] [--timeout-ms 15000]";
let baseUrl;
let profile = "full";
let timeoutMs = 15000;
let checkAdsTheme = false;
let expectHtmlFile;
let checkStaticDelivery = false;
let reportFile;
const responses = [];
const routes = [];
try {
	baseUrl = new URL(process.argv[2] || process.env.VPK_DEPLOY_URL);
	if (!["http:", "https:"].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
		throw new Error("Use an HTTP(S) URL without credentials");
	}
	for (let index = 3; index < process.argv.length; index += 1) {
		const arg = process.argv[index];
		if (arg === "--profile") profile = process.argv[++index];
		else if (arg === "--timeout-ms") timeoutMs = Number(process.argv[++index]);
		else if (arg === "--check-ads-theme") checkAdsTheme = true;
		else if (arg === "--check-static-delivery") checkStaticDelivery = true;
		else if (arg === "--report") {
			reportFile = process.argv[++index];
			if (!reportFile || reportFile.startsWith("--")) throw new Error("Report path is required");
		}
		else if (arg === "--expect-html-file") {
			expectHtmlFile = process.argv[++index];
			if (!expectHtmlFile || expectHtmlFile.startsWith("--")) throw new Error("Expected HTML file path is required");
		}
		else if (arg.startsWith("/") && !arg.startsWith("//")) routes.push(arg);
		else throw new Error("Expected a route starting with / or a supported option");
	}
	if (!["static", "backend", "chat", "full"].includes(profile)) throw new Error("Unknown runtime profile");
	if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error("Timeout must be 1–120000 ms");
	if (expectHtmlFile && routes.length > 1) throw new Error("Expected HTML file can verify only one route");
} catch (error) {
	console.error(`${usage}\n${error.message}`);
	process.exit(2);
}
if (!routes.length) routes.push("/");
const failures = [];
let expectedHtmlBytes;
if (expectHtmlFile) {
	try { expectedHtmlBytes = await readFile(expectHtmlFile); }
	catch {
		console.error(`${usage}\nExpected HTML file is unreadable`);
		process.exit(2);
	}
}

// Keep response bodies and URL query strings out of logs: either may contain credentials.
function safeUrl(url) {
	return `${url.origin}${url.pathname}`;
}

function staticContentType(ref) {
	const pathname = new URL(ref, baseUrl).pathname;
	if (/\.css$/iu.test(pathname)) return { pattern: /^text\/css\b/iu, name: "CSS" };
	if (/\.m?js$/iu.test(pathname)) return { pattern: /^(?:text|application)\/(?:javascript|ecmascript)\b/iu, name: "JavaScript" };
	if (/\.(?:woff2?|ttf|otf)$/iu.test(pathname)) return { pattern: /^(?:font\/|application\/(?:octet-stream|(?:x-)?font[\w-]*|vnd\.ms-opentype)\b)/iu, name: "font" };
	return undefined;
}

async function request(pathname, label, headers = {}, json = false, media) {
	const signal = AbortSignal.timeout(timeoutMs);
	let url = new URL(pathname, baseUrl);
	try {
		if (url.origin !== baseUrl.origin) throw new Error("cross-origin request rejected");
		for (let redirects = 0; redirects <= 5; redirects += 1) {
			const response = await fetch(url, {
				headers: checkStaticDelivery && media ? { "Accept-Encoding": "br, gzip", ...headers } : headers,
				signal, redirect: "manual",
			});
			if ([301, 302, 303, 307, 308].includes(response.status)) {
				const location = response.headers.get("location");
				await response.body?.cancel();
				if (!location) throw new Error("redirect has no Location");
				const next = new URL(location, url);
				if (next.username || next.password) throw new Error("redirect contains credentials");
				if (next.origin !== baseUrl.origin) throw new Error(`cross-origin redirect to ${safeUrl(next)}`);
				console.log(`${label}: redirect to ${safeUrl(next)}`);
				url = next;
				continue;
			}
			if (!response.ok) {
				await response.body?.cancel();
				throw new Error(`HTTP ${response.status}`);
			}
			if (json && !/\bapplication\/(?:[\w.-]+\+)?json\b/iu.test(response.headers.get("content-type") || "")) {
				await response.body?.cancel();
				throw new Error("expected JSON Content-Type");
			}
			if (media && !media.pattern.test(response.headers.get("content-type") || "")) {
				await response.body?.cancel();
				throw new Error(`expected ${media.name} Content-Type`);
			}
			const body = Buffer.from(await response.arrayBuffer());
			const contentLength = response.headers.get("content-length");
			responses.push({
				url: safeUrl(url), status: response.status,
				decodedBodyBytes: body.length,
				reportedEncodedContentLengthBytes: contentLength === null ? null : Number(contentLength),
				contentEncoding: response.headers.get("content-encoding") || "identity",
				cacheControl: response.headers.get("cache-control"),
			});
			if (checkStaticDelivery && media) {
				for (const error of verifyStaticDelivery(response.headers, url.pathname, body.length, media.name)) failures.push(`${label}: ${error}`);
			}
			let payload;
			if (json) {
				try { payload = JSON.parse(body.toString("utf8")); }
				catch { throw new Error("invalid JSON response"); }
			} else payload = body.toString("utf8");
			console.log(`${label}: ${response.status}, final=${safeUrl(url)}`);
			return payload;
		}
		throw new Error("too many redirects");
	} catch (error) {
		failures.push(`${label}: ${signal.aborted ? "timed out" : error.message}`);
		return undefined;
	}
}

console.log(`Verifying ${baseUrl.origin}, profile=${profile}`);
for (const route of routes) {
	const routeLabel = route.split(/[?#]/u)[0];
	const html = await request(route, `route ${routeLabel}`, {}, false, { pattern: /^text\/html\b/iu, name: "HTML" });
	if (html === undefined) continue;
	if (checkStaticDelivery && Buffer.byteLength(html) >= 1024) {
		const gzipHtml = await request(route, `route ${routeLabel} gzip`, { "Accept-Encoding": "gzip" }, false, { pattern: /^text\/html\b/iu, name: "HTML" });
		if (gzipHtml !== undefined && gzipHtml !== html) failures.push(`route ${routeLabel}: gzip representation differs from negotiated HTML`);
	}
	if (expectedHtmlBytes) {
		if (Buffer.from(html, "utf8").equals(expectedHtmlBytes)) console.log(`route ${routeLabel}: matches expected export HTML`);
		else failures.push(`route ${routeLabel}: live HTML differs from expected export file`);
	}
	const initialTheme = verifyInitialTheme(html, checkAdsTheme);
	for (const error of initialTheme.errors) failures.push(`route ${routeLabel}: ${error}`);
	if (initialTheme.checked && !initialTheme.errors.length) console.log(`route ${routeLabel}: initial ADS theme HTML passed`);
	const refs = [...new Set([...html.matchAll(/["'](\/_next\/static\/[^"']+)/g)].map((match) => match[1].replace(/\\$/u, "")))];
	for (const ref of refs) {
		const label = new URL(ref, baseUrl).pathname;
		const media = staticContentType(ref);
		await request(ref, `static ${label}`, {}, false, media);
		if (/\.(?:woff2?|ttf|otf)(?:[?#].*)?$/iu.test(ref)) {
			await request(ref, `browser-font ${label}`, {
				Origin: baseUrl.origin,
				Referer: new URL(route, baseUrl).toString(),
				"Sec-Fetch-Dest": "font",
				"Sec-Fetch-Mode": "cors",
			}, false, media);
		}
	}
}

if (profile !== "static") {
	const health = await request("/api/health", "/api/health", { Origin: baseUrl.origin }, true);
	if (health !== undefined) {
		if (health?.status !== "OK") failures.push("/api/health: expected status OK");
		if (["chat", "full"].includes(profile) && health?.llmRouting?.aiGatewayConfigured !== true) {
			failures.push("/api/health: expected aiGatewayConfigured=true");
		}
	}
}
if (profile === "full") {
	const token = await request("/api/realtime/audio-conversation-token", "realtime-token", { Origin: baseUrl.origin }, true);
	if (token !== undefined && (typeof token?.token !== "string" || !token.token.trim() || !Number.isFinite(token.expiresInMs) || token.expiresInMs <= 0)) {
		failures.push("realtime-token: expected nonempty token and positive expiresInMs");
	}
}
if (reportFile) {
	await mkdir(path.dirname(path.resolve(reportFile)), { recursive: true });
	await writeFile(reportFile, `${JSON.stringify({ schemaVersion: 1, origin: baseUrl.origin, profile, checkStaticDelivery, responses, failures, byteMeaning: "decoded body bytes plus Content-Length reported by the server; absent encoded lengths stay null" }, null, 2)}\n`);
}
if (failures.length) {
	console.error("\nRuntime verification failed:");
	for (const failure of failures) console.error(`- ${failure}`);
	process.exit(1);
}
console.log("\nHTTP runtime verification passed; browser, chat, and WSS/audio checks remain separate.");
