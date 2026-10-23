"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const express = require("express");

const {
	registerVpkHtmlRoutes,
	resolveVpkHtmlFilePath,
} = require("./vpk-html");

async function withServer(rootDir, run, dependencies = {}) {
	const app = express();
	app.use(express.json({ limit: "1mb" }));
	registerVpkHtmlRoutes(app, { rootDir, ...dependencies });

	const server = http.createServer(app);
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	const baseUrl = `http://127.0.0.1:${address.port}`;

	try {
		await run(baseUrl);
	} finally {
		await new Promise((resolve, reject) => {
			server.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}
}

function createFixtureRoot(t) {
	const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-html-route-"));
	t.after(() => {
		fs.rmSync(rootDir, { force: true, recursive: true });
	});

	fs.mkdirSync(path.join(rootDir, "assets", "demos", "media"), { recursive: true });
	fs.mkdirSync(path.join(rootDir, "assets", "selector"), { recursive: true });
	fs.mkdirSync(path.join(rootDir, "assets", "templates"), { recursive: true });
	fs.mkdirSync(path.join(rootDir, "scripts"), { recursive: true });
	fs.writeFileSync(path.join(rootDir, "index.html"), "<!doctype html><style>:root { --accent: red; --ink: black; }</style><title>vpk-html</title>");
	fs.writeFileSync(path.join(rootDir, "SKILL.md"), "# vpk-html");
	fs.writeFileSync(path.join(rootDir, "assets", "demos", "demo.html"), "<!doctype html><style>:root { --accent: blue; }\n[data-theme=\"dark\"] { --accent: navy; }</style><title>Demo</title>");
	fs.writeFileSync(path.join(rootDir, "assets", "demos", "untouched.html"), "<!doctype html><style>.demo { --other: blue; }</style><title>Untouched</title>");
	fs.writeFileSync(path.join(rootDir, "assets", "demos", "media", "clip.mp4"), "fake-mp4-bytes");
	fs.writeFileSync(path.join(rootDir, "assets", "demos", "notes.txt"), "not servable");
	fs.writeFileSync(path.join(rootDir, "assets", "selector", "core.css"), ".vpkhs-root { display: contents; }");
	fs.writeFileSync(path.join(rootDir, "assets", "selector", "core.js"), "window.__VPK_HTML_SELECTOR__ = {};");
	fs.writeFileSync(path.join(rootDir, "assets", "selector", "notes.txt"), "not servable");
	fs.writeFileSync(path.join(rootDir, "assets", "templates", "template.html"), "<style>:root { --accent: template; }</style>");
	fs.writeFileSync(path.join(rootDir, "scripts", "build.mjs"), "console.log('internal')");
	return rootDir;
}

function createDotDirectoryFixtureRoot(t) {
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-html-route-dot-"));
	const rootDir = path.join(tempDir, ".agents", "skills", "vpk-html");
	t.after(() => {
		fs.rmSync(tempDir, { force: true, recursive: true });
	});

	fs.mkdirSync(rootDir, { recursive: true });
	fs.writeFileSync(path.join(rootDir, "index.html"), "<!doctype html><title>Dot root</title>");
	return rootDir;
}

test("vpk-html route serves index and nested assets from the skill root", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const indexResponse = await fetch(`${baseUrl}/api/vpk-html`);
		assert.equal(indexResponse.status, 200);
		assert.match(await indexResponse.text(), /vpk-html/u);

		const assetResponse = await fetch(`${baseUrl}/api/vpk-html/assets/demos/demo.html`);
		assert.equal(assetResponse.status, 200);
		assert.match(await assetResponse.text(), /Demo/u);

		const skillResponse = await fetch(`${baseUrl}/api/vpk-html/SKILL.md`);
		assert.equal(skillResponse.status, 200);
		assert.match(await skillResponse.text(), /vpk-html/u);
	});
});

test("vpk-html route serves catalog files from a dot-directory skill root", async (t) => {
	const rootDir = createDotDirectoryFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/index.html`);
		assert.equal(response.status, 200);
		assert.match(await response.text(), /Dot root/u);
	});
});

test("vpk-html route does not serve unlisted skill source files", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/scripts/build.mjs`);
		assert.equal(response.status, 400);
		assert.deepEqual(await response.json(), { error: "Invalid vpk-html asset path" });
	});
});

