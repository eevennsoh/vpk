#!/usr/bin/env node
// T4 (ws6 §8, C5/C12/C15): publish.mjs scan rules, helpers, dry runs, confirmed runs and exit
// codes. Every side effect is a fake from `deps`: no Chromium, no network, no ~/.config writes.
// Fake secrets are assembled at run time.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const PUBLISH_ARTIFACT = path.join(REPO_ROOT, "scripts", "publish-artifact.mjs");
const REVIEW_CLI = path.join(__dirname, "review", "cli.mjs");
const TOKEN = () => "gh" + "p_" + "x".repeat(36);

async function load() {
	return import("./publish.mjs");
}

const doc = (body = "<p>Hello</p>", head = "") => `<!doctype html><html><head><title>Q3 &amp; Beyond &mdash; plan</title><meta content="Plan &amp; risks" name="description">${head}</head><body><main>${body}</main></body></html>`;

function tempDir(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-publish-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return fs.realpathSync(dir);
}

// A world of fakes: a temp repo root with the two artifact scripts, an in-memory registry
// store, and call logs for every spawn and exec.
function world(t, { html = doc(), artifactRegistry = null, gistRegistry = null, viewerReport = { blockedRequests: [], missingAssets: [], pageErrors: [], rendered: { elements: 12 }, sandbox: "allow-scripts", screenshot: "x.png" }, viewerStdout = null, content = { findings: [] }, sizes = [], gh = null, scripts = true } = {}) {
	const dir = tempDir(t);
	const repoRoot = path.join(dir, "repo");
	if (scripts) {
		for (const name of ["verify-artifact-html.mjs", "publish-artifact.mjs"]) {
			fs.mkdirSync(path.join(repoRoot, "scripts"), { recursive: true });
			fs.writeFileSync(path.join(repoRoot, "scripts", name), "");
		}
	}
	const file = path.join(dir, "artifacts", "vpk-html", "q3-plan", "q3-plan.html");
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, html);
	const store = new Map();
	if (artifactRegistry) store.set(path.join(dir, "artifacts.json"), JSON.stringify(artifactRegistry));
	if (gistRegistry) store.set(path.join(dir, "gists.json"), JSON.stringify(gistRegistry));
	const writes = [];
	const spawns = [];
	const execs = [];
	const logs = [];
	const errors = [];
	const deps = {
		fs: {
			existsSync: target => store.has(target) || fs.existsSync(target),
			readFileSync: (target, encoding) => (store.has(target) ? store.get(target) : fs.readFileSync(target, encoding)),
			writeFileSync: (target, text) => { writes.push(target); store.set(target, text); },
			mkdirSync: target => { writes.push(`mkdir ${target}`); },
		},
		env: { VPK_GIST_REGISTRY: path.join(dir, "gists.json"), VPK_ARTIFACT_REGISTRY: path.join(dir, "artifacts.json") },
		repoRoot: scripts ? repoRoot : null,
		now: () => new Date("2026-10-11T12:00:00.000Z"),
		log: line => logs.push(String(line)),
		error: line => errors.push(String(line)),
		spawnNode: async (script, args, options) => {
			spawns.push({ script, args, options });
			if (script.endsWith("verify-artifact-html.mjs")) return { code: 0, stdout: viewerStdout ?? `${JSON.stringify(viewerReport)}\n`, stderr: "" };
			return { code: 0, stdout: "Created \"Q3\"\nArtifact URL: https://hello.atlassian.net/artifacts/a1\n", stderr: "" };
		},
		execFile: async (command, args) => {
			execs.push([command, ...args]);
			return gh ?? { code: 0, stdout: "https://gist.github.com/someone/abc123def\n", stderr: "" };
		},
		importModule: async target => {
			assert.ok(target.endsWith("publish-artifact.mjs"));
			return import(PUBLISH_ARTIFACT);
		},
		checkContent: async () => content,
		weightWarnings: async () => sizes,
	};
	return { dir, file, repoRoot, deps, store, writes, spawns, execs, logs, errors };
}

