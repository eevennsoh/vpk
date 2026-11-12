const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const COMMENT_THREAD_SOURCE = fs.readFileSync(
	path.join(__dirname, "comment-thread.tsx"),
	"utf8",
);

test("CommentAvatar renders agent-authored comments with hexagon avatars", () => {
	assert.match(COMMENT_THREAD_SOURCE, /const isAgentAuthor = comment\.author\.role === "Agent";/u);
	assert.match(
		COMMENT_THREAD_SOURCE,
		/<Avatar shape=\{isAgentAuthor \? "hexagon" : "circle"\}>/u,
	);
});

test("Comment renders generated attachment links through the Rovo Canvas event", () => {
	assert.match(COMMENT_THREAD_SOURCE, /const contentLines = comment\.content\.split\("\\n"\);/u);
	assert.match(COMMENT_THREAD_SOURCE, /window\.dispatchEvent\(new Event\(comment\.actionLink\.eventName, \{ cancelable: true \}\)\);/u);
	assert.match(COMMENT_THREAD_SOURCE, /href=\{comment\.actionLink\.href\}/u);
	assert.match(COMMENT_THREAD_SOURCE, /onClick=\{handleActionClick\}/u);
});