test("vpk-html route serves video media under assets/demos", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/assets/demos/media/clip.mp4`);
		assert.equal(response.status, 200);
		assert.equal(await response.text(), "fake-mp4-bytes");
	});
});

test("vpk-html route serves selector css and js assets", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const cssResponse = await fetch(`${baseUrl}/api/vpk-html/assets/selector/core.css`);
		assert.equal(cssResponse.status, 200);
		assert.match(cssResponse.headers.get("content-type") ?? "", /text\/css/u);
		assert.match(await cssResponse.text(), /\.vpkhs-root/u);

		const jsResponse = await fetch(`${baseUrl}/api/vpk-html/assets/selector/core.js`);
		assert.equal(jsResponse.status, 200);
		assert.match(jsResponse.headers.get("content-type") ?? "", /javascript/u);
		assert.match(await jsResponse.text(), /__VPK_HTML_SELECTOR__/u);
	});
});

test("vpk-html route rejects non-css/js selector assets", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const textResponse = await fetch(`${baseUrl}/api/vpk-html/assets/selector/notes.txt`);
		assert.equal(textResponse.status, 400);
		assert.deepEqual(await textResponse.json(), { error: "Invalid vpk-html asset path" });

		const nestedResponse = await fetch(`${baseUrl}/api/vpk-html/assets/selector/nested/core.js`);
		assert.equal(nestedResponse.status, 400);
		assert.deepEqual(await nestedResponse.json(), { error: "Invalid vpk-html asset path" });
	});
});

test("vpk-html route rejects non-media, non-html files under assets/demos", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/assets/demos/notes.txt`);
		assert.equal(response.status, 400);
		assert.deepEqual(await response.json(), { error: "Invalid vpk-html asset path" });
	});
});

test("vpk-html route rejects traversal outside the skill root", (t) => {
	const rootDir = createFixtureRoot(t);
	const outsidePath = path.join(rootDir, "..", "secret.txt");
	fs.writeFileSync(outsidePath, "secret");
	t.after(() => {
		fs.rmSync(outsidePath, { force: true });
	});

	assert.equal(resolveVpkHtmlFilePath("../secret.txt", { rootDir }), null);
	assert.equal(resolveVpkHtmlFilePath("assets/demos/../templates/source.html", { rootDir }), null);
	assert.equal(resolveVpkHtmlFilePath("assets/\0/demo.html", { rootDir }), null);
});