const args = (target, file, extra = {}) => ({ target, file, confirm: false, access: null, name: null, description: null, forceNew: false, includeReview: false, allowLocalPaths: false, visibility: "public", visibilityExplicit: false, ...extra });

test("P1–P6 each fire, and P2 ignores URLs and data: URIs", async () => {
	const { prepublishScan } = await load();
	const ids = (html, options) => prepublishScan(html, options).map(item => `${item.id}:${item.severity}`);
	assert.deepEqual(prepublishScan(doc()), []);
	const secret = prepublishScan(doc(`<pre>token ${TOKEN()}</pre>`));
	assert.equal(secret[0].id, "P1");
	assert.match(secret[0].message, /^GitHub token at offset \d+ \(ghp_…\)$/);
	assert.ok(!JSON.stringify(secret).includes(TOKEN()), "never echoes the secret");
	assert.deepEqual(ids(doc("<p>/Users/x/notes.md</p>")), ["P2:error"]);
	assert.deepEqual(ids(doc("<p>/Users/x/notes.md</p>"), { allowLocalPaths: true }), ["P2:warning"]);
	assert.deepEqual(ids(doc("<a href=\"https://example.com/home/user/\">x</a> https://example.com/Users/x/")), []);
	assert.deepEqual(ids(doc("<p>file:///tmp/a.html and C:\\Users\\me</p>")), ["P2:error"]);
	assert.deepEqual(ids(doc("<img alt=\"\" src=\"data:image/png;base64,AAAA/Users/abc/BBBB\">")), [], "base64 never trips P2");
	assert.deepEqual(ids(doc("<p>http://localhost:3000/x and https://app.localhost</p>")), ["P3:warning"]);
	const island = comments => `<script type="application/json" data-vpk-review>${JSON.stringify({ schema: "vpk-review/1", comments })}</script>`;
	assert.deepEqual(ids(doc(island([{ id: "c1", body: "fix" }]))), ["P4:error"]);
	assert.deepEqual(ids(doc(island([{ id: "c1" }])), { includeReview: true }), ["P4:warning"]);
	assert.deepEqual(ids(doc(island([]))), [], "an empty comments array is clean");
	assert.deepEqual(ids(doc(`<script type="application/json" data-vpk-review-runtime>{"comments":[1]}</script>`)), [], "only the exact island name counts");
	assert.deepEqual(ids(doc(`<script type="application/json" data-vpk-review>{oops</script>`)), ["P4:error"]);
	assert.deepEqual(ids(doc("<p>[DATA NEEDED: owner] and [DATA NEEDED: date]</p>")), ["P5:warning"]);
	const sized = prepublishScan(doc(), { weightWarnings: (html, { label }) => [`${label} is 1.8 MB`], label: "doc.html" });
	assert.deepEqual(sized.map(item => item.id), ["P6"]);
	assert.match(sized[0].message, /^doc\.html is 1\.8 MB\. Artifacts and Pages load it normally; data: URL previews render it blank$/);
});

test("helpers: document meta, gist plans, gist output parsing, registry path", async () => {
	const { readDocumentMeta, planGistPublish, parseGistCreateOutput, gistRegistryPath } = await load();
	assert.deepEqual(readDocumentMeta(doc()), { title: "Q3 & Beyond — plan", description: "Plan & risks" });
	assert.deepEqual(readDocumentMeta("<html></html>"), { title: null, description: null });
	assert.deepEqual(planGistPublish({ file: "/a/x.html", title: "X" }).args, ["gist", "create", "/a/x.html", "--desc", "vpk-html: X"]);
	assert.deepEqual(planGistPublish({ file: "/a/x.html", title: "X", isPublic: true }).args.at(-1), "--public");
	const entry = { id: "abc", fileName: "x.html", public: false };
	assert.deepEqual(planGistPublish({ entry, file: "/a/x.html", title: "X" }), { mode: "update", entry, public: false, args: ["gist", "edit", "abc", "--filename", "x.html", "/a/x.html"] });
	assert.equal(planGistPublish({ entry, file: "/a/x.html", title: "X", forceNew: true }).mode, "create");
	assert.deepEqual(parseGistCreateOutput("- Creating gist x.html\n✓ Created secret gist x.html\nhttps://gist.github.com/me/0123abcd\n"), { url: "https://gist.github.com/me/0123abcd", id: "0123abcd" });
	assert.equal(parseGistCreateOutput("nothing"), null);
	assert.equal(gistRegistryPath({ VPK_GIST_REGISTRY: "/tmp/g.json" }), "/tmp/g.json");
	assert.equal(gistRegistryPath({}, "/home/me"), path.join("/home/me", ".config", "vpk", "gists.json"));
});

