const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const WEATHER_SOURCE = fs.readFileSync(
	path.join(__dirname, "index.tsx"),
	"utf8",
);

test("Weather mounts the selected clock wrapper with a standalone centered date row", () => {
	assert.match(WEATHER_SOURCE, /function SelectedWeatherClock\(/);
	assert.match(WEATHER_SOURCE, /<WeatherDateSummary clock=\{clock\} \/>/);
	assert.match(
		WEATHER_SOURCE,
		/\? "grid grid-cols-\[auto_auto_auto_auto\] items-center justify-center gap-x-3 gap-y-6 sm:gap-y-10 lg:gap-y-14"/,
	);
	assert.match(
		WEATHER_SOURCE,
		/timeClassName\?: string;/,
	);
	assert.match(
		WEATHER_SOURCE,
		/dateClassName\?: string;/,
	);
	assert.match(
		WEATHER_SOURCE,
		/<SelectedWeatherClock[\s\S]*timeClassName=\{isRowLayout \? "col-start-2 row-start-1" : "col-start-2 row-start-1"\}[\s\S]*dateClassName=\{cn\(\s*isRowLayout\s*\?\s*"col-span-4 row-start-2 flex justify-center"\s*:\s*"col-span-2 row-start-3 mt-4 flex justify-center sm:mt-8",/s,
	);
});
