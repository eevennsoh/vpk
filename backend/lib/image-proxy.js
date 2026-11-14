// @ts-check
const { isAllowedAtlassianSite } = require("./jira-query-inputs");

const FIGMA_MCP_ASSET_PATH_PREFIX = "/api/mcp/asset/";
const IMAGE_PROXY_ALLOWED_HOSTS = new Set(["figma.com", "www.figma.com"]);
const IMAGE_PROXY_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
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
	const isFigmaAsset =
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

function buildImageProxyRequestHeaders(targetUrl, env = process.env) {
	const headers = {
		Accept: "image/*",
		"User-Agent": "VPK-ImageProxy/1.0",
	};

	// The token goes only to a configured site over https; other Atlassian hosts are
	// fetched without it.
	const atlassianApiToken = getNonEmptyString(env.ATLASSIAN_API_TOKEN);
	if (targetUrl.protocol === "https:" && isAllowedAtlassianSite(targetUrl.hostname, env) && atlassianApiToken) {
		headers.Authorization = `Bearer ${atlassianApiToken}`;
	}

	return headers;
}

module.exports = {
	FIGMA_MCP_ASSET_PATH_PREFIX,
	IMAGE_PROXY_MAX_RESPONSE_BYTES,
	ImageProxyResponseTooLargeError,
	buildImageProxyRequestHeaders,
	deriveAtlassianImageCandidatesFromUrl,
	extractAtlassianImageCandidatesFromHtml,
	isAllowedAtlassianImageUrl,
	parseImageProxyTarget,
	readImageProxyResponsePayload,
};
