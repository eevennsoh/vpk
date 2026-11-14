"use strict";

// How a stored file is served: uploads (BE-F7), the image proxy and generated media (BE-F8).
// A media type comes from a client or an upstream server, so only types a browser renders
// without running script on this origin are served inline; everything else (HTML, XML,
// PDF, unknown) is a download with a neutral type. Every file response also carries a
// sandboxing CSP and nosniff, so a mislabelled file cannot run script on the app's origin
// either way. SVG is inline only because of that CSP: opened directly, an SVG document is
// sandboxed with no script, and inside <img> a browser never runs its script.

const INLINE_MEDIA_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/bmp",
	"image/svg+xml",
	"image/x-icon",
	"image/vnd.microsoft.icon",
	"audio/mpeg",
	"audio/mp4",
	"audio/aac",
	"audio/ogg",
	"audio/wav",
	"audio/webm",
	"video/mp4",
	"video/webm",
	"video/quicktime",
	"text/plain",
]);

// Names clients and servers use for the types above, served under the standard name.
const MEDIA_TYPE_ALIASES = new Map([
	["image/jpg", "image/jpeg"],
	["image/pjpeg", "image/jpeg"],
	["audio/x-wav", "audio/wav"],
	["audio/wave", "audio/wav"],
	["audio/x-m4a", "audio/mp4"],
	["audio/m4a", "audio/mp4"],
	["audio/mp3", "audio/mpeg"],
]);

// `style-src 'unsafe-inline'` keeps an SVG's own <style> elements and style attributes
// (fills, strokes, visibility); inline styles cannot run script, and `sandbox` with
// `default-src 'none'` still blocks script, fetches and every other resource.
const FILE_RESPONSE_SECURITY_HEADERS = Object.freeze({
	"Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
	"X-Content-Type-Options": "nosniff",
});

function normalizeMediaType(value) {
	const mediaType = typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "";
	return MEDIA_TYPE_ALIASES.get(mediaType) ?? mediaType;
}

/**
 * The served type for a stored or proxied file, and whether it may render inline.
 * @param {unknown} mediaType
 * @returns {{ inline: boolean, contentType: string }}
 */
function decideFileMediaType(mediaType) {
	const normalized = normalizeMediaType(mediaType);
	if (!INLINE_MEDIA_TYPES.has(normalized)) {
		return { inline: false, contentType: "application/octet-stream" };
	}
	return { inline: true, contentType: normalized === "text/plain" ? "text/plain; charset=utf-8" : normalized };
}

// RFC 5987 ext-value: encodeURIComponent leaves ' ( ) * unescaped, and ' ends the
// charset part. A lone surrogate cannot be encoded as UTF-8 (encodeURIComponent throws),
// so that name keeps only its ASCII form.
function encodeExtValue(name) {
	try {
		return encodeURIComponent(name).replace(/['()*]/gu, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
	} catch {
		return null;
	}
}

// An ASCII-only filename for the quoted parameter, the full name in filename*.
function buildContentDisposition(kind, filename) {
	const name = typeof filename === "string" && filename.trim() ? filename.trim() : "attachment.bin";
	const asciiName = name.replace(/[^\x20-\x7e]|["\\]/gu, "_");
	const extValue = encodeExtValue(name);
	return extValue === null
		? `${kind}; filename="${asciiName}"`
		: `${kind}; filename="${asciiName}"; filename*=UTF-8''${extValue}`;
}

/**
 * @param {{ mediaType?: unknown, filename?: unknown }} upload
 * @returns {Record<string, string>}
 */
function decideUploadResponseHeaders(upload) {
	const { inline, contentType } = decideFileMediaType(upload?.mediaType);
	return {
		"Content-Type": contentType,
		"Content-Disposition": buildContentDisposition(inline ? "inline" : "attachment", upload?.filename),
		...FILE_RESPONSE_SECURITY_HEADERS,
	};
}

module.exports = {
	FILE_RESPONSE_SECURITY_HEADERS,
	INLINE_MEDIA_TYPES,
	buildContentDisposition,
	decideFileMediaType,
	decideUploadResponseHeaders,
};
