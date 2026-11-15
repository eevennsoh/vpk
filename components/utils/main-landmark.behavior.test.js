// Embedded previews (home and catalog card iframes) must not add a second main landmark to the
// host page: axe merges frames and reports landmark-unique / landmark-no-duplicate-main.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

async function renderMainLandmark(pathname) {
	await renderComponent({
		entry: "components/utils/main-landmark.tsx",
		exportName: "MainLandmark",
		mocks: { "next/navigation": `export const usePathname = () => ${JSON.stringify(pathname)};` },
		props: { children: "Page body" },
	});
	const target = document.getElementById("main-content");
	return {
		landmarks: document.querySelectorAll("main, [role=main]").length,
		targetTag: target?.tagName.toLowerCase() ?? null,
		targetText: target?.textContent ?? null,
	};
}

test.afterEach(() => {
	delete document.documentElement.dataset.embedded;
});

test("a top-level page renders one native main as the skip-link target", async () => {
	assert.deepEqual(await renderMainLandmark("/arts"), { landmarks: 1, targetTag: "main", targetText: "Page body" });
});

test("a preview opened top-level keeps one native main", async () => {
	assert.deepEqual(
		await renderMainLandmark("/preview/projects/butter-v1"),
		{ landmarks: 1, targetTag: "main", targetText: "Page body" },
	);
});

test("an embedded preview renders its content without a main landmark", async () => {
	document.documentElement.dataset.embedded = "";
	assert.deepEqual(
		await renderMainLandmark("/preview/projects/butter-v1"),
		{ landmarks: 0, targetTag: "div", targetText: "Page body" },
	);
});
