// @ts-check
const net = require("node:net");

const { isAllowedAtlassianSite } = require("./jira-query-inputs");

const FIGMA_MCP_ASSET_PATH_PREFIX = "/api/mcp/asset/";
const IMAGE_PROXY_ALLOWED_HOSTS = new Set(["figma.com", "www.figma.com"]);
const IMAGE_PROXY_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
// An Atlassian page read for image candidates (provisional): a larger page is skipped.
const IMAGE_PROXY_MAX_HTML_BYTES = 1024 * 1024;
const ATLASSIAN_HOST_PATTERN = /(^|\.)atlassian\.net$/i;
const IMAGE_FILE_EXTENSION_PATTERN =
	/\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:$|[?#])/i;
const HTML_IMAGE_ATTRIBUTE_PATTERN =
	/(?:src|content)=["']([^"']+\.(?:avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:\?[^"']*)?)["']/gi;

function getNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: "";
}

class ImageProxyResponseTooLargeError extends Error {
	constructor(maxBytes = IMAGE_PROXY_MAX_RESPONSE_BYTES) {
		super(`Image response exceeds the ${maxBytes} byte proxy limit`);
		this.name = "ImageProxyResponseTooLargeError";
		this.maxBytes = maxBytes;
		this.statusCode = 413;
	}
}

function safeDecodeURIComponent(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function parseContentLength(value) {
	const normalizedValue = getNonEmptyString(value);
	if (!/^\d+$/.test(normalizedValue)) {
		return null;
	}

	const parsedValue = Number(normalizedValue);
	return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

function normalizeMaxResponseBytes(value) {
	return Number.isSafeInteger(value) && value > 0
		? value
		: IMAGE_PROXY_MAX_RESPONSE_BYTES;
}

async function cancelReadableBody(bodyOrReader) {
	if (!bodyOrReader) {
		return;
	}

	try {
		if (typeof bodyOrReader.cancel === "function") {
			await bodyOrReader.cancel();
		}
	} catch {
		// Best effort: cancellation only releases upstream resources.
	}
}

async function readImageProxyResponsePayload(upstreamResponse, options = {}) {
	const maxBytes = normalizeMaxResponseBytes(options.maxBytes);
	const contentLength = parseContentLength(
		upstreamResponse?.headers?.get?.("content-length"),
	);

	if (contentLength !== null && contentLength > maxBytes) {
		await cancelReadableBody(upstreamResponse.body);
		throw new ImageProxyResponseTooLargeError(maxBytes);
	}

	const body = upstreamResponse?.body;
	if (!body) {
		return Buffer.alloc(0);
	}

	const chunks = [];
	let totalBytes = 0;

	if (typeof body.getReader === "function") {
		const reader = body.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				const chunk = Buffer.from(value);
				totalBytes += chunk.length;
				if (totalBytes > maxBytes) {
					await cancelReadableBody(reader);
					throw new ImageProxyResponseTooLargeError(maxBytes);
				}
				chunks.push(chunk);
			}
		} finally {
			if (typeof reader.releaseLock === "function") {
				reader.releaseLock();
			}
		}

		return Buffer.concat(chunks, totalBytes);
	}

	if (typeof body[Symbol.asyncIterator] === "function") {
		for await (const value of body) {
			const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
			totalBytes += chunk.length;
			if (totalBytes > maxBytes) {
				await cancelReadableBody(body);
				throw new ImageProxyResponseTooLargeError(maxBytes);
			}
			chunks.push(chunk);
		}

		return Buffer.concat(chunks, totalBytes);
	}

	throw new Error("Upstream image response body is not readable");
}

function isAtlassianHost(hostname) {
	return ATLASSIAN_HOST_PATTERN.test(String(hostname || "").toLowerCase());
}

// Every Atlassian image (the requested one, and candidates found in a page or derived
// from it) is fetched over https only.
function isAllowedAtlassianImageUrl(parsedUrl) {
	if (parsedUrl.protocol !== "https:" || !isAtlassianHost(parsedUrl.hostname)) {
		return false;
	}

	if (/\/wiki\/pages\/viewpageattachments\.action$/i.test(parsedUrl.pathname)) {
		const previewValue = safeDecodeURIComponent(
			parsedUrl.searchParams.get("preview") || "",
		);
		return IMAGE_FILE_EXTENSION_PATTERN.test(previewValue);
	}

	if (/\/wiki\/download\/attachments\//i.test(parsedUrl.pathname)) {
		return IMAGE_FILE_EXTENSION_PATTERN.test(parsedUrl.pathname);
	}

	return /\/secure\/(?:view|user)avatar/i.test(parsedUrl.pathname);
}

