const test = require("node:test");
const assert = require("node:assert/strict");

const {
	ImageProxyResponseTooLargeError,
	buildImageProxyRequestHeaders,
	deriveAtlassianImageCandidatesFromUrl,
	extractAtlassianImageCandidatesFromHtml,
	isAllowedAtlassianImageUrl,
	parseImageProxyTarget,
	readImageProxyResponsePayload,
} = require("./image-proxy");

test("parseImageProxyTarget accepts Atlassian headshot attachment URLs", () => {
	const sourceUrl =
		"https://hello.atlassian.net/wiki/pages/viewpageattachments.action?pageId=6450653554&preview=%2F6450653554%2F6538248503%2FDavid+Hoang+headshot.png";

	const result = parseImageProxyTarget(sourceUrl);

	assert.equal(result.error, undefined);
	assert.equal(result.targetUrl.toString(), sourceUrl);
	assert.equal(result.source, "atlassian");
	assert.equal(isAllowedAtlassianImageUrl(result.targetUrl), true);
});

test("parseImageProxyTarget rejects ordinary Atlassian page URLs", () => {
	const result = parseImageProxyTarget(
		"https://hello.atlassian.net/wiki/spaces/DHub/pages/3836837889/David+Hoang+-+Head+of+Design+AI+-+Onboarding",
	);

	assert.deepEqual(result, {
		error: "Image URL is not allowed",
	});
});

test("buildImageProxyRequestHeaders adds Atlassian auth when configured", () => {
	const targetUrl = new URL(
		"https://hello.atlassian.net/wiki/download/attachments/1/David+Hoang+headshot.png",
	);

	const headers = buildImageProxyRequestHeaders(targetUrl, {
		ATLASSIAN_API_TOKEN: "test-token",
	});

	assert.equal(headers.Accept, "image/*");
	assert.equal(headers.Authorization, "Bearer test-token");
});

test("deriveAtlassianImageCandidatesFromUrl rewrites preview attachment URLs to download candidates", () => {
	const candidates = deriveAtlassianImageCandidatesFromUrl(
		new URL(
			"https://hello.atlassian.net/wiki/pages/viewpageattachments.action?pageId=6450653554&preview=%2F6450653554%2F6538248503%2FDavid+Hoang+headshot.png",
		),
	);

	assert.deepEqual(
		candidates.map((candidate) => candidate.toString()),
		[
			"https://hello.atlassian.net/wiki/download/attachments/6450653554/David%20Hoang%20headshot.png?api=v2",
			"https://hello.atlassian.net/wiki/download/attachments/6450653554/David%20Hoang%20headshot.png",
		],
	);
});

test("extractAtlassianImageCandidatesFromHtml returns relative download attachment URLs", () => {
	const candidates = extractAtlassianImageCandidatesFromHtml(
		`<html><head><meta property="og:image" content="/wiki/download/attachments/6450653554/David+Hoang+headshot.png?api=v2"></head></html>`,
		new URL(
			"https://hello.atlassian.net/wiki/pages/viewpageattachments.action?pageId=6450653554&preview=%2F6450653554%2F6538248503%2FDavid+Hoang+headshot.png",
		),
	);

	assert.deepEqual(
		candidates.map((candidate) => candidate.toString()),
		[
			"https://hello.atlassian.net/wiki/download/attachments/6450653554/David+Hoang+headshot.png?api=v2",
		],
	);
});

test("readImageProxyResponsePayload returns payloads within the configured limit", async () => {
	const response = new Response("test", {
		headers: {
			"content-length": "4",
			"content-type": "image/png",
		},
	});

	const payload = await readImageProxyResponsePayload(response, { maxBytes: 4 });

	assert.deepEqual(payload, Buffer.from("test"));
});

test("readImageProxyResponsePayload rejects oversized content-length before reading", async () => {
	let wasPulled = false;
	let wasCanceled = false;
	const response = new Response(
		new ReadableStream({
			pull(controller) {
				wasPulled = true;
				controller.enqueue(new Uint8Array([1]));
				controller.close();
			},
			cancel() {
				wasCanceled = true;
			},
		}),
		{
			headers: {
				"content-length": "5",
				"content-type": "image/png",
			},
		},
	);

	await assert.rejects(
		readImageProxyResponsePayload(response, { maxBytes: 4 }),
		ImageProxyResponseTooLargeError,
	);
	assert.equal(wasPulled, false);
	assert.equal(wasCanceled, true);
});

