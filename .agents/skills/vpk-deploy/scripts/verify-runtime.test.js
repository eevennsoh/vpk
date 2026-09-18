const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const zlib = require("node:zlib");

async function verify(t, handler, args = []) {
	const requests = [];
	const server = http.createServer((req, res) => {
		requests.push({ path: req.url, origin: req.headers.origin });
		if (handler?.(req, res)) return;
		if (req.url === "/api/health") {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify({ status: "OK", llmRouting: { aiGatewayConfigured: true } }));
		} else if (req.url === "/api/realtime/audio-conversation-token") {
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify({ token: "secret-fixture-token", expiresInMs: 60000 }));
		} else {
			res.setHeader("Content-Type", "text/html");
			res.end("<h1>Test app</h1>");
		}
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
	const baseUrl = `http://127.0.0.1:${server.address().port}`;
	const child = spawn(process.execPath, [path.join(__dirname, "verify-runtime.mjs"), baseUrl, ...args]);
	const deadline = setTimeout(() => child.kill(), 5000);
	t.after(() => clearTimeout(deadline));
	let output = "";
	child.stdout.on("data", (data) => { output += data; });
	child.stderr.on("data", (data) => { output += data; });
	t.after(() => { if (child.exitCode === null) child.kill(); });
	const status = await new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("close", resolve);
	});
	return { status, output, requests, baseUrl };
}

test("full runtime verifies only the default root and never exposes tokens", async (t) => {
	const result = await verify(t);
	assert.equal(result.status, 0, result.output);
	assert.ok(!result.requests.some((req) => req.path === "/studio/"));
	assert.equal(result.requests.find((req) => req.path.includes("token")).origin, result.baseUrl);
	assert.doesNotMatch(result.output, /secret-fixture-token/u);
});

test("static profile skips backend endpoints", async (t) => {
	const result = await verify(t, undefined, ["--profile", "static", "/"]);
	assert.equal(result.status, 0, result.output);
	assert.deepEqual(result.requests.map((req) => req.path), ["/"]);
});

test("static delivery verifies compression and caching and reports lengths without query secrets", async (t) => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-delivery-report-"));
	t.after(() => fs.rmSync(root, { recursive: true, force: true }));
	const report = path.join(root, "report.json");
	const html = '<script src="/_next/static/chunks/test.12345678.js"></script>' + "<p>Repeated text</p>".repeat(200);
	const result = await verify(t, (req, res) => {
		const isHtml = req.url.startsWith("/?");
		const content = isHtml ? html : "const repeated = 123;\n".repeat(200);
		const encoding = req.headers["accept-encoding"].includes("br") ? "br" : "gzip";
		const compressed = encoding === "br" ? zlib.brotliCompressSync(content) : zlib.gzipSync(content);
		res.setHeader("Content-Type", isHtml ? "text/html" : "text/javascript");
		res.setHeader("Content-Encoding", encoding);
		res.setHeader("Vary", "Accept-Encoding");
		res.setHeader("Cache-Control", isHtml ? "public, max-age=0" : "public, max-age=31536000, immutable");
		res.setHeader("Content-Length", compressed.length);
		res.end(compressed);
		return true;
	}, ["--profile", "static", "/?token=hidden-query-value", "--check-static-delivery", "--report", report]);
	assert.equal(result.status, 0, result.output);
	assert.doesNotMatch(result.output, /hidden-query-value/u);
	const artifact = JSON.parse(fs.readFileSync(report, "utf8"));
	assert.deepEqual(artifact.failures, []);
	assert.equal(artifact.responses[0].decodedBodyBytes, Buffer.byteLength(html));
	assert.equal(artifact.responses[0].contentEncoding, "br");
	assert.equal(artifact.responses[1].contentEncoding, "gzip");
	assert.ok(artifact.responses[0].reportedEncodedContentLengthBytes < artifact.responses[0].decodedBodyBytes);
	assert.doesNotMatch(JSON.stringify(artifact), /hidden-query-value/u);
});

test("static delivery reports uncompressed text and wrong immutable cache policy", async (t) => {
	const result = await verify(t, (req, res) => {
		res.setHeader("Content-Type", req.url === "/" ? "text/html" : "text/javascript");
		res.setHeader("Cache-Control", "public, max-age=0");
		res.end(req.url === "/" ? '<script src="/_next/static/chunks/test.12345678.js"></script>' : "x".repeat(2000));
		return true;
	}, ["--profile", "static", "--check-static-delivery"]);
	assert.equal(result.status, 1);
	assert.match(result.output, /not compressed/u);
	assert.match(result.output, /immutable caching/u);
});

for (const [name, expectedHtml, status] of [
	["current export", "<html><body>Current release</body></html>", 0],
	["older live image", "<html><body>Older release</body></html>", 1],
]) {
	test(`runtime ${status ? "rejects" : "accepts"} ${name} with an expected HTML file`, async (t) => {
		const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-deploy-html-"));
		t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
		const expectedPath = path.join(tempDir, "index.html");
		fs.writeFileSync(expectedPath, expectedHtml);
		const result = await verify(t, (req, res) => {
			if (req.url !== "/") return false;
			res.setHeader("Content-Type", "text/html");
			res.end("<html><body>Current release</body></html>");
			return true;
		}, ["--profile", "static", "--expect-html-file", expectedPath]);
		assert.equal(result.status, status, result.output);
		assert.match(result.output, status ? /live HTML differs from expected export file/u : /matches expected export HTML/u);
		assert.doesNotMatch(result.output, /Older release/u);
	});
}

