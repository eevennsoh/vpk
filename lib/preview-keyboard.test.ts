import assert from "node:assert/strict";
import test from "node:test";

import { resolvePreviewKeyCaptureKey } from "./preview-keyboard.ts";

const key = (value: string, modifiers: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {}) => ({
	altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, key: value, ...modifiers,
});
const idle = { captured: false, engaged: false };
const engaged = { captured: false, engaged: true };
const captured = { captured: true, engaged: true };

test("plain Tab and Shift+Tab leave an uncaptured viewport; modified Tab is forwarded", () => {
	assert.equal(resolvePreviewKeyCaptureKey(key("Tab"), idle), "leave");
	assert.equal(resolvePreviewKeyCaptureKey(key("Tab", { shiftKey: true }), engaged), "leave");
	assert.equal(resolvePreviewKeyCaptureKey(key("Tab", { ctrlKey: true }), idle), "forward");
});

test("Enter starts capture only on a viewport reached by keyboard and not yet engaged", () => {
	assert.equal(resolvePreviewKeyCaptureKey(key("Enter"), idle), "start");
	assert.equal(resolvePreviewKeyCaptureKey(key("Enter"), engaged), "forward");
	assert.equal(resolvePreviewKeyCaptureKey(key("Enter", { shiftKey: true }), idle), "forward");
});

test("Escape releases only while captured; other keys, Tab included, are forwarded while captured", () => {
	assert.equal(resolvePreviewKeyCaptureKey(key("Escape"), captured), "release");
	assert.equal(resolvePreviewKeyCaptureKey(key("Escape", { altKey: true }), captured), "forward");
	assert.equal(resolvePreviewKeyCaptureKey(key("Escape"), idle), "forward");
	assert.equal(resolvePreviewKeyCaptureKey(key("Tab"), captured), "forward");
	assert.equal(resolvePreviewKeyCaptureKey(key("Enter"), captured), "forward");
});