test("dry runs print the preflight, viewer check and plan, and never publish or write registries", async t => {
	const { runPublish, DRY_RUN_LINE, VIEWER_LINE } = await load();
	const { screenshotDirFor } = await import("./screenshot.mjs");
	const artifacts = world(t);
	assert.equal(await runPublish(args("artifacts", artifacts.file), artifacts.deps), 0, artifacts.errors.join("\n"));
	const out = artifacts.logs.join("\n");
	assert.match(out, /✓ publish preflight passed/);
	assert.match(out, /✓ Artifacts viewer check: rendered under sandbox="allow-scripts"/);
	assert.ok(out.includes(VIEWER_LINE));
	assert.match(out, /Plan: create Atlassian Artifact "Q3 & Beyond — plan" \(private\) from .*q3-plan\.html \(\d+ KB\)/);
	assert.ok(out.endsWith(DRY_RUN_LINE));
	assert.equal(artifacts.spawns.length, 1);
	assert.ok(artifacts.spawns[0].script.endsWith("verify-artifact-html.mjs"));
	const outFlag = artifacts.spawns[0].args[artifacts.spawns[0].args.indexOf("--out") + 1];
	assert.ok(path.isAbsolute(outFlag));
	assert.equal(outFlag, path.join(screenshotDirFor(artifacts.file, { repoRoot: artifacts.repoRoot }), "artifact-viewer.png"));
	assert.deepEqual(artifacts.execs, []);
	assert.deepEqual(artifacts.writes, []);

	const gist = world(t);
	assert.equal(await runPublish(args("gist", gist.file), gist.deps), 0);
	assert.match(gist.logs.join("\n"), /Plan: create secret gist "vpk-html: Q3 & Beyond — plan"/);
	assert.deepEqual([gist.spawns, gist.execs, gist.writes], [[], [], []]);
	const log = JSON.stringify([artifacts.spawns, artifacts.execs, gist.spawns, gist.execs]);
	assert.doesNotMatch(log, /gist (?:create|edit)|publish-artifact\.mjs|twg/);
});

test("updates are planned from the registries; access defaults differ for create and update", async t => {
	const { runPublish } = await load();
	const recorded = world(t, { artifactRegistry: { "q3-plan": { id: "art-1", name: "Old name" } } });
	assert.equal(await runPublish(args("artifacts", recorded.file, { name: "Q3" }), recorded.deps), 0);
	assert.match(recorded.logs.join("\n"), /Plan: update Atlassian Artifact "Q3" \(keeps current access\)/);
	const reshared = world(t, { artifactRegistry: { "q3-plan": { id: "art-1", name: "Old name" } } });
	assert.equal(await runPublish(args("artifacts", reshared.file, { access: "open" }), reshared.deps), 0);
	assert.match(reshared.logs.join("\n"), /Plan: update Atlassian Artifact "Q3 & Beyond — plan" \(open\)/);
	const forced = world(t, { artifactRegistry: { "q3-plan": { id: "art-1", name: "Old name" } } });
	assert.equal(await runPublish(args("artifacts", forced.file, { forceNew: true }), forced.deps), 0);
	assert.match(forced.logs.join("\n"), /Plan: create Atlassian Artifact .* \(private\)/);
	const updating = world(t, { gistRegistry: { "q3-plan": { id: "g1", url: "https://gist.github.com/me/g1", fileName: "q3-plan.html", public: false, createdAt: "2026-01-01T00:00:00.000Z" } } });
	assert.equal(await runPublish(args("gist", updating.file), updating.deps), 0);
	assert.match(updating.logs.join("\n"), /Plan: update gist g1 \(q3-plan\.html\)/);
	assert.deepEqual(updating.writes, []);
});

