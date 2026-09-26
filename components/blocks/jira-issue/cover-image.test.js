const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const ISSUE_SOURCE = readFileSync(join(__dirname, "index.tsx"), "utf8");
const SUMMARY_SOURCE = readFileSync(join(__dirname, "summary.tsx"), "utf8");
const COVER_SOURCE = readFileSync(join(__dirname, "cover-image.tsx"), "utf8");

test("optional covers stay inside the issue content and leave the card in charge of dragging", () => {
	assert.match(ISSUE_SOURCE, /coverImage\?: JiraIssueCoverImage;/u);
	assert.match(ISSUE_SOURCE, /coverImage=\{coverImage\}/u);
	assert.match(SUMMARY_SOURCE, /coverImage \? \([\s\S]*?<JiraIssueCover image=\{coverImage\} \/>[\s\S]*?\) : null/u);
	assert.match(COVER_SOURCE, /import Image from "next\/image"/u);
	assert.match(COVER_SOURCE, /cn\("relative aspect-video w-full overflow-hidden rounded-t-lg", image\.backgroundClassName\)/u);
	assert.match(COVER_SOURCE, /className="object-contain"/u);
	assert.match(COVER_SOURCE, /maxHeight: image\.maxHeight/u);
	assert.match(COVER_SOURCE, /alt=\{image\.alt\}/u);
	assert.match(COVER_SOURCE, /draggable=\{false\}/u);
	assert.match(COVER_SOURCE, /fill\s+sizes=/u);
});

test("solid covers are decorative and image covers retain their image and alt text", async () => {
	const result = await esbuild.build({
		entryPoints: [join(__dirname, "cover-image.tsx")],
		bundle: true,
		format: "cjs",
		platform: "node",
		external: ["react", "react/*", "next/image"],
		tsconfig: join(process.cwd(), "tsconfig.json"),
		write: false,
	});
	const { JiraIssueCover } = loadCjsModuleFromText(result.outputFiles[0].text);
	const solid = renderToStaticMarkup(React.createElement(JiraIssueCover, {
		image: { backgroundClassName: "bg-blue-200", maxHeight: 120 },
	}));
	assert.match(solid, /bg-blue-200/u);
	assert.match(solid, /aria-hidden="true"/u);
	assert.match(solid, /max-height:120px/u);
	assert.doesNotMatch(solid, /<img/u);

	const image = renderToStaticMarkup(React.createElement(JiraIssueCover, {
		image: { src: "/illustration-ai/code/light.svg", alt: "Code illustration", maxHeight: 120 },
	}));
	assert.match(image, /<img/u);
	assert.match(image, /alt="Code illustration"/u);
	assert.match(image, /src="\/illustration-ai\/code\/light.svg"/u);
	assert.doesNotMatch(image, /aria-hidden="true"/u);
});
