// Embedded previews (home and catalog card iframes) must not add a second main landmark to the
// host page: axe merges frames and reports landmark-unique / landmark-no-duplicate-main.
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const React = require("react");

const { renderComponent } = require(path.join(process.cwd(), "scripts/lib/render-component.js"));

let mounts = 0;
function MountCounter() {
	React.useEffect(() => {
		mounts += 1;
	}, []);
	return "Page body";
}

async function renderMainLandmark(pathname, { hydrate = false } = {}) {
	mounts = 0;
	const view = await renderComponent({
		entry: "components/utils/main-landmark.tsx",
		exportName: "MainLandmark",
		hydrate,
		mocks: { "next/navigation": `export const usePathname = () => ${JSON.stringify(pathname)};` },
		props: { children: React.createElement(MountCounter) },
	});
	const target = document.getElementById("main-content");
	return {
		landmarks: document.querySelectorAll("main, [role=main]").length,
		mounts,
		serverTag: view.serverHtml?.match(/^<(\w+)/u)?.[1] ?? null,
		targetTag: target?.tagName.toLowerCase() ?? null,
		targetText: target?.textContent ?? null,
	};
}

test.afterEach(() => {
	delete document.documentElement.dataset.embedded;
});

test("a top-level page renders one native main as the skip-link target", async () => {
	assert.deepEqual(
		await renderMainLandmark("/arts"),
		{ landmarks: 1, mounts: 1, serverTag: null, targetTag: "main", targetText: "Page body" },
	);
});

test("a preview opened top-level keeps one native main", async () => {
	assert.deepEqual(
		await renderMainLandmark("/preview/projects/butter-v1"),
		{ landmarks: 1, mounts: 1, serverTag: null, targetTag: "main", targetText: "Page body" },
	);
});

test("an embedded preview renders its content without a main landmark", async () => {
	document.documentElement.dataset.embedded = "";
	assert.deepEqual(
		await renderMainLandmark("/preview/projects/butter-v1"),
		{ landmarks: 0, mounts: 1, serverTag: null, targetTag: "div", targetText: "Page body" },
	);
});

test("the static export renders non-preview routes as main and hydrates them without a remount", async () => {
	assert.deepEqual(
		await renderMainLandmark("/arts", { hydrate: true }),
		{ landmarks: 1, mounts: 1, serverTag: "main", targetTag: "main", targetText: "Page body" },
	);
});

test("an embedded preview hydrates the exported wrapper without a mismatch or remount", async () => {
	document.documentElement.dataset.embedded = "";
	assert.deepEqual(
		await renderMainLandmark("/preview/projects/butter-v1", { hydrate: true }),
		{ landmarks: 0, mounts: 1, serverTag: "div", targetTag: "div", targetText: "Page body" },
	);
});

test("a standalone preview hydrates without a mismatch, then swaps to one main (children remount once)", async () => {
	assert.deepEqual(
		await renderMainLandmark("/preview/projects/butter-v1", { hydrate: true }),
		{ landmarks: 1, mounts: 2, serverTag: "div", targetTag: "main", targetText: "Page body" },
	);
});
