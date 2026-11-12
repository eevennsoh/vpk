const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const RIGHT_RAIL_SOURCE = fs.readFileSync(
	path.join(__dirname, "rovo-canvas-right-rail.tsx"),
	"utf8",
);

test("default Rovo Canvas chat rail owns the provider required by ChatPanel", () => {
	assert.match(
		RIGHT_RAIL_SOURCE,
		/import \{ RovoChatProvider \} from "@\/app\/contexts\/context-rovo-chat";/u,
	);
	assert.match(
		RIGHT_RAIL_SOURCE,
		/<RovoChatProvider>[\s\S]*<ChatPanel[\s\S]*\/>[\s\S]*<\/RovoChatProvider>/u,
	);
});