test("--confirm publishes through publish-artifact.mjs and gh, and records the gist", async t => {
	const { runPublish, GIST_NOTE } = await load();
	const artifacts = world(t);
	assert.equal(await runPublish(args("artifacts", artifacts.file, { confirm: true, access: "open", description: "Reviewed" }), artifacts.deps), 0);
	const publish = artifacts.spawns.find(call => call.script.endsWith("publish-artifact.mjs"));
	assert.deepEqual(publish.args, [artifacts.file, "--name", "Q3 & Beyond — plan", "--access", "open", "--description", "Reviewed"]);
	assert.deepEqual(publish.options, { stream: true });
	assert.match(artifacts.logs.join("\n"), /Artifact URL: https:\/\/hello\.atlassian\.net\/artifacts\/a1/);

	const gist = world(t);
	assert.equal(await runPublish(args("gist", gist.file, { confirm: true }), gist.deps), 0);
	assert.deepEqual(gist.execs, [["gh", "gist", "create", gist.file, "--desc", "vpk-html: Q3 & Beyond — plan"]]);
	const registry = JSON.parse(gist.store.get(gist.deps.env.VPK_GIST_REGISTRY));
	assert.deepEqual(registry["q3-plan"], { id: "abc123def", url: "https://gist.github.com/someone/abc123def", fileName: "q3-plan.html", file: gist.file, public: false, createdAt: "2026-10-11T12:00:00.000Z", updatedAt: "2026-10-11T12:00:00.000Z" });
	assert.ok(gist.logs.includes(GIST_NOTE));

	const explicit = world(t);
	assert.equal(await runPublish(args("gist", explicit.file, { confirm: true, visibilityExplicit: true, visibility: "public" }), explicit.deps), 0);
	assert.equal(explicit.execs[0].at(-1), "--public");

	const update = world(t);
	await runPublish(args("gist", update.file, { confirm: true }), update.deps);
	update.execs.length = 0;
	assert.equal(await runPublish(args("gist", update.file, { confirm: true }), update.deps), 0);
	assert.deepEqual(update.execs, [["gh", "gist", "edit", "abc123def", "--filename", "q3-plan.html", update.file]]);

	const failing = world(t, { gh: { code: 1, stdout: "", stderr: "HTTP 401: Bad credentials" } });
	failing.deps.env.GITHUB_TOKEN = "stale";
	assert.equal(await runPublish(args("gist", failing.file, { confirm: true }), failing.deps), 1);
	assert.match(failing.errors.join("\n"), /gh gist create failed: HTTP 401[\s\S]*GITHUB_TOKEN env var overrides stored gh auth/);
	assert.equal(failing.store.has(failing.deps.env.VPK_GIST_REGISTRY), false);
});

