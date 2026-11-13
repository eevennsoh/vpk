const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PROJECT_LAYOUT_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
// The floating Rovo button is a directory of collaborating modules, not one
// file. These greps assert "this code exists somewhere in the component", so we
// concatenate every source file in that directory. The order below mirrors the
// component's composition (types → geometry → leaves → surface → entry) so
// assertions that span sections keep reading top-to-bottom; any file not listed
// is appended alphabetically so a new module can never be silently skipped.
const FLOATING_ROVO_BUTTON_DIR = path.join(__dirname, "../blocks/rovo-button");
const FLOATING_ROVO_BUTTON_FILE_ORDER = [
	"types.ts",
	"geometry.ts",
	"motion.ts",
	"floating-rovo-button-click-suppression.ts",
	"persistent-bar.tsx",
	"nudge.tsx",
	"onboarding-panel.tsx",
	"surface.tsx",
	"index.tsx",
];
const FLOATING_ROVO_BUTTON_SOURCE = fs
	.readdirSync(FLOATING_ROVO_BUTTON_DIR)
	.filter((name) => /\.tsx?$/u.test(name) && !/\.test\.tsx?$/u.test(name))
	.sort((first, second) => {
		const firstRank = FLOATING_ROVO_BUTTON_FILE_ORDER.indexOf(first);
		const secondRank = FLOATING_ROVO_BUTTON_FILE_ORDER.indexOf(second);

		if (firstRank !== secondRank) {
			return (firstRank === -1 ? Number.MAX_SAFE_INTEGER : firstRank)
				- (secondRank === -1 ? Number.MAX_SAFE_INTEGER : secondRank);
		}

		return first.localeCompare(second);
	})
	.map((name) => fs.readFileSync(path.join(FLOATING_ROVO_BUTTON_DIR, name), "utf8"))
	.join("\n");
const ROVO_CANVAS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../blocks/rovo-canvas/components/rovo-canvas.tsx"),
	"utf8",
);
const ROVO_CANVAS_HEADER_SOURCE = fs.readFileSync(
	path.join(__dirname, "../blocks/rovo-canvas/components/rovo-canvas-header.tsx"),
	"utf8",
);

test("hideFloatingRovo suppresses the layout-owned floating chat surface", () => {
	assert.match(PROJECT_LAYOUT_SOURCE, /defaultSidebarOpen\?: boolean;/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /defaultSidebarOpen = true/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /<TopNavigation[\s\S]*defaultSidebarOpen=\{defaultSidebarOpen\}/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /settingsIconOnly\?: boolean;/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /settingsIconOnly=\{settingsIconOnly\}/u);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/const shouldHideRovoAction = hideRovoAction \|\| isRovoCanvasOpen;/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/const showFloatingChat = !isEmbedded && !hideFloatingRovo && !shouldHideRovoAction && isFloatingChatActive;/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/const showFloatingRovoButton = !isEmbedded && !hideFloatingRovo && !shouldHideRovoAction;/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/embeddedHeight\?: "parent" \| "viewport";[\s\S]*embeddedHeight = "viewport"/u,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/const embeddedShellHeight = embeddedHeight === "parent" \? "100%" : "100dvh";[\s\S]*minHeight: isEmbedded \? embeddedShellHeight : "100vh",[\s\S]*height: isEmbedded \? embeddedShellHeight : "100vh",/u,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/height: isEmbedded \? "100%" : undefined,[\s\S]*overflow: "auto",/u,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/\{showFloatingChat \? \(\s*<RovoFloatingChat[\s\S]*\/>\s*\) : null\}/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/rovoButtonSuggestion\?: FloatingRovoButtonSuggestion \| null;/u,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/rovoButtonOnboarding\?: FloatingRovoButtonOnboardingConfig \| null;/u,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<FloatingRovoButton[\s\S]*key="floating-rovo-button"[\s\S]*product=\{product\}[\s\S]*embedded=\{isEmbedded\}[\s\S]*suggestion=\{rovoButtonSuggestion\}[\s\S]*onboarding=\{rovoButtonOnboarding\}[\s\S]*\/>/u,
	);
});

