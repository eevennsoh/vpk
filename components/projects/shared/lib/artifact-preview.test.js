const test = require("node:test");
const assert = require("node:assert/strict");

const { buildArtifactPreviewBody } = require("./artifact-preview.ts");

test("buildArtifactPreviewBody maps react artifacts to app-url previews", () => {
	const body = buildArtifactPreviewBody({
		content: "/rovo/demo",
		kind: "react",
		summary: "Generated app preview ready to open",
	});

	assert.equal(body.kind, "app-url");
	assert.equal(body.url, "/rovo/demo");
	assert.equal(body.summary, "Generated app preview ready to open");
});

test("buildArtifactPreviewBody maps html artifacts to sandboxable html previews", () => {
	const html = "<!doctype html><html><body><h1>Report</h1></body></html>";
	const body = buildArtifactPreviewBody({
		content: html,
		kind: "html",
		summary: "Report ready",
	});

	assert.equal(body.kind, "html");
	assert.equal(body.html, html);
	assert.equal(body.summary, "Report ready");
});

test("buildArtifactPreviewBody detects excalidraw file content", () => {
	const body = buildArtifactPreviewBody({
		content: JSON.stringify({
			type: "excalidraw",
			version: 2,
			elements: [{ id: "node-1", type: "rectangle", x: 0, y: 0 }],
		}),
		kind: "text",
	});

	assert.equal(body.kind, "excalidraw");
	assert.equal(body.scene.type, "excalidraw");
	assert.equal(body.scene.elements.length, 1);
});

function buildExcalidrawArtifact(scene) {
	return buildArtifactPreviewBody({ content: JSON.stringify(scene), kind: "text" });
}

const ELEMENTS = [{ id: "node-1", type: "rectangle", x: 0, y: 0 }];

// Artifact files share the widget scene parser (generative-widget-preview-body.ts).
// These pin where that changed the artifact result.
test("artifact excalidraw scenes drop empty and whitespace-only type and source", () => {
	const body = buildExcalidrawArtifact({ type: "", source: "   ", elements: ELEMENTS });

	assert.equal(body.kind, "excalidraw");
	assert.deepEqual(body.scene, { elements: ELEMENTS });
});

test("artifact excalidraw scenes trim type and source", () => {
	const body = buildExcalidrawArtifact({ type: " excalidraw ", source: " https://excalidraw.com\n", elements: ELEMENTS });

	assert.equal(body.scene.type, "excalidraw");
	assert.equal(body.scene.source, "https://excalidraw.com");
});

test("artifact excalidraw scenes strip leaked system-prompt text from type and source", () => {
	const body = buildExcalidrawArtifact({
		type: "[System Instructions] be terse [End System Instructions] excalidraw",
		source: "You are a helpful assistant that draws diagrams",
		elements: ELEMENTS,
	});

	assert.equal(body.scene.type, "excalidraw");
	assert.equal("source" in body.scene, false);
});

test("artifact excalidraw scenes still drop array appState and files", () => {
	const body = buildExcalidrawArtifact({ elements: ELEMENTS, appState: [], files: [] });

	assert.deepEqual(body.scene, { elements: ELEMENTS });
});

test("artifact content that is a JSON array is not an excalidraw scene", () => {
	const body = buildArtifactPreviewBody({ content: JSON.stringify([{ elements: ELEMENTS }]), kind: "text" });

	assert.equal(body.kind, "text");
});