test("vpk-html route returns a 404 for missing assets", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/assets/demos/missing.html`);
		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "vpk-html asset not found" });
	});
});

test("vpk-html apply-tokens rewrites existing custom properties in catalog html only", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/apply-tokens`, {
			body: JSON.stringify({ tokens: { "--accent": "#123456", "--missing": "green" } }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { ok: true, updatedFiles: 2 });
	});

	assert.match(fs.readFileSync(path.join(rootDir, "index.html"), "utf8"), /--accent: #123456;/u);
	const demoHtml = fs.readFileSync(path.join(rootDir, "assets", "demos", "demo.html"), "utf8");
	assert.match(demoHtml, /:root \{ --accent: #123456; \}/u);
	assert.match(demoHtml, /\[data-theme="dark"\] \{ --accent: navy; \}/u);
	assert.doesNotMatch(fs.readFileSync(path.join(rootDir, "assets", "demos", "untouched.html"), "utf8"), /--missing/u);
	assert.match(fs.readFileSync(path.join(rootDir, "assets", "templates", "template.html"), "utf8"), /--accent: template;/u);
});

test("vpk-html apply-tokens leaves scoped theme overrides untouched", () => {
	const { applyTokenOverridesToHtml } = require("./vpk-html");
	const html = [
		"<style>",
		":root {",
		"\t--focal: #000000;",
		"}",
		"[data-theme=\"dark\"] {",
		"\t--focal: #ffffff;",
		"}",
		"</style>",
	].join("\n");

	const result = applyTokenOverridesToHtml(html, [["--focal", "#101044"]]);

	assert.equal(result.changed, true);
	assert.match(result.html, /:root \{\n\t--focal: #101044;\n\}/u);
	assert.match(result.html, /\[data-theme="dark"\] \{\n\t--focal: #ffffff;\n\}/u);
});

test("vpk-html apply-tokens validates payloads and is dev-only", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const missingTokens = await fetch(`${baseUrl}/api/vpk-html/apply-tokens`, {
			body: JSON.stringify({ tokens: {} }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const invalidName = await fetch(`${baseUrl}/api/vpk-html/apply-tokens`, {
			body: JSON.stringify({ tokens: { "accent": "#123456" } }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const invalidValue = await fetch(`${baseUrl}/api/vpk-html/apply-tokens`, {
			body: JSON.stringify({ tokens: { "--accent": "red;" } }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(missingTokens.status, 400);
		assert.deepEqual(await missingTokens.json(), { error: "tokens must be an object with 1 to 500 entries" });
		assert.equal(invalidName.status, 400);
		assert.deepEqual(await invalidName.json(), { error: "Invalid token name: accent" });
		assert.equal(invalidValue.status, 400);
		assert.deepEqual(await invalidValue.json(), { error: "Invalid token value for --accent" });
	});

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/apply-tokens`, {
			body: JSON.stringify({ tokens: { "--accent": "#123456" } }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "Not available" });
	}, { env: { NODE_ENV: "production" } });
});

test("vpk-html notes persist by validated artifact page", async (t) => {
	const rootDir = createFixtureRoot(t);
	const notesPath = path.join(rootDir, "notes-output", "notes.json");

	await withServer(rootDir, async (baseUrl) => {
		const empty = await fetch(`${baseUrl}/api/vpk-html/notes?page=assets/demos/demo.html`);
		assert.equal(empty.status, 200);
		assert.deepEqual(await empty.json(), { notes: "" });

		const saved = await fetch(`${baseUrl}/api/vpk-html/notes?page=assets/demos/demo.html`, {
			body: JSON.stringify({ notes: "Presenter reminder" }),
			headers: { "Content-Type": "application/json" },
			method: "PUT",
		});
		assert.equal(saved.status, 200);
		assert.deepEqual(await saved.json(), { ok: true });

		const loaded = await fetch(`${baseUrl}/api/vpk-html/notes?page=assets/demos/demo.html`);
		assert.equal(loaded.status, 200);
		assert.deepEqual(await loaded.json(), { notes: "Presenter reminder" });

		const invalidPath = await fetch(`${baseUrl}/api/vpk-html/notes?page=scripts/build.mjs`);
		assert.equal(invalidPath.status, 400);
		assert.deepEqual(await invalidPath.json(), { error: "Invalid vpk-html asset path" });
	}, { notesPath });

	assert.deepEqual(JSON.parse(fs.readFileSync(notesPath, "utf8")), {
		"assets/demos/demo.html": "Presenter reminder",
	});
});

test("vpk-html notes validate payloads and are dev-only", async (t) => {
	const rootDir = createFixtureRoot(t);

	await withServer(rootDir, async (baseUrl) => {
		const invalidBody = await fetch(`${baseUrl}/api/vpk-html/notes?page=assets/demos/demo.html`, {
			body: JSON.stringify({ notes: 7 }),
			headers: { "Content-Type": "application/json" },
			method: "PUT",
		});
		const tooLarge = await fetch(`${baseUrl}/api/vpk-html/notes?page=assets/demos/demo.html`, {
			body: JSON.stringify({ notes: "x".repeat(32 * 1024 + 1) }),
			headers: { "Content-Type": "application/json" },
			method: "PUT",
		});

		assert.equal(invalidBody.status, 400);
		assert.deepEqual(await invalidBody.json(), { error: "notes must be a string up to 32KB" });
		assert.equal(tooLarge.status, 400);
		assert.deepEqual(await tooLarge.json(), { error: "notes must be a string up to 32KB" });
	});

	await withServer(rootDir, async (baseUrl) => {
		const getResponse = await fetch(`${baseUrl}/api/vpk-html/notes?page=assets/demos/demo.html`);
		const putResponse = await fetch(`${baseUrl}/api/vpk-html/notes?page=assets/demos/demo.html`, {
			body: JSON.stringify({ notes: "hidden" }),
			headers: { "Content-Type": "application/json" },
			method: "PUT",
		});

		assert.equal(getResponse.status, 404);
		assert.deepEqual(await getResponse.json(), { error: "Not available" });
		assert.equal(putResponse.status, 404);
		assert.deepEqual(await putResponse.json(), { error: "Not available" });
	}, { env: { NODE_ENV: "production" } });
});

test("vpk-html publish-gist creates a secret gist with the validated artifact path", async (t) => {
	const rootDir = createFixtureRoot(t);
	const calls = [];
	const execFileImpl = (file, args, callback) => {
		calls.push({ args, file });
		callback(null, "https://gist.github.com/user/abc123\n", "");
	};

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/publish-gist`, {
			body: JSON.stringify({ page: "assets/demos/demo.html" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), { ok: true, url: "https://gist.github.com/user/abc123" });
	}, { execFileImpl });

	assert.deepEqual(calls, [{
		file: "gh",
		args: [
			"gist",
			"create",
			path.join(rootDir, "assets", "demos", "demo.html"),
			"--desc",
			"vpk-html: assets/demos/demo.html",
		],
	}]);
	assert.equal(calls[0].args.includes("--public"), false);
});

test("vpk-html publish-gist maps validation and gh failures", async (t) => {
	const rootDir = createFixtureRoot(t);
	const execFileImpl = (_file, _args, callback) => {
		callback(new Error("failed"), "", "gh: not authenticated\n");
	};

	await withServer(rootDir, async (baseUrl) => {
		const invalidPath = await fetch(`${baseUrl}/api/vpk-html/publish-gist`, {
			body: JSON.stringify({ page: "../secret.html" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const missingFile = await fetch(`${baseUrl}/api/vpk-html/publish-gist`, {
			body: JSON.stringify({ page: "assets/demos/missing.html" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});
		const ghFailure = await fetch(`${baseUrl}/api/vpk-html/publish-gist`, {
			body: JSON.stringify({ page: "assets/demos/demo.html" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(invalidPath.status, 400);
		assert.deepEqual(await invalidPath.json(), { error: "Invalid vpk-html asset path" });
		assert.equal(missingFile.status, 404);
		assert.deepEqual(await missingFile.json(), { error: "vpk-html asset not found" });
		assert.equal(ghFailure.status, 500);
		assert.deepEqual(await ghFailure.json(), { error: "gh: not authenticated" });
	}, { execFileImpl });

	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/publish-gist`, {
			body: JSON.stringify({ page: "assets/demos/demo.html" }),
			headers: { "Content-Type": "application/json" },
			method: "POST",
		});

		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "Not available" });
	}, { env: { NODE_ENV: "production" }, execFileImpl });
});

function createLocalRepo(t) {
	const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-html-local-"));
	t.after(() => {
		fs.rmSync(repoRoot, { force: true, recursive: true });
	});
	const rootDir = path.join(repoRoot, ".agents", "skills", "vpk-html");
	fs.mkdirSync(path.join(rootDir, "assets", "demos"), { recursive: true });
	fs.writeFileSync(path.join(rootDir, "index.html"), "<!doctype html><title>index</title>");
	fs.mkdirSync(path.join(repoRoot, "artifacts", "vpk-html", "eu26", "_src"), { recursive: true });
	fs.mkdirSync(path.join(repoRoot, "output", "vpk-html-v2", "spike"), { recursive: true });
	fs.mkdirSync(path.join(repoRoot, "elsewhere"), { recursive: true });
	fs.writeFileSync(path.join(repoRoot, "artifacts", "vpk-html", "eu26", "eu26.html"), "<!doctype html><title>EU26</title>");
	fs.writeFileSync(path.join(repoRoot, "artifacts", "vpk-html", "eu26", "_src", "body.html"), "<p>source</p>");
	fs.writeFileSync(path.join(repoRoot, "artifacts", "vpk-html", "eu26", "notes.md"), "# notes");
	fs.writeFileSync(path.join(repoRoot, "output", "vpk-html-v2", "spike", "copy.html"), "<!doctype html><title>Spike</title>");
	fs.writeFileSync(path.join(repoRoot, "elsewhere", "secret.html"), "<!doctype html><title>Secret</title>");
	fs.writeFileSync(path.join(repoRoot, ".env"), "SECRET=1");
	fs.symlinkSync(path.join(repoRoot, "elsewhere", "secret.html"), path.join(repoRoot, "output", "vpk-html-v2", "spike", "escape.html"));
	return { repoRoot, rootDir };
}

test("T-BE1 dev serves allowed local artifact html with no-store and nosniff", async (t) => {
	const { repoRoot, rootDir } = createLocalRepo(t);
	await withServer(rootDir, async (baseUrl) => {
		for (const page of ["local/artifacts/vpk-html/eu26/eu26.html", "local/output/vpk-html-v2/spike/copy.html"]) {
			const response = await fetch(`${baseUrl}/api/vpk-html/${page}`);
			assert.equal(response.status, 200, page);
			assert.equal(response.headers.get("cache-control"), "no-store");
			assert.equal(response.headers.get("x-content-type-options"), "nosniff");
			assert.match(await response.text(), /<title>/);
		}
		const missing = await fetch(`${baseUrl}/api/vpk-html/local/output/vpk-html-v2/spike/missing.html`);
		assert.equal(missing.status, 404);
	}, { env: { NODE_ENV: "development" }, repoRoot });
});

test("T-BE2 local pages reject traversal, dot files, _src sources, other roots, non-html and symlink escapes", async (t) => {
	const { repoRoot, rootDir } = createLocalRepo(t);
	const { resolveLocalArtifactFilePath } = require("./vpk-html");
	for (const bad of ["artifacts/vpk-html/../../.env", "artifacts/vpk-html/eu26/_src/body.html", "artifacts/vpk-html/eu26/notes.md", "elsewhere/secret.html", ".env", "output/vpk-html-v2/spike/escape.html", "output/vpk-html-v2/.hidden/x.html", "artifacts/other/x.html"]) {
		assert.equal(resolveLocalArtifactFilePath(bad, { repoRoot }), null, bad);
	}
	assert.equal(resolveLocalArtifactFilePath("output/vpk-html/a/b.html", { repoRoot }), path.join(repoRoot, "output/vpk-html/a/b.html"), "a missing file under an allowed root resolves (404 later)");
	await withServer(rootDir, async (baseUrl) => {
		for (const page of ["local/artifacts/vpk-html/eu26/_src/body.html", "local/artifacts/vpk-html/eu26/notes.md", "local/elsewhere/secret.html", "local/output/vpk-html-v2/spike/escape.html", "local/%2e%2e/.env"]) {
			const response = await fetch(`${baseUrl}/api/vpk-html/${page}`);
			assert.ok([400, 404].includes(response.status), `${page} -> ${response.status}`);
			assert.doesNotMatch(await response.text(), /Secret|SECRET|source/);
		}
	}, { env: { NODE_ENV: "development" }, repoRoot });
});

test("T-BE3 local pages are 404 in production", async (t) => {
	const { repoRoot, rootDir } = createLocalRepo(t);
	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/local/artifacts/vpk-html/eu26/eu26.html`);
		assert.equal(response.status, 404);
		assert.deepEqual(await response.json(), { error: "Not available" });
		const index = await fetch(`${baseUrl}/api/vpk-html/index.html`);
		assert.equal(index.status, 200, "catalog pages still serve");
	}, { env: { NODE_ENV: "production" }, repoRoot });
});

test("T-BE4 speaker notes round-trip for local pages", async (t) => {
	const { repoRoot, rootDir } = createLocalRepo(t);
	const notesPath = path.join(repoRoot, "output", "vpk-html", "notes.json");
	await withServer(rootDir, async (baseUrl) => {
		const page = encodeURIComponent("local/output/vpk-html-v2/spike/copy.html");
		const put = await fetch(`${baseUrl}/api/vpk-html/notes?page=${page}`, { body: JSON.stringify({ notes: "Narrate the spike." }), headers: { "Content-Type": "application/json" }, method: "PUT" });
		assert.equal(put.status, 200);
		const get = await fetch(`${baseUrl}/api/vpk-html/notes?page=${page}`);
		assert.deepEqual(await get.json(), { notes: "Narrate the spike." });
		assert.equal(JSON.parse(fs.readFileSync(notesPath, "utf8"))["local/output/vpk-html-v2/spike/copy.html"], "Narrate the spike.");
		const bad = await fetch(`${baseUrl}/api/vpk-html/notes?page=${encodeURIComponent("local/elsewhere/secret.html")}`);
		assert.equal(bad.status, 400);
	}, { env: { NODE_ENV: "development" }, notesPath, repoRoot });
});

test("T-BE5 publish-gist refuses local pages", async (t) => {
	const { repoRoot, rootDir } = createLocalRepo(t);
	let called = false;
	await withServer(rootDir, async (baseUrl) => {
		const response = await fetch(`${baseUrl}/api/vpk-html/publish-gist`, { body: JSON.stringify({ page: "local/artifacts/vpk-html/eu26/eu26.html" }), headers: { "Content-Type": "application/json" }, method: "POST" });
		assert.equal(response.status, 400);
		assert.match((await response.json()).error, /build\.mjs --publish/);
	}, { env: { NODE_ENV: "development" }, execFileImpl: () => { called = true; }, repoRoot });
	assert.equal(called, false, "gh never runs for local pages");
});