test("project layout hides Rovo shell actions while any Rovo Canvas is open", () => {
	assert.match(PROJECT_LAYOUT_SOURCE, /function useIsRovoCanvasOpen\(\): boolean/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /document\.documentElement\.dataset\.rovoCanvasOpen === "true"/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /new MutationObserver\(updateRovoCanvasOpen\)/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /attributeFilter: \["data-rovo-canvas-open"\]/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /hideRovoAction=\{shouldHideRovoAction\}/u);
	assert.match(PROJECT_LAYOUT_SOURCE, /!\s*shouldHideRovoAction \? \(/u);
});

test("Rovo Canvas publishes a document-level open flag for shell handoff", () => {
	assert.match(ROVO_CANVAS_SOURCE, /const ROVO_CANVAS_OPEN_INSTANCES_KEY = "__vpkRovoCanvasOpenInstances";/u);
	assert.match(ROVO_CANVAS_SOURCE, /function getActiveRovoCanvasInstances\(\): Set<symbol>/u);
	assert.match(ROVO_CANVAS_SOURCE, /globalScope\[ROVO_CANVAS_OPEN_INSTANCES_KEY\] \?\?= new Set<symbol>\(\);/u);
	assert.match(ROVO_CANVAS_SOURCE, /document\.documentElement\.dataset\.rovoCanvasOpen = "true";/u);
	assert.match(ROVO_CANVAS_SOURCE, /delete document\.documentElement\.dataset\.rovoCanvasOpen;/u);
	assert.match(ROVO_CANVAS_SOURCE, /activeRovoCanvasInstances\.add\(instanceId\);/u);
	assert.match(ROVO_CANVAS_SOURCE, /getActiveRovoCanvasInstances\(\)\.delete\(instanceId\);/u);
});

test("Rovo Canvas hides the view switcher for single-view artefacts", () => {
	assert.match(
		ROVO_CANVAS_SOURCE,
		/resolvedViews\.length > 1 \? \(\s*<RovoCanvasViewSwitcher views=\{resolvedViews\} \/>\s*\) : \(\s*<div aria-hidden="true" \/>\s*\)/u,
	);
});

test("Rovo Canvas renders artefact identity text instead of an artefact dropdown", () => {
	assert.match(ROVO_CANVAS_SOURCE, /function RovoCanvasArtefactIdentity/u);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/<RovoCanvasArtefactIdentity[\s\S]*label=\{resolvedArtefactLabel\}[\s\S]*metadata=\{artefactMetadata\}/u,
	);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/<CardDescription className="line-clamp-2 text-xs leading-4">\{metadata\}<\/CardDescription>/u,
	);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/className="grid min-h-\[60px\] shrink-0 grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\] items-center border-b border-border bg-surface px-4 py-3"/u,
	);
	assert.doesNotMatch(ROVO_CANVAS_SOURCE, /className="grid h-12 shrink-0/u);
	assert.doesNotMatch(ROVO_CANVAS_SOURCE, /aria-label="Choose artefact surface"/u);
	assert.doesNotMatch(ROVO_CANVAS_SOURCE, /DropdownMenuTrigger[\s\S]*resolvedArtefactLabel/u);
});

test("Rovo Canvas header keeps Rovo as static text without the agent selector", () => {
	assert.match(ROVO_CANVAS_HEADER_SOURCE, /function RovoCanvasBrand\(\): React\.ReactElement/u);
	assert.match(ROVO_CANVAS_HEADER_SOURCE, /import \{ RovoColorIcon \} from "@\/components\/ui\/logo";[\s\S]*<RovoColorIcon size="xxsmall" \/>/u);
	assert.match(ROVO_CANVAS_HEADER_SOURCE, /<span className="font-semibold">Rovo<\/span>/u);
	assert.match(ROVO_CANVAS_HEADER_SOURCE, /<RovoCanvasBrand \/>/u);
	assert.doesNotMatch(ROVO_CANVAS_HEADER_SOURCE, /RovoAppBrand/u);
	assert.doesNotMatch(ROVO_CANVAS_HEADER_SOURCE, /Select Rovo agent/u);
	assert.doesNotMatch(ROVO_CANVAS_HEADER_SOURCE, /ChevronDownIcon/u);
	assert.doesNotMatch(ROVO_CANVAS_HEADER_SOURCE, /AgentSelector/u);
});

