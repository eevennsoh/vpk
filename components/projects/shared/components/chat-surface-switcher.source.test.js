const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
	path.join(__dirname, "chat-surface-switcher.tsx"),
	"utf8",
);

test("chat surface switcher calls the surface switch hook before switching to the selected surface", () => {
	assert.match(
		source,
		/const handleSelectSurface = \(surface: CurrentSurface\) => \{\s*onSurfaceSwitch\?\.\(surface\);\s*switchSurface\(surface\);\s*\};/u,
	);
	assert.match(
		source,
		/onSelect=\{\(\) => handleSelectSurface\("sidebar"\)\}[\s\S]*>\s*Side panel/u,
	);
	assert.match(
		source,
		/onSelect=\{\(\) => handleSelectSurface\("floating"\)\}[\s\S]*>\s*Floating/u,
	);
	assert.doesNotMatch(source, /<DropdownMenuItem[\s\S]*?onClick=/u);
});

test("chat surface switcher opens the active compact thread in fullscreen when available", () => {
	assert.match(
		source,
		/const \{ activeThreadId, switchSurface, closeChat \} = useRovoChat\(\);/u,
	);
	assert.match(
		source,
		/router\.push\(activeThreadId \? buildRovoAppThreadPath\(ROVO_APP_ROOT_PATH, activeThreadId\) : ROVO_APP_ROOT_PATH\);/u,
	);
	assert.match(
		source,
		/<span className="inline-flex h-5 items-center opacity-0 group-data-\[highlighted\]\/dropdown-menu-item:opacity-100">\s*<LinkExternalIcon label="" size="small" \/>/u,
	);
});

test("compact chat Rovo labels do not mount a dropdown menu", () => {
	const headers = [
		fs.readFileSync(path.join(__dirname, "../../sidebar-chat/components/chat-header.tsx"), "utf8"),
		fs.readFileSync(path.join(__dirname, "../../rovo-floating-chat/components/floating-chat-header.tsx"), "utf8"),
	];

	for (const headerSource of headers) {
		assert.doesNotMatch(headerSource, /RovoDropdownButton/u);
		assert.doesNotMatch(
			headerSource,
			/<DropdownMenuContent align="start" sideOffset=\{4\} positionerClassName="z-\[600\]">[\s\S]*?<ChatSurfaceSwitcherItems/u,
		);
		assert.match(headerSource, /import \{ RovoAppBrand \} from "@\/components\/projects\/rovo-core\/components\/rovo-app-brand";/u);
		assert.match(headerSource, /<RovoAppBrand/u);
		assert.match(
			headerSource,
			/<DropdownMenuContent align="end" sideOffset=\{4\} positionerClassName="z-\[600\]">[\s\S]*?<ChatSurfaceSwitcherItems/u,
		);
	}
});