test("exit codes: 2 for usage, 1 for preflight errors, viewer errors and missing repo scripts", async t => {
	const { runPublish } = await load();
	const base = world(t);
	assert.equal(await runPublish(args("github", base.file), base.deps), 2);
	assert.match(base.errors.at(-1), /use --github <file>/);
	assert.equal(await runPublish(args("dropbox", base.file), base.deps), 2);
	assert.equal(await runPublish(args("gist", path.join(base.dir, "nope.html")), base.deps), 2);
	assert.equal(await runPublish(args("artifacts", base.file, { access: "public" }), base.deps), 2);

	const leaky = world(t, { html: doc(`<p>${TOKEN()}</p>`) });
	assert.equal(await runPublish(args("gist", leaky.file, { confirm: true }), leaky.deps), 1);
	assert.match(leaky.logs.join("\n"), /✗ P1 secret: GitHub token[\s\S]*✗ publish preflight: 1 error/);
	assert.deepEqual(leaky.execs, []);

	const broken = world(t, { viewerReport: { blockedRequests: ["https://cdn.example/x.js"], missingAssets: [], pageErrors: ["boom"], rendered: { elements: 3 } } });
	assert.equal(await runPublish(args("artifacts", broken.file), broken.deps), 1);
	assert.match(broken.logs.join("\n"), /⚠ viewer CSP blocks https:\/\/cdn\.example\/x\.js/);
	assert.match(broken.errors.join("\n"), /page error in the viewer: boom/);

	const noViewer = world(t, { viewerStdout: "browserType.launch: Target page, context or browser has been closed" });
	assert.equal(await runPublish(args("artifacts", noViewer.file), noViewer.deps), 0, "a dry run warns when the viewer check cannot run");
	assert.match(noViewer.logs.join("\n"), /⚠ Artifacts viewer check did not run/);
	assert.equal(await runPublish(args("artifacts", noViewer.file, { confirm: true }), noViewer.deps), 1, "a confirmed run requires it");

	const standalone = world(t, { scripts: false });
	assert.equal(await runPublish(args("artifacts", standalone.file), standalone.deps), 1);
	assert.match(standalone.logs.join("\n"), /Equivalent command: twg --env prod artifacts file create .*q3-plan\.html --name "Q3 & Beyond — plan" --description "Plan & risks" --access private -o json/);
	assert.match(standalone.errors.join("\n"), /publish-artifact\.mjs not found; run the printed twg command or follow the MCP flow in references\/publish\.md/);
	assert.deepEqual(standalone.spawns, []);
});

test("runPreflight awaits checkContent and the standard checks; --github skips the checks it already ran", async t => {
	const { runPreflight, formatPreflight } = await load();
	const { file, deps } = world(t);
	const delayed = { ...deps, checkContent: async () => { await new Promise(resolve => setTimeout(resolve, 20)); return { findings: [{ rule: "content.coverage", severity: "error", path: "content.facts[0].value", message: "\"14\" does not appear in the HTML" }, { rule: "content.contract", severity: "info", path: "sidecar", message: "no sidecar" }] }; } };
	const result = await runPreflight(file, {}, delayed);
	assert.equal(result.ok, false);
	assert.deepEqual(result.findings.map(item => item.rule), ["content"]);
	assert.deepEqual(result.skipped, ["placeholders", "verify", "check-html"]);
	assert.match(formatPreflight(result), /^✗ content: content\.coverage content\.facts\[0\]\.value: "14" does not appear in the HTML$/m);

	const seen = [];
	const standard = {
		...deps,
		checkPlaceholders: target => { seen.push(["placeholders", target]); return { ok: false, count: 2 }; },
		verify: async target => { seen.push(["verify", target]); return { ok: false, issues: ["font \"Geist\" did not load"] }; },
		validateHtmlFile: target => { seen.push(["check-html", target]); return { ok: true, failures: [] }; },
	};
	const checked = await runPreflight(file, { target: "gist" }, standard);
	assert.deepEqual(seen.map(([name]) => name), ["placeholders", "verify", "check-html"]);
	assert.deepEqual(checked.findings.map(item => `${item.rule}:${item.message}`), ["placeholders:2 unfilled placeholders", "verify:font \"Geist\" did not load"]);
	seen.length = 0;
	const github = await runPreflight(file, { target: "github" }, standard);
	assert.deepEqual(seen, [], "--github ran the standard checks itself");
	assert.equal(github.ok, true);
	const throwing = await runPreflight(file, {}, { ...deps, checkContent: async () => { throw new Error("file not found: x"); } });
	assert.match(formatPreflight(throwing), /✗ content: file not found: x/);
	const sizeless = await runPreflight(file, {}, { ...deps, weightWarnings: async () => { throw Object.assign(new Error("missing"), { code: "ERR_MODULE_NOT_FOUND" }); } });
	assert.match(formatPreflight(sizeless), /⚠ P6 size: size budget unavailable \(ERR_MODULE_NOT_FOUND\)/);
});

test("the review CLI never mistakes --include-review for a review command", { skip: !fs.existsSync(REVIEW_CLI) && "review/cli.mjs lands with ws1 M1" }, async () => {
	const { isReviewCommand } = await import(REVIEW_CLI);
	assert.equal(isReviewCommand(["--publish", "gist", "x.html", "--include-review"]), false);
});
