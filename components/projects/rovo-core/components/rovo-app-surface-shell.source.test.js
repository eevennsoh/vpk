const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = process.cwd();

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(ROOT_DIR, filePath), "utf8");
}

const CORE_SURFACE_SHELL_SOURCE = readProjectFile("components/projects/rovo-core/components/rovo-app-surface-shell.tsx");
const SURFACE_SHELL_FACTORY_SOURCE = readProjectFile("components/projects/rovo-core/components/create-rovo-app-surface-shell.tsx");
const ROVO_SURFACE_SHELL_SOURCE = readProjectFile("components/projects/rovo/components/rovo-app-surface-shell.tsx");
const STUDIO_SURFACE_SHELL_SOURCE = readProjectFile("components/projects/studio/components/rovo-app-surface-shell.tsx");

test("Rovo app surface shell shares chrome lifecycle and keeps route wiring in wrappers", () => {
	assert.match(CORE_SURFACE_SHELL_SOURCE, /export interface RovoAppSurfaceShellSidebarProps/u);
	assert.match(SURFACE_SHELL_FACTORY_SOURCE, /export function createRovoAppSurfaceShell/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /export function RovoAppSurfaceShellCore/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /product: "rovo" \| "studio";/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /SidebarComponent: ComponentType<RovoAppSurfaceShellSidebarProps>;/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /useThreadList: \(\) => UseRovoAppThreadListResult;/u);
	assert.match(SURFACE_SHELL_FACTORY_SOURCE, /<RovoAppSurfaceShellCore[\s\S]*buildThreadPath=\{options\.buildThreadPath\}[\s\S]*product=\{options\.product\}[\s\S]*SidebarComponent=\{options\.SidebarComponent\}/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /const \{ deleteThread, threads, threadsLoaded \} = useThreadList\(\);/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /window\.setTimeout[\s\S]*getCssDurationTokenMs\(SIDEBAR_MOTION_DURATION_CSS_VARIABLE, SIDEBAR_MOTION_FALLBACK_MS\)/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /<TopNavigation[\s\S]*variant="shell"[\s\S]*product=\{product\}/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /<SidebarComponent[\s\S]*activeThreadId=\{null\}[\s\S]*headerOffsetPx=\{slot\.headerOffsetPx\}[\s\S]*hoverOpen=\{hoverRevealActive\}[\s\S]*isResizing=\{slot\.isResizing\}/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /onDeleteThread=\{async \(threadId\) => \{[\s\S]*startTransition\(\(\) => \{[\s\S]*void deleteThread\(threadId\);/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /router\.push\(rootPath\);/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /router\.push\(buildThreadPath\(threadId\)\);/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /resizeHandle=\{slot\.resizeHandle\}/u);
	assert.match(CORE_SURFACE_SHELL_SOURCE, /threads=\{threads\}/u);
	assert.doesNotMatch(CORE_SURFACE_SHELL_SOURCE, /@\/components\/projects\/rovo\/components/u);
	assert.doesNotMatch(CORE_SURFACE_SHELL_SOURCE, /@\/components\/projects\/studio\/components/u);

	assert.match(ROVO_SURFACE_SHELL_SOURCE, /import \{ createRovoAppSurfaceShell \} from "@\/components\/projects\/rovo-core\/components\/create-rovo-app-surface-shell";/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /import \{ RovoAppSidebar \} from "@\/components\/projects\/rovo\/components\/rovo-app-sidebar";/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /import \{ useRovoAppThreadList \} from "@\/components\/projects\/rovo\/hooks\/use-rovo-app-thread-list";/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /export const RovoAppSurfaceShell = createRovoAppSurfaceShell\(\{/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /buildThreadPath: buildRovoAppThreadPath/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /rootPath: ROVO_APP_ROOT_PATH/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /product: "rovo"/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /SidebarComponent: RovoAppSidebar/u);
	assert.match(ROVO_SURFACE_SHELL_SOURCE, /useThreadList: useRovoAppThreadList/u);
	assert.doesNotMatch(ROVO_SURFACE_SHELL_SOURCE, /ReactNode|RovoAppSurfaceShellCore|TopNavigation|useRouter|useState|setTimeout|startTransition/u);

	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /import \{ createRovoAppSurfaceShell \} from "@\/components\/projects\/rovo-core\/components\/create-rovo-app-surface-shell";/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /import \{ RovoAppSidebar \} from "@\/components\/projects\/studio\/components\/rovo-app-sidebar";/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /import \{ useRovoAppThreadList \} from "@\/components\/projects\/studio\/hooks\/use-rovo-app-thread-list";/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /export const RovoAppSurfaceShell = createRovoAppSurfaceShell\(\{/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /buildThreadPath: buildRovoAppThreadPath/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /rootPath: ROVO_APP_ROOT_PATH/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /product: "studio"/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /SidebarComponent: RovoAppSidebar/u);
	assert.match(STUDIO_SURFACE_SHELL_SOURCE, /useThreadList: useRovoAppThreadList/u);
	assert.doesNotMatch(STUDIO_SURFACE_SHELL_SOURCE, /ReactNode|RovoAppSurfaceShellCore|TopNavigation|useRouter|useState|setTimeout|startTransition/u);
});
