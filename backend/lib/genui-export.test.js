const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { exportSpec, EXPORT_FORMATS } = require("./genui-export");

const sampleSpec = {
	root: "root",
	state: { userName: "Alice", accepted: true },
	elements: {
		root: { type: "Stack", props: { direction: "vertical", gap: "md" }, children: ["heading", "text", "badge", "input", "sep", "btn"] },
		heading: { type: "Heading", props: { text: "Dashboard", level: "h1" } },
		text: { type: "Text", props: { content: "Welcome to the dashboard.", muted: true } },
		badge: { type: "Badge", props: { text: "New", variant: "success" } },
		input: { type: "TextInput", props: { label: "Your name", value: { $bindState: "/userName" } } },
		sep: { type: "Separator", props: { orientation: "horizontal" } },
		btn: { type: "Button", props: { label: "Submit", variant: "default" } },
	},
};

// The renderer/font stand-ins are internal dependency seams, never options in
// the caller's export interface. Their returned bytes expose the document the
// real export owner passes to PDF/Image rendering without loading fonts/network.
function loadExportWithRenderers({ pdf, png } = {}) {
	const filename = path.join(__dirname, "genui-export.js");
	const loaded = new Module(filename, module);
	loaded.filename = filename;
	loaded.paths = Module._nodeModulePaths(__dirname);
	const requireDependency = loaded.require.bind(loaded);
	loaded.require = (specifier) => {
		if (specifier === "@json-render/react-pdf") return {
			renderToBuffer: pdf ?? (async (spec) => Buffer.from(JSON.stringify(spec))),
		};
		if (specifier === "@json-render/image") return {
			renderToPng: png ?? (async (spec, options) => Buffer.from(JSON.stringify({ spec, options }))),
		};
		if (specifier === "./genui-export-fonts") return { loadFonts: async () => [{ name: "Local test font" }] };
		return requireDependency(specifier);
	};
	loaded._compile(fs.readFileSync(filename, "utf8"), filename);
	return loaded.exports.exportSpec;
}

function parseDocument(result) {
	return JSON.parse(result.data.toString("utf8"));
}

test("exportSpec is the download interface for the three supported formats", async () => {
	assert.deepEqual(EXPORT_FORMATS, ["pdf", "png", "react-code"]);
	const result = await exportSpec(sampleSpec, "react-code", { title: "test", componentName: "MyDashboard" });
	assert.equal(result.contentType, "text/plain; charset=utf-8");
	assert.equal(result.filename, "test.tsx");
	assert.equal(Buffer.isBuffer(result.data), true);
	const code = result.data.toString("utf8");
	assert.equal(code.startsWith('"use client";'), true);
	assert.equal(code.includes("export function MyDashboard()"), true);
	assert.equal(code.includes("<Heading text=\"Dashboard\" level=\"h1\" />"), true);
	assert.equal(code.includes("$bindState"), false);
	assert.equal(code.includes("TODO"), false);
});

test("code download preserves serialization, child order, default name and omitted dynamic props", async () => {
	const result = await exportSpec({
		root: "root", state: { count: 2 },
		elements: {
			root: { type: "Stack", props: { direction: "vertical" }, children: ["first", "missing", "second"] },
			first: { type: "Text", props: { content: "First", muted: true, absent: null, value: { $state: "/count" } } },
			second: { type: "Button", props: { label: "Second", data: { count: 2 }, enabled: false } },
		},
	}, "react-code");
	const code = result.data.toString("utf8");
	assert.equal(result.filename, "export.tsx");
	assert.equal(code.includes("export function GeneratedUI()"), true);
	assert.equal(code.indexOf("First") < code.indexOf("Second"), true);
	assert.equal(code.includes("absent="), false);
	assert.equal(code.includes("$state"), false);
	assert.equal(code.includes("enabled={false}"), true);
	assert.equal(code.includes("muted"), true);
	assert.equal(code.includes("data={{ count: 2 }}"), true);
});