test("readImageProxyResponsePayload rejects streamed responses that exceed the limit", async () => {
	let wasCanceled = false;
	const chunks = [Buffer.alloc(3), Buffer.alloc(2)];
	const response = new Response(
		new ReadableStream({
			pull(controller) {
				const chunk = chunks.shift();
				if (chunk) {
					controller.enqueue(chunk);
					return;
				}
				controller.close();
			},
			cancel() {
				wasCanceled = true;
			},
		}),
		{
			headers: {
				"content-type": "image/png",
			},
		},
	);

	await assert.rejects(
		readImageProxyResponsePayload(response, { maxBytes: 4 }),
		ImageProxyResponseTooLargeError,
	);
	assert.equal(wasCanceled, true);
});

test("parseImageProxyTarget never sends the Atlassian token over plain http", () => {
	assert.deepEqual(
		parseImageProxyTarget("http://hello.atlassian.net/wiki/download/attachments/1/photo.png"),
		{ error: "Image URL is not allowed" },
	);
	assert.equal(parseImageProxyTarget("https://hello.atlassian.net/wiki/download/attachments/1/photo.png").source, "atlassian");
	for (const src of ["file:///etc/passwd", "http://127.0.0.1/x.png", "https://evil.example/x.png"]) {
		assert.ok(parseImageProxyTarget(src).error, src);
	}
});

test("image candidates found in a page are fetched over https only, and the token goes only to configured sites", () => {
	const page = new URL("https://hello.atlassian.net/wiki/spaces/X/pages/1");
	const html = [
		"<img src=\"http://hello.atlassian.net/wiki/download/attachments/1/plain.png\">",
		"<img src=\"https://hello.atlassian.net/wiki/download/attachments/1/secure.png\">",
	].join("");
	assert.deepEqual(extractAtlassianImageCandidatesFromHtml(html, page).map(String), [
		"https://hello.atlassian.net/wiki/download/attachments/1/secure.png",
	]);
	assert.equal(isAllowedAtlassianImageUrl(new URL("http://hello.atlassian.net/wiki/download/attachments/1/x.png")), false);

	const env = { ATLASSIAN_API_TOKEN: "made-up-token" };
	const otherTenant = buildImageProxyRequestHeaders(new URL("https://other-tenant.atlassian.net/wiki/download/attachments/1/x.png"), env);
	assert.equal(otherTenant.Authorization, undefined);
	const configured = buildImageProxyRequestHeaders(new URL("https://team.atlassian.net/wiki/download/attachments/1/x.png"), { ...env, ATLASSIAN_SITE_HOSTS: "team.atlassian.net" });
	assert.equal(configured.Authorization, "Bearer made-up-token");
});

test("the token goes only to an image URL on a configured site, on every hop", () => {
	const env = { ATLASSIAN_API_TOKEN: "made-up-token", ATLASSIAN_SITE_HOSTS: "team.atlassian.net" };
	const auth = (url) => buildImageProxyRequestHeaders(new URL(url), env).Authorization;
	assert.equal(auth("https://team.atlassian.net/wiki/download/attachments/1/x.png"), "Bearer made-up-token");
	assert.equal(auth("https://team.atlassian.net/secure/useravatar?avatarId=1"), "Bearer made-up-token");
	for (const url of [
		"https://team.atlassian.net/rest/api/3/myself",
		"https://team.atlassian.net/wiki/download/attachments/1/notes.txt",
		"https://team.atlassian.net/wiki/rest/api/content",
		"http://team.atlassian.net/wiki/download/attachments/1/x.png",
		"https://other.atlassian.net/wiki/download/attachments/1/x.png",
	]) {
		assert.equal(auth(url), undefined, url);
	}
});

test("a Figma asset URL must be https", () => {
	assert.equal(parseImageProxyTarget("https://www.figma.com/api/mcp/asset/a").source, "figma");
	assert.equal(parseImageProxyTarget("http://www.figma.com/api/mcp/asset/a").error, "Image URL is not allowed");
});
