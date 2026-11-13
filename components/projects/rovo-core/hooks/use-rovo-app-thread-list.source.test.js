const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const HOOK_SOURCE = fs.readFileSync(path.join(__dirname, "use-rovo-app-thread-list.ts"), "utf8");

test("thread deletion uses the latest optimistic thread list", () => {
	assert.match(HOOK_SOURCE, /const threadsRef = useRef<RovoAppThread\[\]>\(\[\]\);/u);
	assert.match(HOOK_SOURCE, /threadsRef\.current = nextThreads;\s*setThreads\(nextThreads\);/u);
	assert.match(HOOK_SOURCE, /threadsRef\.current\.filter\(\(thread\) => thread\.id !== threadId\)/u);
	assert.doesNotMatch(HOOK_SOURCE, /threads\.filter\(\(thread\) => thread\.id !== threadId\)/u);
});
