"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	CLAIM_MAX_FILE_AGE_MS,
	createGeneratedMediaOwnerStore,
	currentGeneratedMediaScope,
	runWithGeneratedMediaScope,
} = require("./generated-media-owners");
const { withCanonicalPreviewBody } = require("./widget-preview-payload");

function withMediaRoot(run) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "generated-media-owners-"));
	const projectRoot = path.join(root, "project");
	const baseDir = path.join(root, "data");
	fs.mkdirSync(path.join(projectRoot, "media/videos"), { recursive: true });
	const writeVideo = (name, ageMs = 0) => {
		const filePath = path.join(projectRoot, "media/videos", name);
		fs.writeFileSync(filePath, name);
		const at = new Date(Date.now() - ageMs);
		fs.utimesSync(filePath, at, at);
	};
	return Promise.resolve(run({ baseDir, projectRoot, writeVideo }))
		.finally(() => fs.rmSync(root, { recursive: true, force: true }));
}

test("the first caller to claim a freshly generated video owns it, and the record survives a restart", async () => {
	await withMediaRoot(async ({ baseDir, projectRoot, writeVideo }) => {
		writeVideo("a.mp4");
		const store = createGeneratedMediaOwnerStore({ baseDir, projectRoot });
		assert.equal(store.claim("./media/videos/a.mp4", "alice"), true);
		assert.equal(store.claim("media/videos/a.mp4", "alice"), true);
		assert.equal(store.claim("media/videos/a.mp4", "bob"), false);
		assert.equal(store.ownerOf("media/videos/a.mp4"), "alice");
		await store.flush();

		const reloaded = createGeneratedMediaOwnerStore({ baseDir, projectRoot });
		assert.equal(reloaded.ownerOf("./media/videos/a.mp4"), "alice");
		assert.equal(reloaded.claim("media/videos/a.mp4", "bob"), false);
	});
});

test("a video that is missing, old, or outside media/videos cannot be claimed", async () => {
	await withMediaRoot(async ({ baseDir, projectRoot, writeVideo }) => {
		writeVideo("old.mp4", CLAIM_MAX_FILE_AGE_MS + 60_000);
		const store = createGeneratedMediaOwnerStore({ baseDir, projectRoot });
		for (const mediaPath of ["media/videos/missing.mp4", "media/videos/old.mp4", "../media/videos/old.mp4", "app/page.tsx"]) {
			assert.equal(store.claim(mediaPath, "bob"), false, mediaPath);
			assert.equal(store.ownerOf(mediaPath), null, mediaPath);
		}
		assert.equal(store.claim("media/videos/old.mp4", ""), false);
	});
});

test("building a video preview during a caller's turn records them as its owner", async () => {
	await withMediaRoot(async ({ baseDir, projectRoot, writeVideo }) => {
		writeVideo("from-path.mp4");
		writeVideo("from-url.mp4");
		writeVideo("no-scope.mp4");
		const store = createGeneratedMediaOwnerStore({ baseDir, projectRoot });

		const fromPath = runWithGeneratedMediaScope({ owner: "alice", store }, () => (
			withCanonicalPreviewBody("genui-preview", { summary: "Rendered media/videos/from-path.mp4" })
		));
		assert.equal(fromPath.body.videoUrl, "/api/rovo/generated-media?path=media%2Fvideos%2Ffrom-path.mp4");
		runWithGeneratedMediaScope({ owner: "alice", store }, () => (
			withCanonicalPreviewBody("genui-preview", { videoUrl: "/api/rovo/generated-media?path=media%2Fvideos%2Ffrom-url.mp4" })
		));
		// No scope (a local caller, or code outside a chat turn) records nothing.
		withCanonicalPreviewBody("genui-preview", { summary: "media/videos/no-scope.mp4" });
		// A null scope clears an inherited one.
		runWithGeneratedMediaScope({ owner: "alice", store }, () => runWithGeneratedMediaScope(null, () => {
			assert.equal(currentGeneratedMediaScope(), null);
		}));

		assert.equal(store.ownerOf("media/videos/from-path.mp4"), "alice");
		assert.equal(store.ownerOf("media/videos/from-url.mp4"), "alice");
		assert.equal(store.ownerOf("media/videos/no-scope.mp4"), null);
		await store.flush();
	});
});

test("a preview that declares a body the client does not play as a video records no owner", async () => {
	await withMediaRoot(async ({ baseDir, projectRoot, writeVideo }) => {
		const names = ["text-body.mp4", "image-body.mp4", "nested-url.mp4", "encoded-url.mp4", "unrenderable.mp4"];
		for (const name of names) {
			writeVideo(name);
		}
		const encodedUrl = `/api/rovo/generated-media?path=${encodeURIComponent("media/videos/encoded-url.mp4")}`;
		const store = createGeneratedMediaOwnerStore({ baseDir, projectRoot });
		runWithGeneratedMediaScope({ owner: "alice", store }, () => {
			withCanonicalPreviewBody("genui-preview", { body: { kind: "text", text: "Saved media/videos/text-body.mp4" } });
			withCanonicalPreviewBody("image-preview", { body: { kind: "image" }, summary: "media/videos/image-body.mp4" });
			// A video-preview plays only its top-level URL.
			withCanonicalPreviewBody("video-preview", {
				body: { kind: "video", videoUrl: "/api/rovo/generated-media?path=media%2Fvideos%2Fnested-url.mp4" },
			});
			// Neither the client nor the server reads a video path out of an encoded URL.
			withCanonicalPreviewBody("genui-preview", {
				body: { kind: "json-render", spec: { root: "r", elements: { r: { type: "Text", props: { text: encodedUrl } } } } },
			});
			// A rejected video body with no renderable spec to fall back to plays nothing.
			withCanonicalPreviewBody("genui-preview", {
				body: { kind: "video" },
				spec: { root: "r", elements: {} },
				summary: "media/videos/unrenderable.mp4",
			});
		});
		for (const name of names) {
			assert.equal(store.ownerOf(`media/videos/${name}`), null, name);
		}
	});
});