function isLikelyAtlassianImagePath(pathname) {
	return (
		/\/wiki\/download\/attachments\//i.test(pathname) ||
		/\/secure\/(?:view|user)avatar/i.test(pathname)
	);
}

function toAbsoluteUrl(candidate, baseUrl) {
	const normalizedCandidate = getNonEmptyString(candidate);
	if (!normalizedCandidate) {
		return null;
	}

	try {
		return new URL(normalizedCandidate, baseUrl);
	} catch {
		return null;
	}
}

function scoreAtlassianImageCandidate(url) {
	let score = 0;
	const normalized = safeDecodeURIComponent(url.toString()).toLowerCase();

	if (isLikelyAtlassianImagePath(url.pathname)) {
		score += 200;
	}
	if (/download\/attachments/i.test(url.pathname)) {
		score += 120;
	}
	if (/viewavatar|useravatar/i.test(url.pathname)) {
		score += 80;
	}
	if (/headshot/i.test(normalized)) {
		score += 100;
	}
	if (IMAGE_FILE_EXTENSION_PATTERN.test(normalized)) {
		score += 40;
	}

	return score;
}

function dedupeUrls(urls) {
	const seen = new Set();
	const deduped = [];

	for (const url of urls) {
		const normalized = url.toString();
		if (seen.has(normalized)) {
			continue;
		}
		seen.add(normalized);
		deduped.push(url);
	}

	return deduped;
}

function deriveAtlassianImageCandidatesFromUrl(parsedUrl) {
	const candidates = [];

	if (/\/wiki\/pages\/viewpageattachments\.action$/i.test(parsedUrl.pathname)) {
		const pageId = getNonEmptyString(parsedUrl.searchParams.get("pageId"));
		const previewValue = safeDecodeURIComponent(
			parsedUrl.searchParams.get("preview") || "",
		);
		const previewSegments = previewValue.split("/").filter(Boolean);
		const filename = previewSegments.at(-1);
		if (pageId && filename && IMAGE_FILE_EXTENSION_PATTERN.test(filename)) {
			candidates.push(
				new URL(
					`/wiki/download/attachments/${pageId}/${filename}?api=v2`,
					parsedUrl,
				),
			);
			candidates.push(
				new URL(`/wiki/download/attachments/${pageId}/${filename}`, parsedUrl),
			);
		}
	}

	if (/\/wiki\/download\/attachments\//i.test(parsedUrl.pathname)) {
		const withApi = new URL(parsedUrl.toString());
		if (withApi.searchParams.get("api") !== "v2") {
			withApi.searchParams.set("api", "v2");
			candidates.push(withApi);
		}
	}

	return dedupeUrls(candidates);
}

function extractAtlassianImageCandidatesFromHtml(html, baseUrl) {
	const htmlText = getNonEmptyString(html);
	if (!htmlText) {
		return [];
	}

	const candidates = [];
	for (const match of htmlText.matchAll(HTML_IMAGE_ATTRIBUTE_PATTERN)) {
		const absoluteUrl = toAbsoluteUrl(match[1], baseUrl);
		if (!absoluteUrl || !isAllowedAtlassianImageUrl(absoluteUrl)) {
			continue;
		}

		candidates.push(absoluteUrl);
	}

	return dedupeUrls(candidates).sort(
		(left, right) => scoreAtlassianImageCandidate(right) - scoreAtlassianImageCandidate(left),
	);
}

function parseImageProxyTarget(value) {
	const normalizedValue = getNonEmptyString(value);
	if (!normalizedValue) {
		return {
			error: "Missing required query parameter: src",
		};
	}

	let parsedUrl;
	try {
		parsedUrl = new URL(normalizedValue);
	} catch {
		return {
			error: "Invalid src URL",
		};
	}

	const protocol = parsedUrl.protocol.toLowerCase();
	if (protocol !== "https:" && protocol !== "http:") {
		return {
			error: "Only http(s) image URLs are supported",
		};
	}

	const hostname = parsedUrl.hostname.toLowerCase();
	// Figma assets are https only, like Atlassian images.
	const isFigmaAsset =
		protocol === "https:" &&
		IMAGE_PROXY_ALLOWED_HOSTS.has(hostname) &&
		parsedUrl.pathname.startsWith(FIGMA_MCP_ASSET_PATH_PREFIX);
	const isAtlassianImage = isAllowedAtlassianImageUrl(parsedUrl);

	if (!isFigmaAsset && !isAtlassianImage) {
		return {
			error: "Image URL is not allowed",
		};
	}

	return {
		targetUrl: parsedUrl,
		source: isAtlassianImage ? "atlassian" : "figma",
	};
}