test("Rovo Canvas version history entries expose selected state and selection callbacks", () => {
	assert.match(ROVO_CANVAS_SOURCE, /onVersionSelect\?: \(versionId: string\) => void;/u);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/function VersionHistoryPanel\(\{[\s\S]*onVersionSelect,[\s\S]*versions,/u,
	);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/aria-pressed=\{version\.isCurrent \? true : undefined\}[\s\S]*onClick=\{\(\) => onVersionSelect\?\.\(version\.id\)\}/u,
	);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/<VersionHistoryPanel[\s\S]*onVersionSelect=\{onVersionSelect\}[\s\S]*versions=\{versionHistory\}/u,
	);
});

test("Rovo Canvas select mode uses the shared artifact annotation layer", () => {
	assert.match(
		ROVO_CANVAS_SOURCE,
		/import \{ ArtifactAnnotationLayer \} from "@\/components\/ui-custom\/artifact";/u,
	);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/import \{ useArtifactAnnotations \} from "@\/components\/ui-custom\/hooks\/use-artifact-annotations";/u,
	);
	assert.match(ROVO_CANVAS_SOURCE, /annotationContainerRef = useRef<HTMLDivElement>\(null\)/u);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/useArtifactAnnotations\(\{[\s\S]*active: isAnnotationModeAvailable && isSelectMode,[\s\S]*containerRef: annotationContainerRef,/u,
	);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/ref=\{isActivePreviewView \? annotationContainerRef : undefined\}/u,
	);
	assert.match(
		ROVO_CANVAS_SOURCE,
		/<ArtifactAnnotationLayer[\s\S]*annotations=\{annotations\}[\s\S]*onAddComment=\{addComment\}[\s\S]*onDismissSelection=\{dismissSelection\}[\s\S]*onRemoveAnnotation=\{removeAnnotation\}[\s\S]*pendingSelection=\{pendingSelection\}/u,
	);
	assert.doesNotMatch(ROVO_CANVAS_SOURCE, /function SelectModeOverlay/u);
});

test("Rovo Canvas main artefact frame uses a border without elevation", () => {
	assert.match(
		ROVO_CANVAS_SOURCE,
		/<section className="flex min-h-\[420px\] min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:min-h-0">/u,
	);
	assert.doesNotMatch(
		ROVO_CANVAS_SOURCE,
		/<section className="[^"]*shadow-sm[^"]*">/u,
	);
});

test("floating Rovo button has an exit transition for canvas handoff", () => {
	// Split across two imports since the split: the surface owns the drag/morph
	// motion APIs, the entry component owns the presence + reduced-motion ones.
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/import \{[\s\S]*AnimatePresence,[\s\S]*animate,[\s\S]*motion,[\s\S]*useMotionValue,[\s\S]*type MotionStyle,[\s\S]*\} from "motion\/react";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/import \{ AnimatePresence, useReducedMotion \} from "motion\/react";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<motion\.button[\s\S]*exit=\{shouldReduceMotion \? \{ opacity: 0 \} : \{ opacity: 0, transition: \{ duration: 0\.08 \} \}\}/u,
	);
});

