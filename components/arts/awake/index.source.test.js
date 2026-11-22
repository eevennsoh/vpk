const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const WEATHER_FILE = path.join(__dirname, "index.tsx");
const CITY_POPOVER_FILE = path.join(__dirname, "city-popover.tsx");
const WEATHER_SOURCE = fs.readFileSync(WEATHER_FILE, "utf8");
const CITY_POPOVER_SOURCE = fs.readFileSync(CITY_POPOVER_FILE, "utf8");

test("Weather keeps the ticking clock state out of the top-level scene", () => {
	const timezoneClockHookMatches = WEATHER_SOURCE.match(
		/useLocationClock\(timezone\)/g,
	) ?? [];
	assert.doesNotMatch(
		WEATHER_SOURCE,
		/const clock = useLocationClock\(selected\.timezone\);/,
	);
	assert.equal(
		timezoneClockHookMatches.length,
		1,
		"selected weather chrome should share a single timezone clock",
	);
	assert.match(WEATHER_SOURCE, /function WeatherTimeCard\(/);
	assert.match(WEATHER_SOURCE, /function WeatherDateSummary\(/);
	assert.match(
		WEATHER_SOURCE,
		/function SelectedWeatherClock\(/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const clock = useLocationClock\(timezone\);/,
	);
	assert.doesNotMatch(
		WEATHER_SOURCE,
		/function WeatherTimeCard\([\s\S]*?const clock = useLocationClock\(timezone\);[\s\S]*?function WeatherDateSummary\(/,
	);
	assert.match(
		WEATHER_SOURCE,
		/<SelectedWeatherClock[\s\S]*timezone=\{selected\.timezone\}/,
	);
	assert.match(
		WEATHER_SOURCE,
		/<WeatherTimeCard[\s\S]*clock=\{clock\}/,
	);
	assert.match(
		WEATHER_SOURCE,
		/<WeatherDateSummary clock=\{clock\} \/>/,
	);
});

test("Weather splits pointer-driven chrome between the top theme control and bottom keyboard hints", () => {
	assert.match(
		WEATHER_SOURCE,
		/import \{ GlassTabs \} from "@\/components\/visual\/glass-tabs";/,
	);
	assert.doesNotMatch(
		WEATHER_SOURCE,
		/import \{ GlassSegmentedControl \} from "\.\/glass-segmented-control";/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[pointerViewportZone, setPointerViewportZone\] = React\.useState<"top" \| "bottom" \| null>\(null\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[isPointerOverSlider, setIsPointerOverSlider\] = React\.useState\(false\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[isThemeKeyboardVisible, setIsThemeKeyboardVisible\] = React\.useState\(false\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[themeNavigationPulseKey, setThemeNavigationPulseKey\] = React\.useState\(0\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[openCityManagerRequestKey, setOpenCityManagerRequestKey\] = React\.useState\(0\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[isCityManagerOpen, setIsCityManagerOpen\] = React\.useState\(false\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[cityNavigationPulseKey, setCityNavigationPulseKey\] = React\.useState\(0\);/,
	);
	assert.match(WEATHER_SOURCE, /function WeatherKeyboardHints\(/);
	assert.match(WEATHER_SOURCE, /showWakeShortcut: boolean;/);
		assert.match(
			WEATHER_SOURCE,
			/const \{\s+isSupported: isWakeLockSupported,\s+isEnabled: isWakeLockEnabled,\s+isActive: isWakeLockActive,\s+status: wakeLockStatus,\s+statusMessage: wakeLockStatusMessage,\s+error: wakeLockError,\s+toggle: toggleWakeLock,\s+\} = useWakeLock\(\);/s,
		);
		assert.match(
			WEATHER_SOURCE,
			/WAKE_LOCK_VISIBLE_TAB_MESSAGE,\s*\n\} from "\.\/use-wake-lock";/s,
		);
	assert.match(WEATHER_SOURCE, /const handleWakeLockToggle = React\.useCallback\(\(\) => \{/);
	assert.match(WEATHER_SOURCE, /const revealThemeControlFromKeyboard = React\.useCallback\(\(\) => \{/);
	assert.match(WEATHER_SOURCE, /setIsThemeKeyboardVisible\(true\);/);
	assert.match(WEATHER_SOURCE, /setTimeout\(\(\) => \{\s+setIsThemeKeyboardVisible\(false\);/s);
	assert.match(WEATHER_SOURCE, /keyboardSelectionPulseKey: number;/);
	assert.match(
		WEATHER_SOURCE,
		/isVisible=\{\s+isThemeKeyboardVisible \|\|\s+\(pointerViewportZone === "top" && !isPointerOverSlider\)\s+\}/,
	);
	assert.match(
		WEATHER_SOURCE,
		/<WeatherKeyboardHints[\s\S]*isVisible=\{pointerViewportZone === "bottom"\}[\s\S]*isEditing=\{isCityManagerOpen\}[\s\S]*showWakeShortcut=\{!isCityManagerOpen && isWakeLockSupported\}[\s\S]*\/>/,
	);
	// Footer keyboard hints now use the shadcn `Kbd` primitive
	// (`@/components/ui/kbd`) for consistent styling. The ReturnIcon
	// glyph is wrapped in a `<Kbd>` so it visually reads like the
	// other shortcut keys (Enter == Return key).
	assert.match(WEATHER_SOURCE, /<Kbd className="font-sans">\s*<ReturnIcon className="size-3\.5 text-icon-subtlest" \/>\s*<\/Kbd>/);
	assert.match(WEATHER_SOURCE, /<Kbd className="font-sans">w<\/Kbd>\s+<span>awake<\/span>/);
	assert.match(WEATHER_SOURCE, /update/);
	assert.match(
		WEATHER_SOURCE,
		/update[\s\S]*showWakeShortcut \?[\s\S]*<Kbd className="font-sans">w<\/Kbd>[\s\S]*<span>awake<\/span>/s,
	);
	assert.doesNotMatch(WEATHER_SOURCE, /Esc closes search/);
	assert.match(WEATHER_SOURCE, /event\.key === "ArrowUp" \|\| event\.key === "ArrowDown"/);
	assert.match(WEATHER_SOURCE, /const nextSelectedIndex = Math\.max\(/);
	assert.match(WEATHER_SOURCE, /if \(nextSelectedIndex === selectedIndex\) \{/);
	assert.match(WEATHER_SOURCE, /setSelectedIndex\(nextSelectedIndex\);/);
	assert.match(
		WEATHER_SOURCE,
		/setCityNavigationPulseKey\(\(current\) => current \+ 1\);/,
	);
	assert.match(WEATHER_SOURCE, /revealThemeControlFromKeyboard\(\);/);
	assert.match(
		WEATHER_SOURCE,
		/if \(typingTarget \|\| sliderTarget \|\| interactiveTarget\) return;/,
	);
	assert.match(WEATHER_SOURCE, /const normalizedKey = event\.key\.toLowerCase\(\);/);
	assert.match(
		WEATHER_SOURCE,
		/const hasShortcutModifier = event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey;/,
	);
	assert.match(WEATHER_SOURCE, /if \(normalizedKey === "w"\) \{/);
	assert.match(
		WEATHER_SOURCE,
		/if \(normalizedKey === "w"\) \{\s+if \(\s+event\.repeat \|\|\s+hasShortcutModifier \|\|\s+typingTarget \|\|\s+sliderTarget \|\|\s+interactiveTarget \|\|\s+isCityManagerOpen \|\|\s+!isWakeLockSupported\s+\) \{\s+return;\s+\}\s+event\.preventDefault\(\);\s+revealThemeControlFromKeyboard\(\);\s+handleWakeLockToggle\(\);\s+if \(wakeLockButtonRef\.current\) \{\s+animate\(wakeLockButtonRef\.current, \{ scale: \[0\.82, 1\] \}, \{ type: "spring", duration: 0\.4, bounce: 0\.55 \}\);\s+\}\s+return;\s+\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/const nextIndex = Math\.max\(\s*0,\s*Math\.min\(safeIndex \+ delta, THEME_MODE_ORDER\.length - 1\),\s*\);/s,
	);
	assert.doesNotMatch(
		WEATHER_SOURCE,
		/\(safeIndex \+ delta \+ THEME_MODE_ORDER\.length\) %\s*THEME_MODE_ORDER\.length/,
	);
	assert.match(
		WEATHER_SOURCE,
		/setThemeNavigationPulseKey\(\(current\) => current \+ 1\);/,
	);
	assert.match(WEATHER_SOURCE, /event\.key === "Enter"/);
	assert.match(
		WEATHER_SOURCE,
		/setOpenCityManagerRequestKey\(\(current\) => current \+ 1\);/,
	);
	assert.match(WEATHER_SOURCE, /openRequestKey=\{openCityManagerRequestKey\}/);
	assert.match(WEATHER_SOURCE, /onOpenChange=\{setIsCityManagerOpen\}/);
	assert.match(
		WEATHER_SOURCE,
		/keyboardSelectionPulseKey=\{themeNavigationPulseKey\}/,
	);
		assert.match(
			WEATHER_SOURCE,
			/wakeLock=\{\{[\s\S]*isSupported: isWakeLockSupported,[\s\S]*isEnabled: isWakeLockEnabled,[\s\S]*isActive: isWakeLockActive,[\s\S]*status: wakeLockStatus,[\s\S]*statusMessage: wakeLockStatusMessage,[\s\S]*error: wakeLockError,[\s\S]*onToggle: handleWakeLockToggle,[\s\S]*\}\}/,
		);
	assert.match(
		WEATHER_SOURCE,
		/focus-visible:border-ring focus-visible:ring-ring\/50 focus-visible:ring-3 focus-visible:outline-none/,
	);
	assert.doesNotMatch(WEATHER_SOURCE, /group-hover\/wake-lock:opacity-100/);
	assert.match(
		WEATHER_SOURCE,
		/<GlassTabs[\s\S]*keyboardSelectionPulseKey=\{themeNavigationPulseKey\}/,
	);
	assert.doesNotMatch(WEATHER_SOURCE, /clipPath:/);
	assert.match(
		WEATHER_SOURCE,
		/animate=\{isVisible\s*\?\s*\{ opacity: 1, filter: "blur\(0px\)" \}\s*:\s*\{ opacity: 0, filter: "blur\(16px\)" \}\s*\}/s,
	);
	assert.match(WEATHER_SOURCE, /keyboardNavigationPulseKey=\{cityNavigationPulseKey\}/);
});

test("Weather renders the city slider last in source so the glass shell can overlap the other cards", () => {
	assert.match(
		WEATHER_SOURCE,
		/const cityTitleContent = \(\s*<div className="text-text relative flex flex-col items-center text-center">/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/const wakeLockWarning = isWakeLockEnabled && !isWakeLockActive\s+\?\s+wakeLockStatus === "waiting-for-visible"\s+\?\s+wakeLockStatusMessage\s+:\s+wakeLockError\s+:\s+isWakeLockReturnReminderVisible\s+\?\s+WAKE_LOCK_VISIBLE_TAB_MESSAGE\s+:\s+null;/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/<AnimatePresence initial=\{false\}>[\s\S]*wakeLockWarning \? \([\s\S]*key="awake-warning"[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*\{wakeLockWarning\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/key="awake-warning"[\s\S]*fontFamily: "'DotGothic16', sans-serif"/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/\{isEntranceAnimating \? \(\s*<motion\.div[\s\S]*\{cityTitleContent\}[\s\S]*\) : \(\s*cityTitleContent\s*\)\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/<SelectedWeatherClock[\s\S]*timeClassName=\{isRowLayout \? "col-start-2 row-start-1" : "col-start-2 row-start-1"\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/<motion\.div[\s\S]*className=\{isRowLayout \? "col-start-3 row-start-1" : "col-start-1 row-start-2"\}[\s\S]*Humid %/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/<motion\.div[\s\S]*className=\{isRowLayout \? "col-start-4 row-start-1" : "col-start-2 row-start-2"\}[\s\S]*Temp °C/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/const sliderOverlapMarginBottom =\s+!isRowLayout\s+\?\s+-Math\.round\(sizes\.pillHeight \* 0\.18\)\s+:\s+0;/s,
	);
	assert.match(WEATHER_SOURCE, /const cityRailEditor = \(\s*<CityRailEditor/s);
	assert.match(WEATHER_SOURCE, /marginBottom: sliderOverlapMarginBottom/);
	assert.match(
		WEATHER_SOURCE,
		/\{isEntranceAnimating \? \(\s*<motion\.div[\s\S]*pointerEvents: "none"[\s\S]*\{cityRailEditor\}[\s\S]*\) : \(\s*<div[\s\S]*style=\{\{ marginBottom: sliderOverlapMarginBottom \}\}[\s\S]*\{cityRailEditor\}[\s\S]*\)\}/s,
	);
	assert.ok(
		WEATHER_SOURCE.lastIndexOf("{cityRailEditor}") > WEATHER_SOURCE.lastIndexOf("Temp °C"),
		"cityRailEditor should be rendered after the other cards in source order",
	);
	assert.doesNotMatch(WEATHER_SOURCE, /<motion\.div\s+className="relative z-20"[\s\S]*\{cityRailEditor\}/s);
});

test("Weather only advances the awake timer while the wake lock is active", () => {
	assert.match(WEATHER_SOURCE, /const \[awakeElapsed, setAwakeElapsed\] = React\.useState\(0\);/);
	assert.match(WEATHER_SOURCE, /const awakeElapsedMsRef = React\.useRef\(0\);/);
	assert.match(
		WEATHER_SOURCE,
		/const awakeSessionStartedAtRef = React\.useRef<number \| null>\(null\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const \[isWakeLockReturnReminderVisible, setIsWakeLockReturnReminderVisible\] = React\.useState\(false\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const wakeLockReturnReminderTimeoutRef = React\.useRef<ReturnType<typeof setTimeout> \| null>\(null\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const previousWakeLockStatusRef = React\.useRef\(wakeLockStatus\);/,
	);
	assert.match(
		WEATHER_SOURCE,
		/const isWakeLockTimerRunning =\s+isWakeLockEnabled &&\s+isWakeLockActive &&\s+!isWakeLockReturnReminderVisible;/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/if \(\s+previousStatus === "waiting-for-visible" &&\s+wakeLockStatus === "active" &&\s+isWakeLockActive\s+\) \{\s+scheduleWakeLockReturnReminder\(\);\s+return;\s+\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/if \(!isWakeLockEnabled\) \{\s+awakeSessionStartedAtRef\.current = null;\s+awakeElapsedMsRef\.current = 0;\s+setAwakeElapsed\(0\);\s+return;\s+\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/if \(!isWakeLockTimerRunning\) \{\s+if \(awakeSessionStartedAtRef\.current !== null\) \{\s+awakeElapsedMsRef\.current \+= Date\.now\(\) - awakeSessionStartedAtRef\.current;\s+awakeSessionStartedAtRef\.current = null;\s+\}\s+setAwakeElapsed\(Math\.floor\(awakeElapsedMsRef\.current \/ 1000\)\);\s+return;\s+\}/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/setAwakeElapsed\(\s*Math\.floor\(\(awakeElapsedMsRef\.current \+ sessionElapsedMs\) \/ 1000\),\s*\);/s,
	);
	assert.match(
		WEATHER_SOURCE,
		/\}, \[isWakeLockEnabled, isWakeLockTimerRunning\]\);/,
	);
});

test("CityRailEditor opens the city manager with Enter from the focused slider", () => {
	assert.match(CITY_POPOVER_SOURCE, /openRequestKey\?: number;/);
	assert.match(CITY_POPOVER_SOURCE, /onOpenChange\?: \(isOpen: boolean\) => void;/);
	assert.match(CITY_POPOVER_SOURCE, /keyboardNavigationPulseKey\?: number;/);
	assert.match(CITY_POPOVER_SOURCE, /onOpenChange\?\.\(isOpen\);/);
	assert.match(
		CITY_POPOVER_SOURCE,
		/if \(openRequestKey > 0 && openRequestKey !== openState\.handledOpenRequestKey\) \{\s*resolvedOpenState = \{\s*\.\.\.openState,\s*handledOpenRequestKey: openRequestKey,\s*highlightedIndex: 0,\s*isOpen: true,\s*\};\s*setOpenState\(resolvedOpenState\);/s,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/if \(openRequestKey <= 0 \|\| openRequestKey !== resolvedOpenState\.handledOpenRequestKey\) \{\s*return;\s*\}\s*playSound\("\/sound\/click-001\.mp3"\);/s,
	);
	assert.match(CITY_POPOVER_SOURCE, /onKeyDown=\{\(event\) => \{/);
	assert.match(CITY_POPOVER_SOURCE, /if \(isOpen \|\| event\.key !== "Enter"\) return;/);
	assert.match(CITY_POPOVER_SOURCE, /target\.closest\('\[role="slider"\]'\)/);
	assert.match(CITY_POPOVER_SOURCE, /setIsOpen\(true\);/);
	assert.match(CITY_POPOVER_SOURCE, /keyboardNavigationPulseKey=\{keyboardNavigationPulseKey\}/);
});

test("CityRailEditor reuses the slider navigation sound while moving through the search list", () => {
	assert.match(
		CITY_POPOVER_SOURCE,
		/if \(event\.key === "ArrowDown"\) \{\s+event\.preventDefault\(\);\s+setHighlightedIndex\(\(prev\) => \{\s+const next = Math\.min\(prev \+ 1, Math\.max\(filteredCities\.length - 1, 0\)\);\s+if \(next !== prev\) \{\s+playSound\("\/sound\/click-002\.mp3"\);\s+\}\s+return next;\s+\}\);\s+return;\s+\}/s,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/if \(event\.key === "ArrowUp"\) \{\s+event\.preventDefault\(\);\s+setHighlightedIndex\(\(prev\) => \{\s+const next = Math\.max\(prev - 1, 0\);\s+if \(next !== prev\) \{\s+playSound\("\/sound\/click-002\.mp3"\);\s+\}\s+return next;\s+\}\);\s+return;\s+\}/s,
	);
});

test("CityRailEditor toggles a selected city off when Enter is pressed again", () => {
	assert.match(CITY_POPOVER_SOURCE, /addCity,\s+removeCity,\s+openRequestKey = 0,/s);
	assert.match(
		CITY_POPOVER_SOURCE,
		/const isRemoving = cityIndex !== -1 && Boolean\(removeCity\);\s+playSound\(isRemoving \? "\/sound\/click-004\.mp3" : "\/sound\/click-001\.mp3"\);\s+if \(cityIndex !== -1 && removeCity\) \{\s+removeCity\(city\.id\);/s,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/if \(cityIndex !== -1 && removeCity\) \{\s+removeCity\(city\.id\);\s+\} else \{\s+addCity\(city\);\s+handleCommit\(cities\.length\);/s,
	);
});

test("CityRailEditor shows checkmarks for every city already in the selected list", () => {
	assert.match(
		CITY_POPOVER_SOURCE,
		/const isSelected = cityIndex !== -1;/,
	);
	assert.match(
		CITY_POPOVER_SOURCE,
		/className=\"w-full bg-transparent text-sm text-text-subtlest outline-none placeholder:text-text-subtlest\"/,
	);
});
