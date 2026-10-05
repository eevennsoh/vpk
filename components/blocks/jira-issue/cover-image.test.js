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
	assert.match(COVER_SOURCE, /relative aspect-video w-full overflow-hidden rounded-t-lg/u);
	assert.match(COVER_SOURCE, /maxHeight: image\.maxHeight/u);
	assert.match(COVER_SOURCE, /alt=\{image\.alt\}/u);
	assert.match(COVER_SOURCE, /draggable=\{false\}/u);
	assert.match(COVER_SOURCE, /fill\s+sizes=/u);
});

test("solid covers are decorative while image and typographic covers remain accessible", async () => {
	const result = await esbuild.build({
		entryPoints: [join(__dirname, "cover-image.tsx")],
		bundle: true,
		format: "cjs",
		platform: "node",
		external: ["react", "react/*", "next/image"],
		loader: { ".css": "empty" },
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

	const textCover = renderToStaticMarkup(React.createElement(JiraIssueCover, {
		image: { heading: "Code", subheading: "Context from your codebase", maxHeight: 144 },
	}));
	assert.match(textCover, /data-slot="jira-issue-cover-heading">Code<\/p>/u);
	assert.match(textCover, /data-slot="jira-issue-cover-subheading">Context from your codebase<\/p>/u);
	assert.match(textCover, /font-sans text-xl font-normal/u);
	assert.match(textCover, /font-normal capitalize/u);
	assert.doesNotMatch(textCover, /clamp\(/u);
	assert.match(textCover, /max-height:144px/u);
	assert.doesNotMatch(textCover, /aria-hidden="true"|<img/u);
	assert.doesNotMatch(textCover, /radial-gradient/u);

	for (const heading of [
		"Whiteboard → Figma → Loom",
		"Enterprise governance & Guard",
		"DX: session quality & ROI",
	]) {
		const headingOnlyCover = renderToStaticMarkup(React.createElement(JiraIssueCover, {
			image: { heading, maxHeight: 144 },
		}));
		assert.ok(headingOnlyCover.includes(`data-slot="jira-issue-cover-heading">${heading.replaceAll("&", "&amp;")}</p>`));
		assert.match(headingOnlyCover, /whitespace-pre-line/u);
		assert.match(headingOnlyCover, /font-sans text-xl font-normal/u);
		assert.doesNotMatch(headingOnlyCover, /jira-issue-cover-subheading|aria-hidden="true"|<img|line-clamp|truncate/u);
	}
	const twoLineCover = renderToStaticMarkup(React.createElement(JiraIssueCover, {
		image: { heading: "Desktop\nsearch & chat", maxHeight: 144 },
	}));
	assert.match(twoLineCover, /data-slot="jira-issue-cover-heading">Desktop\nsearch &amp; chat<\/p>/u);

	const gridCover = renderToStaticMarkup(React.createElement(JiraIssueCover, {
		image: { heading: "Code", subheading: "Context from your codebase", maxHeight: 144, backgroundPattern: "grid" },
	}));
	assert.match(gridCover, /stroke-dasharray%3D%221%203%22/u);
	assert.match(gridCover, /preserveAspectRatio%3D%22none%22/u);
	assert.match(gridCover, /mask-size:32px 32px/u);
	assert.match(gridCover, /M%200%2016%20H%2032%20M%2016%200%20V%2032/u);
	assert.match(gridCover, /mask-position:center 8px/u);
	assert.match(gridCover, /mask-repeat:repeat/u);
	assert.match(gridCover, /aria-hidden="true"[^>]*data-slot="jira-issue-cover-pattern"/u);
	assert.match(gridCover, /mask-image:linear-gradient\(to bottom, black 0, black calc\(100% - var\(--scroll-mask-fade-size\)\), transparent 100%\)/u);
	assert.doesNotMatch(gridCover, /<img|radial-gradient/u);
});

test("image covers expose their artwork and selected app logos without typographic cover copy", async () => {
	const { accessibleName, renderComponent } = require(process.cwd() + "/scripts/lib/render-component.js");
	const artwork = { src: "/illustration-ai/code/light.svg", alt: "Code context preview", maxHeight: 140 };
	const view = await renderComponent({
		source: `
			import { JiraIssueCover } from "@/components/blocks/jira-issue/cover-image";
			import { ThemeWrapper } from "@/components/utils/theme-wrapper";
			export default function Cover({ image }) {
				return <ThemeWrapper><JiraIssueCover image={image} /></ThemeWrapper>;
			}
		`,
		props: {
			image: { ...artwork, appSources: [{ id: "loom", label: "Loom", provider: "loom" }] },
		},
	});
	assert.deepEqual(view.getAllByRole("img").map(accessibleName), ["Loom", "Code context preview"]);
	assert.equal(view.container.querySelector('[data-slot="jira-issue-cover-app-stack"]').children.length, 1);
	assert.equal(view.getByRole("img", { name: "Code context preview" }).getAttribute("src"), artwork.src);
	assert.equal(view.getByRole("img", { name: "Code context preview" }).className, "object-contain");
	assert.equal(view.container.querySelector('[data-slot="jira-issue-cover-heading"]') === null, true);
	assert.equal(view.container.querySelector('[data-slot="jira-issue-cover-subheading"]') === null, true);

	await view.rerender({
		image: {
			...artwork,
			fit: "cover",
			mask: { src: "/illustration/jira-team-eu26-end/app-stack-mask.svg", backgroundColor: "#f8f8f8" },
			appSources: [
				{ id: "jira", label: "Jira", provider: "jira" },
				{ id: "confluence", label: "Confluence", provider: "confluence" },
				{ id: "teamwork-graph", label: "Teamwork Graph", provider: "teamwork-graph" },
			],
		},
	});
	assert.deepEqual(view.getAllByRole("img").map(accessibleName), ["Jira", "Confluence", "Teamwork Graph", "Code context preview"]);
	assert.deepEqual([...view.container.querySelector('[data-slot="jira-issue-cover-app-stack"]').children].map((item) => item.style.transform), ["rotate(0deg)", "rotate(6deg)", "rotate(0deg)"]);
	assert.equal(view.getByRole("img", { name: "Code context preview" }).className, "object-cover");
	assert.equal(view.getByRole("img", { name: "Code context preview" }).style.maskMode, "luminance");
	assert.equal(view.getByRole("img", { name: "Code context preview" }).style.maskSize, "cover");
	assert.equal(view.queryByRole("img", { name: "Loom" }) === null, true);

	await view.rerender({ image: artwork });
	assert.deepEqual(view.getAllByRole("img").map(accessibleName), ["Code context preview"]);
	assert.equal(view.getByRole("img", { name: "Code context preview" }).className, "object-contain");
	assert.equal(view.getByRole("img", { name: "Code context preview" }).style.maskImage, "");
	assert.equal(view.container.querySelector('[data-slot="jira-issue-cover-apps"]') === null, true);
});