test("download filenames sanitize and bound titles consistently across formats", async () => {
	const exportWithRenderers = loadExportWithRenderers();
	for (const [format, extension] of [["pdf", "pdf"], ["png", "png"], ["react-code", "tsx"]]) {
		const result = await exportWithRenderers(sampleSpec, format, { title: "My Report: Q4/2025!" });
		assert.equal(result.filename, `My_Report__Q4_2025_.${extension}`);
		const longTitle = await exportWithRenderers(sampleSpec, format, { title: "a".repeat(80) });
		assert.equal(longTitle.filename, `${"a".repeat(60)}.${extension}`);
		const emptyTitle = await exportWithRenderers(sampleSpec, format, { title: "" });
		assert.equal(emptyTitle.filename, `export.${extension}`);
	}
});

test("PDF download wraps content in a document/page and resolves external state", async () => {
	const result = await loadExportWithRenderers()(sampleSpec, "pdf", { state: { userName: "Bob" } });
	assert.equal(result.contentType, "application/pdf");
	assert.equal(result.filename, "export.pdf");
	const document = parseDocument(result);
	const root = document.elements[document.root];
	assert.equal(root.type, "Document");
	const page = document.elements[root.children[0]];
	assert.equal(page.type, "Page");
	assert.equal(page.props.size, "A4");
	assert.equal(document.elements.input.type, "Text");
	assert.equal(document.elements.input.props.text, "Your name: Bob");
	assert.equal(document.elements.heading.props.text, "Dashboard");
});

test("PNG download passes a bounded frame, state and local fonts to its renderer", async () => {
	const result = await loadExportWithRenderers()(sampleSpec, "png");
	assert.equal(result.contentType, "image/png");
	assert.equal(result.filename, "export.png");
	const { spec, options } = parseDocument(result);
	assert.equal(spec.elements[spec.root].type, "Frame");
	assert.equal(spec.elements[spec.root].props.width, 1200);
	assert.equal(spec.elements[spec.root].props.height, 470);
	assert.equal(spec.elements.input.props.text, "Your name: Alice");
	assert.deepEqual(options.fonts, [{ name: "Local test font" }]);
});

test("PDF and PNG downloads use chart placeholders and prune dropped 3D descendants", async () => {
	const spec = {
		root: "root",
		elements: {
			root: { type: "Stack", children: ["chart", "scene"] },
			chart: { type: "BarChart", props: { title: "Revenue by Region" } },
			scene: { type: "Scene3D", children: ["box"] },
			box: { type: "Box", props: { size: [1, 1, 1] } },
		},
	};
	for (const format of ["pdf", "png"]) {
		const output = parseDocument(await loadExportWithRenderers()(spec, format));
		const mapped = format === "png" ? output.spec : output;
		assert.deepEqual(mapped.elements.root.children, ["chart"]);
		assert.equal(mapped.elements.chart.props.text, "[Revenue by Region]");
		assert.equal(Object.hasOwn(mapped.elements, "scene"), false);
		assert.equal(Object.hasOwn(mapped.elements, "box"), false);
	}
});

test("a dropped export root wraps surviving top-level content once", async () => {
	const result = await loadExportWithRenderers()({
		root: "scene",
		elements: {
			scene: { type: "Scene3D", children: ["heading"] },
			heading: { type: "Stack", children: ["detail"] },
			detail: { type: "Text", props: { content: "Detail" } },
			loose: { type: "Text", props: { content: "Loose" } },
		},
	}, "pdf");
	const document = parseDocument(result);
	const root = document.elements[document.root];
	const page = document.elements[root.children[0]];
	assert.deepEqual(document.elements[page.children[0]].children, ["heading", "loose"]);
});

test("renderer bytes and renderer failures are preserved through exportSpec", async () => {
	const bytes = Buffer.from([0, 1, 2, 255]);
	for (const format of ["pdf", "png"]) {
		const success = loadExportWithRenderers({ pdf: async () => bytes, png: async () => bytes });
		assert.deepEqual((await success(sampleSpec, format)).data, bytes);
		const failure = new Error(`${format} rendering failed`);
		const fail = async () => { throw failure; };
		await assert.rejects(loadExportWithRenderers({ pdf: fail, png: fail })(sampleSpec, format), (error) => error === failure);
	}
});

test("unsupported export formats retain the caller-visible diagnostic", async () => {
	await assert.rejects(exportSpec(sampleSpec, "docx"), {
		message: "Unsupported export format: docx. Supported: pdf, png, react-code",
	});
});
