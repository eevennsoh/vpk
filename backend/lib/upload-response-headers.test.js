"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { decideUploadResponseHeaders } = require("./upload-response-headers");

test("only media types a browser renders without script are served inline", () => {
	const cases = [
		["a PNG screenshot", { mediaType: "image/png", filename: "shot.png" }, "image/png", "inline"],
		["a JPEG with parameters and case", { mediaType: "Image/JPEG; q=1", filename: "a.jpg" }, "image/jpeg", "inline"],
		["plain text", { mediaType: "text/plain", filename: "notes.txt" }, "text/plain; charset=utf-8", "inline"],
		["an audio clip", { mediaType: "audio/webm", filename: "clip.webm" }, "audio/webm", "inline"],
		["HTML", { mediaType: "text/html", filename: "page.html" }, "application/octet-stream", "attachment"],
		["HTML with parameters", { mediaType: "text/html; charset=utf-8", filename: "page.html" }, "application/octet-stream", "attachment"],
		["SVG, inline only under the sandboxing CSP", { mediaType: "image/svg+xml", filename: "logo.svg" }, "image/svg+xml", "inline"],
		["image/jpg", { mediaType: "image/jpg", filename: "a.jpg" }, "image/jpeg", "inline"],
		["audio/x-wav", { mediaType: "audio/x-wav", filename: "a.wav" }, "audio/wav", "inline"],
		["audio/x-m4a", { mediaType: "audio/x-m4a", filename: "a.m4a" }, "audio/mp4", "inline"],
		["audio/aac", { mediaType: "audio/aac", filename: "a.aac" }, "audio/aac", "inline"],
		["video/quicktime", { mediaType: "video/quicktime", filename: "a.mov" }, "video/quicktime", "inline"],
		["image/x-icon", { mediaType: "image/x-icon", filename: "favicon.ico" }, "image/x-icon", "inline"],
		["image/tiff", { mediaType: "image/tiff", filename: "a.tiff" }, "application/octet-stream", "attachment"],
		["XHTML", { mediaType: "application/xhtml+xml", filename: "x.xhtml" }, "application/octet-stream", "attachment"],
		["XML", { mediaType: "text/xml", filename: "x.xml" }, "application/octet-stream", "attachment"],
		["PDF", { mediaType: "application/pdf", filename: "doc.pdf" }, "application/octet-stream", "attachment"],
		["JavaScript", { mediaType: "text/javascript", filename: "x.js" }, "application/octet-stream", "attachment"],
		["no type", { filename: "blob" }, "application/octet-stream", "attachment"],
		["a non-string type", { mediaType: ["image/png"] }, "application/octet-stream", "attachment"],
	];
	for (const [name, upload, contentType, disposition] of cases) {
		const headers = decideUploadResponseHeaders(upload);
		assert.equal(headers["Content-Type"], contentType, name);
		assert.equal(headers["Content-Disposition"].split(";")[0], disposition, name);
		assert.equal(headers["X-Content-Type-Options"], "nosniff", name);
		assert.match(headers["Content-Security-Policy"], /^sandbox;/u, name);
	}
});

test("the filename cannot break out of the Content-Disposition header", () => {
	const headers = decideUploadResponseHeaders({ mediaType: "image/png", filename: "a\"; x=\"y\r\nSet-Cookie: s=1.png" });
	assert.equal(/[\r\n]/u.test(headers["Content-Disposition"]), false);
	assert.match(headers["Content-Disposition"], /^inline; filename="a_; x=_y__Set-Cookie: s=1\.png"; filename\*=UTF-8''/u);
	assert.match(decideUploadResponseHeaders({ mediaType: "image/png", filename: "résumé.png" })["Content-Disposition"], /filename\*=UTF-8''r%C3%A9sum%C3%A9\.png$/u);
	assert.match(decideUploadResponseHeaders({ mediaType: "image/png" })["Content-Disposition"], /filename="attachment\.bin"/u);
});

test("a filename that cannot be UTF-8 encoded keeps its ASCII form, and ' ( ) * are percent-encoded", () => {
	const lone = decideUploadResponseHeaders({ mediaType: "image/png", filename: "a\uD800b.png" })["Content-Disposition"];
	assert.equal(lone, 'inline; filename="a_b.png"');
	const punctuated = decideUploadResponseHeaders({ mediaType: "image/png", filename: "it's (final)*.png" })["Content-Disposition"];
	assert.equal(punctuated, `inline; filename="it's (final)*.png"; filename*=UTF-8''it%27s%20%28final%29%2A.png`);
});

test("the file policy is exactly: sandbox, nothing by default, inline styles for SVG, no script", () => {
	const { FILE_RESPONSE_SECURITY_HEADERS } = require("./upload-response-headers");
	assert.equal(
		FILE_RESPONSE_SECURITY_HEADERS["Content-Security-Policy"],
		"sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
	);
	const directives = new Map(FILE_RESPONSE_SECURITY_HEADERS["Content-Security-Policy"].split(";").map((part) => {
		const [name, ...values] = part.trim().split(/\s+/u);
		return [name, values];
	}));
	assert.deepEqual(directives.get("sandbox"), [], "sandbox with no allow-scripts");
	assert.deepEqual(directives.get("default-src"), ["'none'"]);
	assert.equal(directives.has("script-src"), false);
	assert.deepEqual(directives.get("style-src"), ["'unsafe-inline'"]);
});

test("a long filename is cut to MAX_FILENAME_CHARS, keeping its extension, without splitting a character", () => {
	const { MAX_FILENAME_CHARS, buildContentDisposition } = require("./upload-response-headers");
	const quoted = (header) => header.match(/filename="([^"]*)"/u)[1];
	const long = `${"a".repeat(500)}.png`;
	const header = buildContentDisposition("inline", long);
	assert.equal(quoted(header).length, MAX_FILENAME_CHARS);
	assert.equal(quoted(header).endsWith(".png"), true);
	const emoji = `${"😀".repeat(400)}.pdf`;
	const emojiHeader = buildContentDisposition("attachment", emoji);
	const extValue = decodeURIComponent(emojiHeader.split("filename*=UTF-8''")[1]);
	assert.equal(Array.from(extValue).length, MAX_FILENAME_CHARS);
	assert.equal(extValue.endsWith(".pdf"), true);
	assert.equal(extValue.includes("\uFFFD"), false);
	assert.equal(quoted(buildContentDisposition("inline", "short.png")), "short.png");
});
