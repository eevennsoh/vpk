const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const WEATHER_SOURCE = fs.readFileSync(
	path.join(__dirname, "index.tsx"),
	"utf8",
);

test("Weather toggles keep-awake directly from the W shortcut", () => {
	assert.doesNotMatch(WEATHER_SOURCE, /openWakeLockMenuRequestKey/);
	assert.match(
		WEATHER_SOURCE,
		/if \(normalizedKey === "w"\) \{\s+if \(\s+event\.repeat \|\|\s+hasShortcutModifier \|\|\s+typingTarget \|\|\s+sliderTarget \|\|\s+interactiveTarget \|\|\s+isCityManagerOpen \|\|\s+!isWakeLockSupported\s+\) \{\s+return;\s+\}\s+event\.preventDefault\(\);\s+revealThemeControlFromKeyboard\(\);\s+handleWakeLockToggle\(\);\s+if \(wakeLockButtonRef\.current\) \{\s+animate\(wakeLockButtonRef\.current, \{ scale: \[0\.82, 1\] \}, \{ type: "spring", duration: 0\.4, bounce: 0\.55 \}\);\s+\}\s+return;\s+\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/wakeLock=\{\{[\s\S]*status: wakeLockStatus,[\s\S]*statusMessage: wakeLockStatusMessage,[\s\S]*onToggle: handleWakeLockToggle,[\s\S]*\}\}/,
	);
});
