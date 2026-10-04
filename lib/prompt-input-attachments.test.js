"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createPromptInputAttachmentStore } = require("./prompt-input-attachments.ts");

function createHarness(t) {
	const allocated = [];
	const revoked = [];
	t.mock.method(URL, "createObjectURL", (file) => {
		const url = `blob:attachment-${allocated.length}`;
		allocated.push({ filename: file.name, url });
		return url;
	});
	t.mock.method(URL, "revokeObjectURL", (url) => revoked.push(url));
	return { store: createPromptInputAttachmentStore(), allocated, revoked };
}

function file(name = "photo.png", type = "image/png", size = 3) {
	return new File(["a".repeat(size)], name, { type });
}

test("attachment admission preserves exact MIME, size and count outcomes", (t) => {
	const { store, allocated } = createHarness(t);
	const errors = [];
	const limits = { accept: "image/*, application/pdf", maxFileSize: 4, maxFiles: 2, onError: (error) => errors.push(error) };
	store.add([file("text.txt", "text/plain")], limits);
	store.add([file("large.png", "image/png", 5)], limits);
	store.add([file("photo.png"), file("readme.txt", "text/plain"), file("large.png", "image/png", 5), file("report.pdf", "application/pdf"), file("extra.png")], limits);
	assert.deepEqual(errors, [
		{ code: "accept", message: "No files match the accepted types." },
		{ code: "max_file_size", message: "All files exceed the maximum size." },
		{ code: "max_files", message: "Too many files. Some were not added." },
	]);
	assert.deepEqual(store.getSnapshot().map((attachment) => [attachment.filename, attachment.mediaType, attachment.type]), [["photo.png", "image/png", "file"], ["report.pdf", "application/pdf", "file"]]);
	assert.deepEqual(allocated.map((entry) => entry.filename), ["photo.png", "report.pdf"]);
});

test("attachment batches share synchronous capacity before React renders", (t) => {
	const { store, allocated } = createHarness(t);
	const errors = [];
	const limits = { maxFiles: 1, onError: (error) => errors.push(error.code) };
	store.add([file("first.png")], limits);
	store.add([file("second.png")], limits);
	assert.deepEqual(store.getSnapshot().map((attachment) => attachment.filename), ["first.png"]);
	assert.deepEqual(errors, ["max_files"]);
	assert.equal(allocated.length, 1);
});

test("unrestricted provider admission accepts all files and zero size means unlimited", (t) => {
	const { store } = createHarness(t);
	store.add([file("text.txt", "text/plain"), file("large.png", "image/png", 100)]);
	store.add([file("larger.png", "image/png", 200)], { maxFileSize: 0 });
	assert.deepEqual(store.getSnapshot().map((attachment) => attachment.filename), ["text.txt", "large.png", "larger.png"]);
});

test("exact MIME matching retains the existing extension and case behavior", (t) => {
	const { store } = createHarness(t);
	const errors = [];
	store.add([file()], { accept: ".png", onError: (error) => errors.push(error.code) });
	store.add([file()], { accept: "IMAGE/*", onError: (error) => errors.push(error.code) });
	store.add([file()], { accept: " image/png " });
	assert.deepEqual(errors, ["accept", "accept"]);
	assert.equal(store.getSnapshot().length, 1);
});

test("snapshot identity changes only for published file changes and listeners unsubscribe", (t) => {
	const { store } = createHarness(t);
	const initial = store.getSnapshot();
	const publications = [];
	const unsubscribe = store.subscribe(() => publications.push(store.getSnapshot().length));
	store.add([]);
	store.remove("missing");
	store.clear();
	assert.equal(store.getSnapshot() === initial, true);
	store.add([file()]);
	const attached = store.getSnapshot();
	assert.equal(attached === initial, false);
	assert.equal(store.getSnapshot() === attached, true);
	unsubscribe();
	store.clear();
	assert.deepEqual(publications, [1]);
});

test("remove, clear and repeated cleanup revoke each URL once", (t) => {
	const { store, allocated, revoked } = createHarness(t);
	store.add([file("one.png"), file("two.png")]);
	const firstId = store.getSnapshot()[0].id;
	store.remove(firstId);
	store.remove(firstId);
	store.clear();
	store.clear();
	assert.deepEqual(revoked, allocated.map((entry) => entry.url));
	assert.deepEqual(store.getSnapshot(), []);
});

test("allocation failure releases new URLs without discarding existing attachments", (t) => {
	const { store, revoked } = createHarness(t);
	store.add([file("existing.png")]);
	t.mock.method(URL, "createObjectURL", (incoming) => {
		if (incoming.name === "fail.png") { throw new Error("allocation failed"); }
		return "blob:new-before-failure";
	});
	assert.throws(() => store.add([file("new.png"), file("fail.png")]), /allocation failed/u);
	assert.deepEqual(store.getSnapshot().map((attachment) => attachment.filename), ["existing.png"]);
	assert.deepEqual(revoked, ["blob:new-before-failure"]);
});
