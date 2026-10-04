import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTwgResult, planPublish, registryPath, slugForFile } from "./publish-artifact.mjs";

const ENTRY = { id: "ab6ac8ca", name: "Awake" };

test("slugForFile uses the file name without extension", () => {
	assert.equal(slugForFile("output/artifact-html/awake/awake.html"), "awake");
	assert.equal(slugForFile("/repo/artifacts/vpk-html/brief/brief.html"), "brief");
	assert.equal(slugForFile("report.csv"), "report");
});

test("planPublish updates a recorded slug and keeps its name", () => {
	const plan = planPublish({ entry: ENTRY, file: "awake.html" });
	assert.equal(plan.mode, "update");
	assert.deepEqual(plan.args, ["--env", "prod", "artifacts", "file", "update", "ab6ac8ca", "awake.html", "--name", "Awake", "-o", "json"]);
});

test("planPublish creates private artifacts by default and honours --new, --access, and --description", () => {
	const created = planPublish({ file: "out/report.html" });
	assert.equal(created.mode, "create");
	assert.deepEqual(created.args.slice(2), ["artifacts", "file", "create", "out/report.html", "--name", "report.html", "--access", "private", "-o", "json"]);

	const forced = planPublish({ access: "shared", description: "Q3", entry: ENTRY, file: "awake.html", forceNew: true, name: "Awake 2" });
	assert.equal(forced.mode, "create");
	assert.deepEqual(forced.args.slice(2, -2), ["artifacts", "file", "create", "awake.html", "--name", "Awake 2", "--access", "shared", "--description", "Q3"]);

	assert.ok(planPublish({ access: "open", entry: ENTRY, file: "awake.html" }).args.includes("open"));
	assert.throws(() => planPublish({ access: "public", file: "x.html" }), /--access/u);
});

test("parseTwgResult skips warning preambles and drops the signed raw-file URL", () => {
	const stdout = `OAuth refresh is due\n{"ok": true, "data": {"id": "ab6", "name": "Awake", "type": "text/html", "url": "https://object-store.example/binary?authToken=secret", "artifactUrl": "https://hello.atlassian.net/artifacts/ab6"}}`;
	const artifact = parseTwgResult(stdout);
	assert.deepEqual(artifact, { artifactUrl: "https://hello.atlassian.net/artifacts/ab6", id: "ab6", name: "Awake", type: "text/html" });
	assert.equal(JSON.stringify(artifact).includes("authToken"), false);
});

test("parseTwgResult surfaces twg errors with a login hint for auth failures", () => {
	assert.throws(
		() => parseTwgResult(`{"ok": false, "error": {"message": "Access blocked: Site is not in the Atlassian organization associated with your OAuth token."}}`),
		/twg --env prod login --site hello/u,
	);
	assert.throws(() => parseTwgResult("no json here"), /no JSON/u);
});

test("registryPath defaults to ~/.config/vpk and honours VPK_ARTIFACT_REGISTRY", () => {
	assert.match(registryPath({}), /\.config\/vpk\/artifacts\.json$/u);
	assert.equal(registryPath({ VPK_ARTIFACT_REGISTRY: "/tmp/registry.json" }), "/tmp/registry.json");
});
