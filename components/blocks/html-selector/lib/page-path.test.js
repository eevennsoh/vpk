const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");

const { loadCjsModuleFromText } = require(
	path.join(process.cwd(), "scripts", "lib", "esbuild-cjs-loader.js"),
);

function loadTs(file) {
	return esbuild
		.build({
			entryPoints: [path.join(process.cwd(), file)],
			bundle: true,
			format: "cjs",
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			write: false,
		})
		.then((result) => loadCjsModuleFromText(result.outputFiles[0].text));
}

let pagePathPromise;
const loadPagePath = () => (pagePathPromise ??= loadTs("components/blocks/html-selector/lib/page-path.ts"));

test("T-PP1 local pages map to their repo-relative disk path", async () => {
	const { getDiskPathForPage, normalizeVpkHtmlPagePath } = await loadPagePath();
	const { getVpkHtmlArtifactDiskPath } = await loadTs("components/blocks/html-selector/lib/artifact-actions.ts");
	assert.equal(getDiskPathForPage("local/artifacts/vpk-html/a/a.html"), "artifacts/vpk-html/a/a.html");
	assert.equal(getDiskPathForPage("local/output/vpk-html-v2/eu26-spike/x.html"), "output/vpk-html-v2/eu26-spike/x.html");
	assert.equal(getDiskPathForPage("local/elsewhere/x.html"), undefined, "a disallowed local path has no disk path");
	assert.equal(getDiskPathForPage("assets/demos/demo.html"), ".agents/skills/vpk-html/assets/demos/demo.html");
	assert.equal(getDiskPathForPage("srcdoc"), undefined);
	assert.equal(normalizeVpkHtmlPagePath("/api/vpk-html/local/output/vpk-html-v2/a%20b.html"), "local/output/vpk-html-v2/a b.html");
	assert.equal(getVpkHtmlArtifactDiskPath("local/artifacts/vpk-html/a/a.html"), "artifacts/vpk-html/a/a.html");
	assert.equal(getVpkHtmlArtifactDiskPath("local/artifacts/vpk-html/a/a.html", "/repo/"), "/repo/artifacts/vpk-html/a/a.html");
	assert.equal(getVpkHtmlArtifactDiskPath("assets/demos/d.html"), ".agents/skills/vpk-html/assets/demos/d.html");
});

test("T-PP2 resolveHtmlPageSrc accepts demos and allowed local paths only", async () => {
	const { resolveHtmlPageSrc } = await loadPagePath();
	const index = "/api/vpk-html/index.html";
	assert.equal(resolveHtmlPageSrc("assets/demos/demo-review-loop.html"), "/api/vpk-html/assets/demos/demo-review-loop.html");
	assert.equal(resolveHtmlPageSrc("local/output/vpk-html-v2/eu26-spike/jira-team-eu26-end-case-study.html", { allowLocal: true }), "/api/vpk-html/local/output/vpk-html-v2/eu26-spike/jira-team-eu26-end-case-study.html");
	assert.equal(resolveHtmlPageSrc("local/artifacts/vpk-html/a/a.html", { allowLocal: false }), index, "local pages need allowLocal");
	for (const bad of [
		null,
		"",
		"assets/demos/../SKILL.md",
		"assets/templates/one-pager.html",
		"local/artifacts/vpk-html/../../.env",
		"local/artifacts/vpk-html/a/_src/body.html",
		"local/artifacts/other/a.html",
		"local/output/vpk-html/a.txt",
		"local/output/notvpk/a.html",
		"https://example.com/a.html",
	]) {
		assert.equal(resolveHtmlPageSrc(bad, { allowLocal: true }), index, String(bad));
	}
});

test("T-PP3 isLocalArtifactPage", async () => {
	const { isLocalArtifactPage } = await loadPagePath();
	assert.equal(isLocalArtifactPage("local/artifacts/vpk-html/a/a.html"), true);
	assert.equal(isLocalArtifactPage("local/output/vpk-html-host-spec/review-local.html"), true);
	assert.equal(isLocalArtifactPage("assets/demos/a.html"), false);
	assert.equal(isLocalArtifactPage("local/.env"), false);
	assert.equal(isLocalArtifactPage("srcdoc"), false);
});
