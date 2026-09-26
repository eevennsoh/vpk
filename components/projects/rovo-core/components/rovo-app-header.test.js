const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = process.cwd();

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(ROOT_DIR, filePath), "utf8");
}

const CORE_HEADER_SOURCE = readProjectFile("components/projects/rovo-core/components/rovo-app-header.tsx");
const ROVO_SHELL_SOURCE = readProjectFile("components/projects/rovo/components/rovo-app-shell.tsx");
const STUDIO_HEADER_SOURCE = readProjectFile("components/projects/studio/components/rovo-app-header.tsx");

test("Rovo app header shares the core header while Studio owns send mode", () => {
	assert.match(CORE_HEADER_SOURCE, /export function RovoAppHeaderCore/u);
	assert.match(CORE_HEADER_SOURCE, /moreMenuFooter\?: ReactNode;/u);
	assert.match(CORE_HEADER_SOURCE, /<RovoAgentBackButton \/>/u);
	assert.match(CORE_HEADER_SOURCE, /<RovoAppBrand \/>/u);
	assert.doesNotMatch(CORE_HEADER_SOURCE, /CONTROL_PLANE_HEADER_SURFACES|control-plane/u);
	assert.match(CORE_HEADER_SOURCE, /aria-label="Artifacts"/u);
	assert.match(CORE_HEADER_SOURCE, /aria-label="New chat"/u);
	assert.match(CORE_HEADER_SOURCE, /\{moreMenuFooter \? \(/u);
	assert.match(CORE_HEADER_SOURCE, /\{moreMenuFooter\}/u);
	assert.doesNotMatch(CORE_HEADER_SOURCE, /Send mode/u);

	assert.match(
		ROVO_SHELL_SOURCE,
		/import \{ RovoAppHeaderCore as RovoAppHeader \} from "@\/components\/projects\/rovo-core\/components\/rovo-app-header";/u,
	);
	assert.doesNotMatch(ROVO_SHELL_SOURCE, /components\/projects\/rovo\/components\/rovo-app-header/u);

	assert.match(STUDIO_HEADER_SOURCE, /function StudioSendModeMenu/u);
	assert.match(STUDIO_HEADER_SOURCE, /<DropdownMenuLabel>Send mode<\/DropdownMenuLabel>/u);
	assert.match(STUDIO_HEADER_SOURCE, /<DropdownMenuRadioGroup value=\{sendMode\} onValueChange=\{handleSendModeChange\}>/u);
	assert.match(STUDIO_HEADER_SOURCE, /moreMenuFooter=\{\(/u);
});