test("backend profile does not require AI or realtime", async (t) => {
	const result = await verify(t, (req, res) => {
		if (req.url !== "/api/health") return false;
		res.setHeader("Content-Type", "application/json");
		res.end(JSON.stringify({ status: "OK" }));
		return true;
	}, ["--profile", "backend"]);
	assert.equal(result.status, 0, result.output);
	assert.ok(!result.requests.some((req) => req.path.includes("token")));
});

for (const [name, endpoint, type, payload, expected] of [
	["health HTML", "/api/health", "text/html", "<h1>Fallback</h1>", /JSON/iu],
	["unready health", "/api/health", "application/json", '{"status":"ERROR"}', /status/iu],
	["missing gateway", "/api/health", "application/json", '{"status":"OK"}', /aiGatewayConfigured/iu],
	["token HTML", "/api/realtime/audio-conversation-token", "text/html", "<h1>Fallback</h1>", /JSON/iu],
	["null token", "/api/realtime/audio-conversation-token", "application/json", '{"token":null,"expiresInMs":0}', /token/iu],
]) {
	test(`runtime rejects ${name} with HTTP 200`, async (t) => {
		const result = await verify(t, (req, res) => {
			if (req.url !== endpoint) return false;
			res.setHeader("Content-Type", type);
			res.end(payload);
			return true;
		});
		assert.equal(result.status, 1, result.output);
		assert.match(result.output, expected);
	});
}

test("runtime rejects cross-origin redirects without requesting their destination", async (t) => {
	const result = await verify(t, (req, res) => {
		if (req.url !== "/") return false;
		res.writeHead(302, { Location: "http://127.0.0.1:1/studio/" });
		res.end();
		return true;
	});
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, /cross-origin redirect/iu);
});

test("runtime labels timeouts rather than hanging", async (t) => {
	const result = await verify(t, (req) => req.url === "/", ["--profile", "static", "--timeout-ms", "100"]);
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, /route \/:.*timed out/iu);
});

test("runtime detects browser-shaped font failures", async (t) => {
	const result = await verify(t, (req, res) => {
		if (req.url === "/") {
			res.setHeader("Content-Type", "text/html");
			res.end('<link href="/_next/static/font.woff2">');
			return true;
		}
		if (req.url === "/_next/static/font.woff2") {
			res.setHeader("Content-Type", "font/woff2");
			res.statusCode = req.headers.origin ? 500 : 200;
			res.end();
			return true;
		}
		return false;
	}, ["--profile", "static"]);
	assert.equal(result.status, 1, result.output);
	assert.match(result.output, /browser-font.*500/iu);
});

const THEMED_HTML = '<html data-color-mode="light" data-theme="light:light dark:dark spacing:spacing typography:typography shape:shape"><head>'
	+ ["light", "spacing", "typography", "shape"].map((id) => `<style data-theme="${id}">:root{--ds-fixture:1rem}</style>`).join("")
	+ '</head><body><h1>Styled app</h1></body></html>';

test("runtime accepts initial ADS themes without relying on hydration", async (t) => {
	const result = await verify(t, (req, res) => {
		if (req.url !== "/") return false;
		res.setHeader("Content-Type", "text/html");
		res.end(THEMED_HTML);
		return true;
	}, ["--profile", "static", "--check-ads-theme"]);
	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /initial ADS theme HTML passed/u);
});

for (const [name, html, args, expected] of [
	["missing root theme activation", THEMED_HTML.replace(/ data-theme="[^"]*"/u, ""), [], /does not activate/u],
	["prefixed attributes instead of root theme activation", THEMED_HTML.replace(' data-theme="', ' data-other-data-theme="'), [], /does not activate/u],
	["missing active theme CSS", THEMED_HTML.replace(/<style data-theme="spacing">.*?<\/style>/u, ""), [], /head lacks the active spacing/u],
	["missing complete ADS setup", "<html><head></head><body>App</body></html>", ["--check-ads-theme"], /data-color-mode/u],
]) {
	test(`runtime rejects ${name}`, async (t) => {
		const result = await verify(t, (req, res) => {
			if (req.url !== "/") return false;
			res.setHeader("Content-Type", "text/html");
			res.end(html);
			return true;
		}, ["--profile", "static", ...args]);
		assert.equal(result.status, 1, result.output);
		assert.match(result.output, expected);
	});
}

test("automatic inline-theme checks leave separately linked theme CSS to its own verification", async (t) => {
	const result = await verify(t, (req, res) => {
		if (req.url !== "/") return false;
		res.setHeader("Content-Type", "text/html");
		res.end(THEMED_HTML.replace(/<style\b[^>]*>.*?<\/style>/gu, '<link rel="stylesheet" href="/theme.css">'));
		return true;
	}, ["--profile", "static"]);
	assert.equal(result.status, 0, result.output);
});

for (const [extension, contentType, expected] of [
	["css", "text/css", /expected CSS/u],
	["js", "text/javascript", /expected JavaScript/u],
	["woff2", "font/woff2", /expected font/u],
]) {
	for (const fallback of [false, true]) {
		test(`runtime ${fallback ? "rejects HTML fallback for" : "accepts"} ${extension} assets`, async (t) => {
			const result = await verify(t, (req, res) => {
				res.setHeader("Content-Type", req.url === "/" || fallback ? "text/html" : contentType);
				res.end(req.url === "/" ? `<html><head><link href="/_next/static/fixture.${extension}"></head></html>` : "fixture");
				return true;
			}, ["--profile", "static"]);
			assert.equal(result.status, fallback ? 1 : 0, result.output);
			if (fallback) assert.match(result.output, expected);
		});
	}
}
