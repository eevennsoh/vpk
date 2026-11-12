const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const CLOCK_HOOK_FILE = path.join(__dirname, "use-location-clock.ts");
const CLOCK_HOOK_SOURCE = fs.readFileSync(CLOCK_HOOK_FILE, "utf8");

test("useLocationClock caches timezone formatters outside the 1 Hz tick", () => {
	assert.match(
		CLOCK_HOOK_SOURCE,
		/const formatters = useMemo\(\(\) => \{/,
	);
	assert.match(
		CLOCK_HOOK_SOURCE,
		/timeFormatter: new Intl\.DateTimeFormat\("en-GB", \{/,
	);
	assert.match(
		CLOCK_HOOK_SOURCE,
		/dateFormatter: new Intl\.DateTimeFormat\("en-GB", \{/,
	);
	assert.match(
		CLOCK_HOOK_SOURCE,
		/\}, \[timezone\]\);/,
	);
	assert.match(CLOCK_HOOK_SOURCE, /if \(!now \|\| !formatters\) \{/);
	assert.match(CLOCK_HOOK_SOURCE, /const \{ timeFormatter, dateFormatter \} = formatters;/);
	assert.match(CLOCK_HOOK_SOURCE, /const timeParts = timeFormatter\.formatToParts\(now\);/);
	assert.match(CLOCK_HOOK_SOURCE, /const dateParts = dateFormatter\.formatToParts\(now\);/);
});

test("useLocationClock keeps invalid timezone construction in the fallback path", () => {
	assert.match(
		CLOCK_HOOK_SOURCE,
		/const formatters = useMemo\(\(\) => \{\s*try \{/,
	);
	assert.match(
		CLOCK_HOOK_SOURCE,
		/\} catch \{\s*return null;\s*\}\s*\}, \[timezone\]\);/,
	);
});
