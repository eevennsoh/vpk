"use strict";

// How a stored upload is served (BE-F7). An upload's media type comes from the client, so
// only types a browser renders without running script are served inline; everything else
// (HTML, SVG, XML, PDF, unknown) is a download with a neutral type. Every file response
// also carries a sandboxing CSP and nosniff, so a mislabelled file cannot run script on
// the app's origin either way.

const INLINE_MEDIA_TYPES = new Set([
	"image/png",
	"image/jpeg",
	"image/gif",
	"image/webp",
	"image/avif",
	"image/bmp",
	"audio/mpeg",
	"audio/mp4",
	"audio/ogg",
	"audio/wav",
	"audio/webm",
	"video/mp4",
	"video/webm",
	"text/plain",
]);

const FILE_RESPONSE_SECURITY_HEADERS = Object.freeze({
	"Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'",
	"X-Content-Type-Options": "nosniff",
});

function normalizeMediaType(value) {
	return typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "";
}

// An ASCII-only filename for the quoted parameter, the full name in filename*.
function buildContentDisposition(kind, filename) {
	const name = typeof filename === "string" && filename.trim() ? filename.trim() : "attachment.bin";
	const asciiName = name.replace(/[^\x20-\x7e]|["\\]/gu, "_");
	return `${kind}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * @param {{ mediaType?: unknown, filename?: unknown }} upload
 * @returns {Record<string, string>}
 */
function decideUploadResponseHeaders(upload) {
	const mediaType = normalizeMediaType(upload?.mediaType);
	const inline = INLINE_MEDIA_TYPES.has(mediaType);
	return {
		"Content-Type": inline ? (mediaType === "text/plain" ? "text/plain; charset=utf-8" : mediaType) : "application/octet-stream",
		"Content-Disposition": buildContentDisposition(inline ? "inline" : "attachment", upload?.filename),
		...FILE_RESPONSE_SECURITY_HEADERS,
	};
}

module.exports = {
	FILE_RESPONSE_SECURITY_HEADERS,
	INLINE_MEDIA_TYPES,
	decideUploadResponseHeaders,
};