test("floating Rovo button can be dragged and snapped to a 4x4 viewport grid", () => {
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const FLOATING_ROVO_BUTTON_EDGE_GAP = 24;/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE = 4;/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function getFloatingRovoButtonSafeBounds\(rect: Pick<DOMRect, "width" \| "height">, viewportWidth: number, viewportHeight: number\)[\s\S]*const minLeft = FLOATING_ROVO_BUTTON_EDGE_GAP;[\s\S]*const maxLeft = Math\.max\(minLeft, viewportWidth - rect\.width - FLOATING_ROVO_BUTTON_EDGE_GAP\);[\s\S]*return \{ minLeft, minTop, maxLeft, maxTop \};/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/export type FloatingRovoButtonPositioning = "viewport" \| "container";[\s\S]*function getFloatingRovoButtonCoordinateSpace\([\s\S]*positioning: FloatingRovoButtonPositioning,[\s\S]*positioning === "container" && surface\.offsetParent instanceof HTMLElement[\s\S]*width: surface\.offsetParent\.clientWidth,[\s\S]*height: surface\.offsetParent\.clientHeight,[\s\S]*width: window\.innerWidth,[\s\S]*height: window\.innerHeight,/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function getFloatingRovoButtonLocalMeasurement\([\s\S]*const rect = surface\.getBoundingClientRect\(\);[\s\S]*const space = getFloatingRovoButtonCoordinateSpace\(surface, positioning\);[\s\S]*left: rect\.left - space\.left,[\s\S]*top: rect\.top - space\.top,/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function getFloatingRovoButtonSnapTargets\([\s\S]*const snapTargets: FloatingRovoButtonSnapTarget\[\] = \[\];[\s\S]*for \(let rowIndex = 0; rowIndex < FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE; rowIndex \+= 1\) \{[\s\S]*for \(let columnIndex = 0; columnIndex < FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE; columnIndex \+= 1\) \{[\s\S]*const left = minLeft \+ \(\(maxLeft - minLeft\) \* columnIndex\) \/ \(FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE - 1\);[\s\S]*const top = minTop \+ \(\(maxTop - minTop\) \* rowIndex\) \/ \(FLOATING_ROVO_BUTTON_SNAP_GRID_SIZE - 1\);[\s\S]*snapTargets\.push\(\{ left, top \}\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function getDefaultFloatingRovoButtonSnapTarget\([\s\S]*return snapTargets\[snapTargets\.length - 1\];/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function getNearestFloatingRovoButtonSnapTarget\([\s\S]*rect: Pick<DOMRect, "height" \| "left" \| "top" \| "width">,[\s\S]*const centerX = rect\.left \+ rect\.width \/ 2;[\s\S]*const centerY = rect\.top \+ rect\.height \/ 2;[\s\S]*const distance = Math\.hypot\(centerX - targetCenterX, centerY - targetCenterY\);[\s\S]*return closestTarget;/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function getFloatingRovoButtonDragConstraints\([\s\S]*origin: FloatingRovoButtonSnapTarget,[\s\S]*return \{[\s\S]*left: minLeft - origin\.left,[\s\S]*top: minTop - origin\.top,[\s\S]*right: maxLeft - origin\.left,[\s\S]*bottom: maxTop - origin\.top,[\s\S]*\};/u,
	);
	assert.doesNotMatch(
		FLOATING_ROVO_BUTTON_SOURCE,
		/FLOATING_ROVO_BUTTON_HOT_CORNER_RADIUS|getFloatingRovoButtonDropTarget/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const surfaceRef = useRef<HTMLDivElement \| null>\(null\);[\s\S]*const buttonX = useMotionValue\(0\);[\s\S]*const buttonY = useMotionValue\(0\);[\s\S]*const \[dragOrigin, setDragOrigin\] = useState<FloatingRovoButtonSnapTarget \| null>\(null\);[\s\S]*const \[dragConstraints, setDragConstraints\] = useState<FloatingRovoButtonDragConstraints>\(\{[\s\S]*bottom: 0,[\s\S]*left: 0,[\s\S]*right: 0,[\s\S]*top: 0,[\s\S]*\}\);[\s\S]*const dragPointerStartRef = useRef<FloatingRovoButtonDragStart \| null>\(null\);[\s\S]*const suppressDragClickStateRef = useLazyRef<FloatingRovoButtonClickSuppressionState>\(\(\) =>[\s\S]*createInitialClickSuppressionState\(\),[\s\S]*\);[\s\S]*const suppressDragClickTimeoutRef = useRef<number \| null>\(null\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const surfaceStyle: MotionStyle = \{[\s\S]*left: dragOrigin\.left,[\s\S]*top: dragOrigin\.top,[\s\S]*right: resolvedPlacement\.right,[\s\S]*bottom: resolvedPlacement\.bottom,[\s\S]*visibility: dragOrigin \? undefined : "hidden",/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const \{ rect, space \} = getFloatingRovoButtonLocalMeasurement\(surface, positioning\);[\s\S]*const target = placement[\s\S]*\? getClampedFloatingRovoButtonTarget\(rect, space\.width, space\.height\)[\s\S]*: getDefaultFloatingRovoButtonSnapTarget\(rect, space\.width, space\.height\);[\s\S]*buttonX\.set\(0\);[\s\S]*buttonY\.set\(0\);[\s\S]*setDragOrigin\(target\);[\s\S]*setDragConstraints\(getFloatingRovoButtonDragConstraints\(target, rect, space\.width, space\.height\)\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function FloatingRovoButtonInner\(\{[\s\S]*onDragMouseDown,[\s\S]*onDragPointerDown,[\s\S]*\}: Readonly<\{[\s\S]*onDragMouseDown: \(event: ReactMouseEvent<HTMLButtonElement>\) => void;[\s\S]*onDragPointerDown: \(event: ReactPointerEvent<HTMLButtonElement>\) => void;[\s\S]*onMouseDownCapture=\{onDragMouseDown\}[\s\S]*onPointerDownCapture=\{onDragPointerDown\}/u,
	);
	assert.doesNotMatch(FLOATING_ROVO_BUTTON_SOURCE, /useDragControls|dragControls|dragListener=\{false\}|drag=\{!onboardingOpen\}|dragConstraints=\{dragConstraints\}/u);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/import \{ RovoColorIcon \} from "@\/components\/ui\/logo";[\s\S]*<RovoColorIcon key="static-rovo-logo" size="small" \/>/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const handleDragPointerDown = useCallback\(\(event: ReactPointerEvent<HTMLElement>\) => \{[\s\S]*buttonX\.stop\(\);[\s\S]*buttonY\.stop\(\);[\s\S]*offsetX: buttonX\.get\(\),[\s\S]*offsetY: buttonY\.get\(\),/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const handleDragMouseDown = useCallback\(\(event: ReactMouseEvent<HTMLElement>\) => \{[\s\S]*pointerId: null,[\s\S]*x: event\.clientX,[\s\S]*y: event\.clientY,/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const updateDragPosition = useCallback\(\(clientX: number, clientY: number, pointerId\?: number\) => \{[\s\S]*const deltaX = clientX - start\.x;[\s\S]*const deltaY = clientY - start\.y;[\s\S]*dragDistance <= FLOATING_ROVO_BUTTON_DRAG_CLICK_THRESHOLD[\s\S]*armDragClickSuppression\(\);[\s\S]*buttonX\.set\(clampFloatingRovoButtonValue\(start\.offsetX \+ deltaX, dragConstraints\.left, dragConstraints\.right\)\);[\s\S]*buttonY\.set\(clampFloatingRovoButtonValue\(start\.offsetY \+ deltaY, dragConstraints\.top, dragConstraints\.bottom\)\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const endDrag = useCallback\(\(pointerId\?: number\) => \{[\s\S]*dragPointerStartRef\.current = null;[\s\S]*scheduleDragClickSuppressionReset\(\);[\s\S]*snapToNearestGridTarget\(\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/document\.addEventListener\("pointermove", handleDocumentPointerMove, true\);[\s\S]*document\.addEventListener\("mousemove", handleDocumentMouseMove, true\);[\s\S]*document\.removeEventListener\("pointermove", handleDocumentPointerMove, true\);[\s\S]*document\.removeEventListener\("mousemove", handleDocumentMouseMove, true\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const handleDocumentPointerEnd = \(event: PointerEvent\) => \{[\s\S]*updateDragPosition\(event\.clientX, event\.clientY, event\.pointerId\);[\s\S]*endDrag\(event\.pointerId\);[\s\S]*const handleDocumentMouseEnd = \(event: MouseEvent\) => \{[\s\S]*updateDragPosition\(event\.clientX, event\.clientY\);[\s\S]*endDrag\(\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const target = getNearestFloatingRovoButtonSnapTarget\(rect, space\.width, space\.height\);[\s\S]*setDragConstraints\(getFloatingRovoButtonDragConstraints\(dragOrigin, rect, space\.width, space\.height\)\);[\s\S]*buttonX\.jump\(buttonX\.get\(\)\);[\s\S]*buttonY\.jump\(buttonY\.get\(\)\);[\s\S]*animate\(buttonX, target\.left - dragOrigin\.left, dragSnapTransition\);[\s\S]*animate\(buttonY, target\.top - dragOrigin\.top, dragSnapTransition\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const handleButtonClick = useCallback\(\(\) => \{[\s\S]*if \(handleSuppressibleClick\(\)\) \{[\s\S]*return;[\s\S]*\}[\s\S]*onButtonClick\(\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/document\.addEventListener\("click", handleDocumentClick, true\);[\s\S]*document\.removeEventListener\("click", handleDocumentClick, true\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/ref=\{surfaceRef\}[\s\S]*onClickCapture=\{handleClickCapture\}[\s\S]*whileHover=\{hoverScale\}[\s\S]*whileTap=\{tapScale\}/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<FloatingRovoButtonInner[\s\S]*onClick=\{handleButtonClick\}[\s\S]*onDragMouseDown=\{handleDragMouseDown\}[\s\S]*onDragPointerDown=\{handleDragPointerDown\}[\s\S]*onLogoPointerEnter=\{handleLogoPointerEnter\}[\s\S]*logoAnimating=\{logoAnimating\}/u,
	);
});

test("floating Rovo button default right reads the untracked panel width var", () => {
	// A hardcoded `right: 24px` parks the launcher on a 360px docked rail.
	// The default placement adds `--untracked-panel-width` (0px when unset) so
	// a host can push the button without inventing a second positioning system.
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/export const FLOATING_ROVO_BUTTON_END_INSET_VAR = "--untracked-panel-width";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const DEFAULT_BUTTON_RIGHT = `calc\(\$\{FLOATING_ROVO_BUTTON_EDGE_GAP\}px \+ var\(\$\{FLOATING_ROVO_BUTTON_END_INSET_VAR\}, 0px\)\)`;/u,
	);
	assert.doesNotMatch(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const DEFAULT_BUTTON_RIGHT = "24px";/u,
	);
});

test("floating Rovo button applies collapsed elevation to the button surface", () => {
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<motion\.button[\s\S]*className="flex h-full w-full items-center justify-center bg-bg-neutral-bold"[\s\S]*boxShadow: token\("elevation\.shadow\.overlay"\)/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const surfaceOwnsElevation = cardOpen \|\| insightsStage === "pill";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/boxShadow: surfaceOwnsElevation \? token\("elevation\.shadow\.overlay"\) : undefined/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const cardOpen = onboardingOpen \|\| insightsStage === "card";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/cardOpen\s*\?\s*"w-\[295px\] max-w-\[calc\(100vw-32px\)\] overflow-hidden"\s*:\s*insightsStage === "pill"\s*\?\s*"h-12 w-fit max-w-\[calc\(100vw-32px\)\] overflow-hidden"\s*:\s*"size-12"/u,
	);
});

test("floating Rovo button animates the logo once on first hover", () => {
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/import \{ AnimatedRovo \} from "@\/components\/ui-custom\/animated-rovo";[\s\S]*import \{ RovoColorIcon \} from "@\/components\/ui\/logo";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const FLOATING_ROVO_BUTTON_LOGO_CYCLE_S = 2\.5;[\s\S]*const FLOATING_ROVO_BUTTON_LOGO_CYCLE_MS = FLOATING_ROVO_BUTTON_LOGO_CYCLE_S \* 1000;/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const logoAnimationPlayedRef = useRef\(false\);[\s\S]*const \[logoAnimating, setLogoAnimating\] = useState\(false\);[\s\S]*const handleLogoPointerEnter = useCallback\(\(event: ReactPointerEvent<HTMLButtonElement>\) => \{[\s\S]*event\.pointerType !== "mouse" \|\| shouldReduceMotion \|\| logoAnimationPlayedRef\.current[\s\S]*logoAnimationPlayedRef\.current = true;[\s\S]*setLogoAnimating\(true\);[\s\S]*setLogoAnimating\(false\);[\s\S]*FLOATING_ROVO_BUTTON_LOGO_CYCLE_MS/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/onPointerEnter=\{onLogoPointerEnter\}[\s\S]*logoAnimating \? \([\s\S]*<AnimatedRovo\.Root[\s\S]*preset="full-cycle"[\s\S]*cycleDurationS=\{FLOATING_ROVO_BUTTON_LOGO_CYCLE_S\}[\s\S]*<RovoColorIcon key="static-rovo-logo" size="small" \/>/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<FloatingRovoButtonInner[\s\S]*onLogoPointerEnter=\{handleLogoPointerEnter\}[\s\S]*logoAnimating=\{logoAnimating\}/u,
	);
});

test("floating Rovo button can render a collapsed proactive suggestion nudge", () => {
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/export interface FloatingRovoButtonSuggestion \{[\s\S]*id: string;[\s\S]*label: string;[\s\S]*onSelect: \(\) => void;[\s\S]*onDismiss\?: \(\) => void;/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/import CrossIcon from "@atlaskit\/icon\/core\/cross";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/export interface FloatingRovoButtonPlacement \{[\s\S]*right\?: string;[\s\S]*bottom\?: string;[\s\S]*export type FloatingRovoButtonPositioning = "viewport" \| "container";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/placement \? null : "right-\[84px\] bottom-7"/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/right: `calc\(\$\{resolvedPlacement\.right\} \+ 60px\)`[\s\S]*bottom: `calc\(\$\{resolvedPlacement\.bottom\} \+ 4px\)`/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/initial=\{\{ opacity: 0, scaleX: 0\.24, x: 52 \}\}[\s\S]*animate=\{\{ opacity: 1, scaleX: 1, x: 0 \}\}[\s\S]*exit=\{\{ opacity: 0, scaleX: 0\.24, x: 52 \}\}/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/\{suggestion && shouldShowButton && !onboardingOpen && insightsStage === "hidden" \? \([\s\S]*<FloatingRovoButtonNudge[\s\S]*key=\{suggestion\.id\}[\s\S]*placement=\{placement\}[\s\S]*positioning=\{positioning\}[\s\S]*suggestion=\{suggestion\}[\s\S]*\/>[\s\S]*\) : null\}/u,
	);
});

test("floating Rovo button persistent bar actions are 32px square", () => {
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/"pointer-events-auto absolute left-1\/2 z-\[505\] flex cursor-default flex-col items-center gap-1 rounded-2xl bg-surface-raised p-2"/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<motion\.button[\s\S]*aria-label=\{item\.ariaLabel\}[\s\S]*className="relative flex size-8 items-center justify-center rounded-xl/u,
	);
	assert.doesNotMatch(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<motion\.button[\s\S]*aria-label=\{item\.ariaLabel\}[\s\S]*className="relative flex size-9 items-center justify-center rounded-xl/u,
	);
});

test("floating Rovo button persistent bar can show item tooltips", () => {
	assert.match(FLOATING_ROVO_BUTTON_SOURCE, /tooltipLabel\?: string;/u);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/import \{ Tooltip, TooltipContent, TooltipProvider, TooltipTrigger \} from "@\/components\/ui\/tooltip";/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<TooltipProvider delay=\{0\}>[\s\S]*<TooltipTrigger render=\{actionButton\} \/>[\s\S]*<TooltipContent side=\{side\}>\{item\.tooltipLabel\}<\/TooltipContent>/u,
	);
});

test("floating Rovo button supports demo initial placement while preserving default chat behavior", () => {
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/ariaLabel\?: string;[\s\S]*placement\?: FloatingRovoButtonPlacement;[\s\S]*positioning\?: FloatingRovoButtonPositioning;[\s\S]*onButtonClick\?: \(\) => void;/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/placement[\s\S]*\? getClampedFloatingRovoButtonTarget\(rect, space\.width, space\.height\)[\s\S]*: getDefaultFloatingRovoButtonSnapTarget\(rect, space\.width, space\.height\)/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/left: dragOrigin\.left,[\s\S]*top: dragOrigin\.top,[\s\S]*right: resolvedPlacement\.right,[\s\S]*bottom: resolvedPlacement\.bottom/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const resolvedAriaLabel = ariaLabel \?\? \(shouldOpenOnboardingFromButton \? "Open onboarding" : "Open Rovo"\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const shouldSuppressSurface = embedded \|\| product === "rovo" \|\| product === "studio";[\s\S]*const insightsCardOpen = insightsStage === "card";[\s\S]*const shouldRenderSurface = \(shouldShowButton \|\| onboardingOpen \|\| insightsCardOpen\) && \(forceVisible \|\| !shouldSuppressSurface\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/if \(onButtonClick\) \{[\s\S]*onButtonClick\(\);[\s\S]*return;[\s\S]*\}[\s\S]*if \(shouldOpenOnboardingFromButton\) \{[\s\S]*setOnboardingOpen\(true\);[\s\S]*return;[\s\S]*\}[\s\S]*openChat\("floating"\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/ariaLabel=\{resolvedAriaLabel\}/u,
	);
});

test("floating Rovo button daily insights", () => {
	// Stage machine: the pill advances to the card, and dismissing collapses the
	// affordance without touching the primary action — dismissed is not read.
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/if \(insightsStage === "pill"\) \{[\s\S]*setInsightsStage\("card"\);[\s\S]*return;[\s\S]*\}[\s\S]*openChat\("floating"\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const handleInsightsDismiss = useCallback\(\(\) => \{[\s\S]*setInsightsStage\("hidden"\);[\s\S]*activeInsights\?\.onDismiss\?\.\(\);[\s\S]*\}, \[activeInsights, setInsightsStage\]\);/u,
	);
	// The primary label carries the overflow count, so there is no separate
	// "+N more" control. These three facts are the whole contract: an explicit
	// label wins, overflow names the total, and no overflow falls back.
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const primaryActionLabel = insights\.primaryActionLabel\s*\?\?\s*formatFloatingRovoButtonInsightPrimaryAction\(insights\.count, overflowCount\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function formatFloatingRovoButtonInsightPrimaryAction\(count: number, overflowCount: number\): string \{[\s\S]*if \(overflowCount <= 0\) \{[\s\S]*return "Open insights";[\s\S]*\}[\s\S]*return count === 1 \? "Open insight" : `Open all \$\{count\} insights`;/u,
	);
	assert.doesNotMatch(FLOATING_ROVO_BUTTON_SOURCE, /formatFloatingRovoButtonInsightOverflow|\+\$\{overflowCount\} more/u);
	// Focus restore is *proved* by focus-restore.test.js, which exercises the
	// real function. These assertions only prove it is wired in: that the effect
	// runs off the committed `cardOpen` transition (not the close handler, and
	// not the insights stage alone — the onboarding panel shares this path), and
	// that both replacement controls actually carry the refs it reads.
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const previousCardOpen = previousCardOpenRef\.current;[\s\S]*previousCardOpenRef\.current = cardOpen;[\s\S]*restoreFloatingRovoButtonFocus\([\s\S]*previousCardOpen,[\s\S]*cardOpen,[\s\S]*insightsStage === "pill" \? insightsPillRef\.current : collapsedButtonRef\.current,[\s\S]*\}, \[cardOpen, insightsStage\]\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<FloatingRovoButtonDailyInsightsPill[\s\S]*ref=\{insightsPillRef\}/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<FloatingRovoButtonInner[\s\S]*ref=\{collapsedButtonRef\}/u,
	);
});

test("floating Rovo button can morph into an onboarding Spotlight panel", () => {
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/export interface FloatingRovoButtonOnboardingConfig \{[\s\S]*title: string;[\s\S]*agentName: string;[\s\S]*primaryActionLabel: string;[\s\S]*openOnButtonClick\?: boolean;[\s\S]*onPrimaryAction\?: \(\) => void;/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/function FloatingRovoButtonOnboardingPanel/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/data-testid="floating-rovo-button-onboarding"/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const shouldOpenOnboardingFromButton = Boolean\(onboarding && \(onboarding\.openOnButtonClick \?\? true\)\);/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/aria-label=\{closeLabel\}[\s\S]*autoFocus/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/const AGENT_AVATAR_HEXAGON_PATH = "M19\.01 0\.922148/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/<path d=\{AGENT_AVATAR_HEXAGON_PATH\} fill="none" stroke="white" strokeWidth=\{2\} vectorEffect="non-scaling-stroke" \/>/u,
	);
	assert.match(
		FLOATING_ROVO_BUTTON_SOURCE,
		/event\.key === "Escape"[\s\S]*handleClose\(\);/u,
	);
});

test("project layout forwards chat context bars to sidebar and floating chat", () => {
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/chatContextBar\?: ChatContextBarDescriptor \| null;/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/customAgentTabs\?: ChatPanelCustomAgentTabs;/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<ChatPanel[\s\S]*chatContextBar=\{chatContextBar\}/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<ChatPanel[\s\S]*customAgentTabs=\{customAgentTabs\}/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<ChatPanel[\s\S]*abortOnUnmount=\{false\}[\s\S]*chatContextBar=\{chatContextBar\}/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<RovoFloatingChat[\s\S]*chatContextBar=\{chatContextBar\}/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<RovoFloatingChat[\s\S]*customAgentTabs=\{customAgentTabs\}/,
	);
});

test("project layout forwards artifact dialog lifecycle to both chat surfaces", () => {
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/onArtifactDialogOpen\?: \(\) => void;/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/preserveFloatingSurfaceOnArtifactDialogOpen\?: boolean;/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<ChatPanel[\s\S]*onArtifactDialogOpen=\{onArtifactDialogOpen\}[\s\S]*preserveFloatingSurfaceOnArtifactDialogOpen=\{preserveFloatingSurfaceOnArtifactDialogOpen\}/,
	);
	assert.match(
		PROJECT_LAYOUT_SOURCE,
		/<RovoFloatingChat[\s\S]*onArtifactDialogOpen=\{onArtifactDialogOpen\}[\s\S]*preserveFloatingSurfaceOnArtifactDialogOpen=\{preserveFloatingSurfaceOnArtifactDialogOpen\}/,
	);
});