// Redirects are followed one hop at a time (fetch's own following checks no hop), and
// each hop must be https to a named host under one of these suffixes. Figma assets and
// Atlassian attachments redirect to their media hosts; an IP literal, plain http or any
// other host is refused. Provisional: the media hosts were not observed live here.
const IMAGE_PROXY_MAX_REDIRECTS = 5;
// All upstream requests one image-proxy request may make, over every candidate and every
// redirect hop (provisional; up to 8 candidates times 6 hops before).
const IMAGE_PROXY_MAX_UPSTREAM_FETCHES = 12;
const IMAGE_PROXY_REDIRECT_HOST_SUFFIXES = ["figma.com", "atlassian.net", "atlassian.com"];
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** @param {URL} url */
function isAllowedImageProxyRedirectTarget(url) {
	if (url.protocol !== "https:" || url.username || url.password) {
		return false;
	}
	const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "").replace(/\.$/u, "");
	if (!hostname || net.isIP(hostname)) {
		return false;
	}
	return IMAGE_PROXY_REDIRECT_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
}

/**
 * GET an image-proxy URL, following redirects by hand: every hop is checked, and each
 * hop's headers are built for that hop (a token never follows a redirect to another host).
 * @param {URL} startUrl
 * @param {{ fetchFn: typeof fetch, buildHeaders: (url: URL) => Record<string, string>, signal?: AbortSignal, budget?: { remaining: number } }} options
 * Every request counts against `budget` (shared by all candidates of one proxy request);
 * `authenticated` says whether the token went to any hop.
 * @returns {Promise<{ response: Response, url: URL, authenticated: boolean } | { refusedStatus: number } | { budgetExhausted: true }>}
 */
async function fetchImageProxyUrl(startUrl, { fetchFn, buildHeaders, signal, budget = { remaining: IMAGE_PROXY_MAX_UPSTREAM_FETCHES } }) {
	let url = startUrl;
	let authenticated = false;
	for (let hop = 0; ; hop += 1) {
		if (budget.remaining <= 0) {
			return { budgetExhausted: true };
		}
		budget.remaining -= 1;
		const headers = buildHeaders(url);
		authenticated = authenticated || Boolean(headers?.Authorization);
		const response = await fetchFn(url.toString(), {
			method: "GET",
			headers,
			redirect: "manual",
			signal,
		});
		if (!REDIRECT_STATUSES.has(response.status)) {
			return { response, url, authenticated };
		}
		await response.body?.cancel?.().catch?.(() => {});
		/** @type {URL | null} */
		let next = null;
		try {
			const location = response.headers.get("location");
			next = location ? new URL(location, url) : null;
		} catch {
			next = null;
		}
		if (!next || hop >= IMAGE_PROXY_MAX_REDIRECTS || !isAllowedImageProxyRedirectTarget(next)) {
			return { refusedStatus: response.status };
		}
		url = next;
	}
}

function buildImageProxyRequestHeaders(targetUrl, env = process.env) {
	const headers = {
		Accept: "image/*",
		"User-Agent": "VPK-ImageProxy/1.0",
	};

	// The token goes only to an image URL (the attachment and avatar paths the proxy
	// allows) on a configured site over https. Every redirect hop is checked again, so a
	// redirect to another path on that site, such as a REST endpoint, is fetched without it.
	const atlassianApiToken = getNonEmptyString(env.ATLASSIAN_API_TOKEN);
	if (
		targetUrl.protocol === "https:"
		&& isAllowedAtlassianSite(targetUrl.hostname, env)
		&& isAllowedAtlassianImageUrl(targetUrl)
		&& atlassianApiToken
	) {
		headers.Authorization = `Bearer ${atlassianApiToken}`;
	}

	return headers;
}

module.exports = {
	FIGMA_MCP_ASSET_PATH_PREFIX,
	IMAGE_PROXY_MAX_RESPONSE_BYTES,
	ImageProxyResponseTooLargeError,
	IMAGE_PROXY_MAX_HTML_BYTES,
	IMAGE_PROXY_MAX_REDIRECTS,
	IMAGE_PROXY_MAX_UPSTREAM_FETCHES,
	buildImageProxyRequestHeaders,
	deriveAtlassianImageCandidatesFromUrl,
	fetchImageProxyUrl,
	isAllowedImageProxyRedirectTarget,
	extractAtlassianImageCandidatesFromHtml,
	isAllowedAtlassianImageUrl,
	parseImageProxyTarget,
	readImageProxyResponsePayload,
};
