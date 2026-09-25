const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { humanAgentAvatarGeometry, humanAgentAvatarPositions } = require("../ui-custom/human-agent-avatar-geometry.ts");
const { isAvatarOverlayType } = require("./avatar-overlay.ts");
const { AVATAR_HEXAGON_REFERENCE_SIZE, AVATAR_HEXAGON_REFERENCE_RADIUS, avatarHexagonCornerRadius, avatarHexagonPoints, avatarHexagonClip, avatarHexagonBorderClip, avatarHexagonStatusAnchor } = require("./avatar-hexagon.ts");
const { humanAgentAvatarSizeSwapProgress } = require("../ui-custom/human-agent-avatar-motion-config.ts");
const { getCodingAgentLogoFrame, getCodingAgentVisual } = require("../ui-custom/agent-avatar-coding-appearance.ts");
const { thirdPartyLogoSrc } = require("./data/logo-third-party-data.ts");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");

const AVATAR_SOURCE = fs.readFileSync(path.join(__dirname, "avatar.tsx"), "utf8");
const AVATAR_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "website", "demos", "ui", "avatar-demo.tsx"),
	"utf8",
);
const AVATAR_DETAILS_SOURCE = readDetailCategorySource("ui");
const REGISTRY_SOURCE = readWebsiteRegistrySource();
const AGENT_AVATAR_VISUAL_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "ui-custom", "agent-avatar-visual.tsx"),
	"utf8",
);

test("coding agent appearance preserves local artwork and the requested brand canvases", () => {
	assert.deepEqual(getCodingAgentVisual("claude"), { backgroundColor: "#d97757", whiteGlyph: true });
	assert.deepEqual(getCodingAgentVisual("openai-codex"), { artwork: "local", logoClassName: "scale-125" });
	assert.deepEqual(getCodingAgentVisual("openai-codex", 20), { artwork: "glyph", logoFrameSizePx: 12 });
	assert.deepEqual(getCodingAgentVisual("cursor"), { artwork: "local", backgroundColor: "#14120B" });
	assert.deepEqual(getCodingAgentVisual("github-copilot"), { backgroundColor: "#000000", whiteGlyph: true });
	assert.equal(getCodingAgentVisual("slack"), undefined);
	assert.equal(getCodingAgentVisual(undefined), undefined);
	for (const name of ["cursor", "openai-codex"]) {
		assert.ok(fs.existsSync(path.join(process.cwd(), "public", thirdPartyLogoSrc(name))));
	}
});

test("coding agents have a registered avatar demo and opt into the coding appearance", () => {
	assert.match(AVATAR_DEMO_SOURCE, /export function AvatarDemoCodingAgents\(\)/);
	assert.match(AVATAR_DEMO_SOURCE, /<AgentAvatarVisual appearance="coding" brandName=\{brandName\}/);
	assert.match(AVATAR_DETAILS_SOURCE, /title: "Coding agents"/);
	assert.match(AVATAR_DETAILS_SOURCE, /demoSlug: "avatar-demo-coding-agents"/);
	assert.match(REGISTRY_SOURCE, /default: mod\.AvatarDemoCodingAgents/);
	for (const brand of ["claude", "openai-codex", "github-copilot", "cursor"]) {
		assert.ok(AVATAR_DEMO_SOURCE.includes(`<AgentAvatarVisual appearance="coding" brandName="${brand}"`));
	}
});

test("coding logo frames enlarge the marks without changing compact avatar sizes", () => {
	assert.deepEqual(getCodingAgentLogoFrame(20), { size: "xxsmall" });
	assert.deepEqual(getCodingAgentLogoFrame(32), { size: "small" });
	assert.deepEqual(getCodingAgentLogoFrame(40), { size: "medium" });
	assert.deepEqual(getCodingAgentLogoFrame(48), { size: "large" });
	for (const size of [12, 16, 24, 30]) assert.equal(getCodingAgentLogoFrame(size), undefined);
});

test("avatar overlay recognition survives refreshed function identities and minification", () => {
	for (const name of ["AvatarBadge", "AvatarCompanyBadge", "AvatarProjectBadge", "AvatarPresenceIndicator", "AvatarStatusIndicator"]) {
		const oldType = { [name]: function () {} }[name];
		const refreshedType = Object.assign(function a() {}, { displayName: name });
		assert.notEqual(oldType, refreshedType);
		assert.equal(isAvatarOverlayType(oldType), true);
		assert.equal(isAvatarOverlayType(refreshedType), true);
	}
	assert.equal(isAvatarOverlayType("span"), false);
	assert.equal(isAvatarOverlayType(function AvatarImage() {}), false);
	assert.equal(isAvatarOverlayType(function AvatarFallback() {}), false);
	assert.equal(isAvatarOverlayType(null), false);
});

test("avatar stacking switches only for a size crossover inside the turn", () => {
	assert.equal(humanAgentAvatarSizeSwapProgress(30, 16, 32, 12, 1), Infinity);
	assert.equal(humanAgentAvatarSizeSwapProgress(30, 16, 24, 20, 1), Infinity);
	assert.equal(humanAgentAvatarSizeSwapProgress(30, 16, 16, 30, 0), Infinity);
	assert.equal(humanAgentAvatarSizeSwapProgress(30, 16, 16, 30, 1), 0.5);
	assert.equal(humanAgentAvatarSizeSwapProgress(16, 30, 30, 16, 1), 0.5);
});

test("human-first compact geometry swaps primary and badge footprints at both authored sizes", () => {
	for (const [frameSize, humanSize, agentSize, inset] of [[24, 24, 12, 0], [32, 30, 16, 1]]) {
		const geometry = humanAgentAvatarGeometry(frameSize, false);
		assert.deepEqual(geometry, { frameSize, humanSize, agentSize, humanInset: inset, agentInset: -2 });
		assert.deepEqual(humanAgentAvatarPositions(geometry, false), {
			human: { left: inset, top: inset },
			agent: { right: -2, bottom: -2 },
		});
	}
});
const ENTITY_CARD_AGENT_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "ui-custom", "entity-card", "agent.tsx"),
	"utf8",
);
const AGENT_CARD_SOURCE = fs.readFileSync(
	path.join(__dirname, "..", "blocks", "agent-card", "components", "agent-card.tsx"),
	"utf8",
);
const PRIMARY_AVATAR_PATH = path.join(
	__dirname,
	"..",
	"..",
	"public",
	"avatar-user",
	"venn",
	"venn.png",
);

function readPngDimensions(filePath) {
	const buffer = fs.readFileSync(filePath);
	assert.equal(buffer.toString("ascii", 1, 4), "PNG");
	assert.equal(buffer.toString("ascii", 12, 16), "IHDR");

	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
		bytes: buffer.byteLength,
	};
}

test("AvatarUnassigned exposes grey person and agent avatar states", () => {
	assert.match(AVATAR_SOURCE, /import AiAgentIcon from "@atlaskit\/icon\/core\/ai-agent"/);
	assert.match(AVATAR_SOURCE, /import PersonIcon from "@atlaskit\/icon\/core\/person"/);
	assert.doesNotMatch(AVATAR_SOURCE, /@atlaskit\/icon\/core\/person-avatar/);
	assert.match(AVATAR_SOURCE, /type AvatarUnassignedKind = "person" \| "agent"/);
	assert.match(AVATAR_SOURCE, /function AvatarUnassigned\(/);
	assert.match(
		AVATAR_SOURCE,
		/"items-center justify-center text-icon-subtle after:border-border"/,
	);
	assert.match(AVATAR_SOURCE, /!isAgent && "bg-muted"/);
	assert.match(AVATAR_SOURCE, /shape=\{isAgent \? "hexagon" : "circle"\}/);
	assert.match(
		AVATAR_SOURCE,
		/render=\{\s*<IconComponent[\s\S]*color="currentColor"[\s\S]*label=""[\s\S]*size=\{avatarUnassignedIconSizeMap\[resolvedSize\]\}/,
	);
	assert.match(AVATAR_SOURCE, /AvatarUnassigned,/);
	assert.match(AVATAR_SOURCE, /type AvatarUnassignedProps,/);
});

test("hexagon avatars clip an inner frame so corner overlays render unclipped", () => {
	assert.equal(AVATAR_HEXAGON_REFERENCE_SIZE, 24);
	assert.equal(AVATAR_HEXAGON_REFERENCE_RADIUS, 4);
	assert.match(AVATAR_SOURCE, /const HEXAGON_CLIP = avatarHexagonClip\(\)/);
	assert.match(AVATAR_SOURCE, /hexagon: "isolate overflow-visible after:border-0"/);
	assert.doesNotMatch(AVATAR_SOURCE, /hexagon: `\$\{HEXAGON_CLIP\} after:border-0`/);
	assert.match(
		AVATAR_SOURCE,
		/<span\s+className="relative flex size-full items-center justify-center overflow-hidden"\s+style=\{\{ clipPath: HEXAGON_CLIP \}\}\s+data-slot="avatar-hexagon-artwork"/,
	);
	assert.match(AVATAR_SOURCE, /\{status \? <AvatarStatusIndicator status=\{status\} \/> : null\}/);
	assert.doesNotMatch(AVATAR_SOURCE, /isAgent && HEXAGON_CLIP/);
	assert.match(AVATAR_SOURCE, /isAgent && "size-full bg-muted"/);
	assert.match(AVATAR_SOURCE, /React\.isValidElement\(child\) && isAvatarOverlayType\(child\.type\)/);
	assert.match(AVATAR_SOURCE, /function AvatarHexagonBorder\(/);
	assert.match(AVATAR_SOURCE, /text-border!/);
	assert.match(AVATAR_SOURCE, /style=\{\{ clipPath: separator \? HEXAGON_SEPARATOR_CLIP : HEXAGON_BORDER_CLIP \}\}/);
	assert.match(AVATAR_SOURCE, /<AvatarHexagonBorder \/>/);
	assert.match(AVATAR_SOURCE, /const HEXAGON_SEPARATOR_CLIP = avatarHexagonClip\(2\)/);
	assert.match(AVATAR_SOURCE, /data-slot="avatar-hexagon-artwork"[\s\S]*?<AvatarHexagonBorder \/>\s*<\/span>/);
});

test("hexagon corners scale through 4px at 24px and 6px at 32px while borders remain 1px inset", () => {
	for (const [size, radius] of [[12, 1], [16, 2], [20, 3], [24, 4], [30, 5.5], [32, 6], [40, 8], [48, 10], [96, 22]]) {
		assert.equal(avatarHexagonCornerRadius(size), radius);
		for (const inset of [0, 1]) {
			const points = avatarHexagonPoints(inset);
			const resolved = points.map(p => ({ x: p.xPercent * size / 100 + p.xPixels, y: p.yPercent * size / 100 + p.yPixels }));
			for (const p of resolved.slice(0, 7)) {
				assert.ok(Math.abs(Math.hypot(p.x - size / 2, p.y - radius) - (radius - inset)) < 0.00001);
			}
			assert.ok(Math.abs(Math.min(...resolved.map(p => p.y)) - inset) < 0.00001);
			assert.ok(Math.abs(Math.max(...resolved.map(p => p.y)) - (size - inset)) < 0.00001);
			assert.ok(resolved.every(p => p.x >= 0 && p.x <= size));
		}
		const expanded = avatarHexagonPoints(0, 2).slice(0, 7).map(p => ({ x: p.xPercent * (size + 4) / 100 + p.xPixels, y: p.yPercent * (size + 4) / 100 + p.yPixels }));
		for (const p of expanded) {
			assert.ok(Math.abs(Math.hypot(p.x - (size + 4) / 2, p.y - radius - 2) - radius - 2) < 0.00001);
		}
	}
	assert.match(avatarHexagonClip(), /^polygon\(/);
	assert.match(avatarHexagonBorderClip(), /^polygon\(evenodd,/);
});

test("hexagon status anchor derives from the rounded top-right corner geometry", () => {
	const point = avatarHexagonPoints()[8];
	const anchor = avatarHexagonStatusAnchor();
	assert.deepEqual(
		{ xPercent: anchor.xPercent, xPixels: anchor.xPixels, yPercent: anchor.yPercent, yPixels: anchor.yPixels },
		point,
	);
	assert.match(AVATAR_SOURCE, /--avatar-hexagon-status-left/);
	assert.match(AVATAR_SOURCE, /--avatar-hexagon-status-top/);
});

test("AvatarGroupCount maps plus icon size from the group size", () => {
	assert.match(AVATAR_SOURCE, /function avatarGroupCountIconSize\(size: AvatarSize \| undefined\): "small" \| "medium"/);
	assert.match(AVATAR_SOURCE, /if \(size === "xs" \|\| size === "sm"\) \{\s*return "small"/);
	assert.match(AVATAR_SOURCE, /function avatarGroupCountIconSize[\s\S]*return "medium"/);
	assert.match(AVATAR_SOURCE, /React\.cloneElement\(child, \{ size: iconSize \}/);
	assert.doesNotMatch(
		AVATAR_SOURCE,
		/group-has-data-\[size=lg\]\/avatar-group:\[&_\[data-slot=icon\]\]:size-5/,
	);
});

test("group-with-icon-count demo plus size comes from AvatarGroup, not a global small", () => {
	assert.match(
		AVATAR_DEMO_SOURCE,
		/export function AvatarDemoGroupWithIconCount\([\s\S]*<AvatarGroup size="sm">[\s\S]*<AvatarGroupCount>\s*<PlusIcon \/>/,
	);
	assert.match(
		AVATAR_DEMO_SOURCE,
		/<AvatarGroup size="default">[\s\S]*<AvatarGroupCount>\s*<PlusIcon \/>/,
	);
	assert.match(
		AVATAR_DEMO_SOURCE,
		/<AvatarGroup size="lg">[\s\S]*<AvatarGroupCount>\s*<PlusIcon \/>[\s\S]*export function AvatarDemoGroup\(/,
	);
	assert.doesNotMatch(
		AVATAR_DEMO_SOURCE,
		/<AvatarGroupCount>\s*<PlusIcon size="small" \/>\s*<\/AvatarGroupCount>/u,
	);
	assert.match(
		AVATAR_DEMO_SOURCE,
		/export function AvatarDemoGroupWithIconCount\([\s\S]*<AvatarGroup label="24px agent avatar group with icon count" size="sm">[\s\S]*AGENT_GROUP_AVATARS\.map[\s\S]*<AgentAvatarVisual[\s\S]*sizePx=\{24\}[\s\S]*<Avatar[\s\S]*shape="hexagon"[\s\S]*size="sm"[\s\S]*bg-bg-neutral text-icon-subtle[\s\S]*<PlusIcon size="small" \/>/u,
	);
	assert.match(
		AVATAR_DETAILS_SOURCE,
		/description: "Human and agent avatar groups with icon-based count indicators\."/u,
	);
});

test("avatar status indicator anchors to the top-right corner", () => {
	assert.match(
		AVATAR_SOURCE,
		/data-slot="avatar-status"[\s\S]*"ring-\[#FFFFFF\] absolute top-0 right-0 z-10 overflow-hidden rounded-full ring-2"/,
	);
	assert.match(
		AVATAR_SOURCE,
		/"group-data-\[shape=hexagon\]\/avatar:top-\(--avatar-hexagon-status-top\) group-data-\[shape=hexagon\]\/avatar:right-auto group-data-\[shape=hexagon\]\/avatar:left-\(--avatar-hexagon-status-left\) group-data-\[shape=hexagon\]\/avatar:-translate-x-1\/2 group-data-\[shape=hexagon\]\/avatar:-translate-y-1\/2"/,
	);
	assert.match(AVATAR_SOURCE, /avatarHexagonStatusAnchor\(\)/);
	assert.doesNotMatch(
		AVATAR_SOURCE,
		/data-slot="avatar-status"[\s\S]*absolute right-0 bottom-0/,
	);
});

test("avatar status indicators use simple glyphs on presence-style circular fills", () => {
	// Plain CheckMark/Cross/bang glyphs inside rounded-full colored fills; optical fit insets them.
	assert.match(AVATAR_SOURCE, /import CheckMarkIcon from "@atlaskit\/icon\/core\/check-mark"/);
	assert.match(AVATAR_SOURCE, /import CrossIcon from "@atlaskit\/icon\/core\/cross"/);
	assert.doesNotMatch(AVATAR_SOURCE, /import LockLockedIcon from "@atlaskit\/icon\/core\/lock-locked"/);
	assert.doesNotMatch(AVATAR_SOURCE, /import WarningIcon from "@atlaskit\/icon\/core\/warning"/);
	assert.match(AVATAR_SOURCE, /function AvatarWarningBangIcon\(/);
	assert.match(AVATAR_SOURCE, /function AvatarLockedIcon\(/);
	assert.match(AVATAR_SOURCE, /function AvatarInformationMarkIcon\(/);
	assert.doesNotMatch(AVATAR_SOURCE, /StatusVerifiedIcon|status-verified/);
	assert.doesNotMatch(AVATAR_SOURCE, /StatusWarningIcon|status-warning/);
	assert.doesNotMatch(AVATAR_SOURCE, /StatusInformationIcon|status-information/);
	assert.doesNotMatch(AVATAR_SOURCE, /CrossCircleIcon|cross-circle/);
	assert.match(
		AVATAR_SOURCE,
		/type AvatarStatus = "approved" \| "declined" \| "locked" \| "warning" \| "needs-input" \| "finished"/,
	);
	assert.match(
		AVATAR_SOURCE,
		/approved: \{ icon: CheckMarkIcon, className: "bg-success text-success-foreground"/,
	);
	assert.match(
		AVATAR_SOURCE,
		/declined: \{ icon: CrossIcon, className: "bg-destructive text-destructive-foreground"/,
	);
	assert.match(AVATAR_SOURCE, /offline: "bg-bg-neutral-bold"/);
	assert.match(
		AVATAR_SOURCE,
		/locked: \{\s*icon: AvatarLockedIcon,\s*className: `\$\{presenceColorMap\.offline\} text-icon-inverse`/,
	);
	assert.doesNotMatch(AVATAR_SOURCE, /M7\.25 13v-3h1\.5v3z/);
	assert.match(
		AVATAR_SOURCE,
		/warning: \{\s*icon: AvatarWarningBangIcon,\s*className: "bg-warning text-icon"/,
	);
	assert.match(AVATAR_SOURCE, /iconClassName: STATUS_ICON_CLASS_NAME,\s*label: "Warning"/);
	assert.match(
		AVATAR_SOURCE,
		/"needs-input": \{\s*icon: AvatarInformationMarkIcon,\s*className: "bg-info text-info-foreground"/,
	);
	assert.match(AVATAR_SOURCE, /label: "Needs input"/);
	assert.match(
		AVATAR_SOURCE,
		/finished: \{ icon: CheckMarkIcon, className: "bg-success text-success-foreground", iconClassName: STATUS_ICON_CLASS_NAME, label: "Finished" \}/,
	);
	assert.match(AVATAR_SOURCE, /label: "Finished"/);
	assert.match(
		AVATAR_SOURCE,
		/approved: \{ icon: CheckMarkIcon, className: "bg-success text-success-foreground"[\s\S]*finished: \{ icon: CheckMarkIcon, className: "bg-success text-success-foreground"/,
	);
	assert.doesNotMatch(AVATAR_SOURCE, /finished: \{[\s\S]*bg-surface|ring-border-success/);
	assert.doesNotMatch(AVATAR_SOURCE, /locked: \{[^\n]*bg-background/);
	assert.doesNotMatch(AVATAR_SOURCE, /locked: \{[^\n]*bg-warning/);
	assert.match(
		AVATAR_SOURCE,
		/const STATUS_ICON_CLASS_NAME =\n\t"group-data-\[size=xs\]\/avatar:hidden group-data-\[size=sm\]\/avatar:hidden group-data-\[size=default\]\/avatar:scale-\[0\.65\] group-data-\[size=lg\]\/avatar:scale-\[0\.65\] group-data-\[size=xl\]\/avatar:scale-\[0\.85\] group-data-\[size=2xl\]\/avatar:scale-\[1\.1\]"/,
	);
	assert.match(
		AVATAR_SOURCE,
		/const LOCKED_STATUS_ICON_CLASS_NAME =\n\t"group-data-\[size=xs\]\/avatar:hidden group-data-\[size=sm\]\/avatar:hidden group-data-\[size=default\]\/avatar:scale-\[0\.45\] group-data-\[size=lg\]\/avatar:scale-\[0\.45\] group-data-\[size=xl\]\/avatar:scale-\[0\.65\] group-data-\[size=2xl\]\/avatar:scale-\[0\.85\]"/,
	);
	assert.doesNotMatch(AVATAR_SOURCE, /WARNING_STATUS_ICON_CLASS_NAME/);
	assert.doesNotMatch(AVATAR_SOURCE, /STATUS_ICON_CLASS_NAME =[\s\S]*\[&>span>svg\]:size-/);
	assert.doesNotMatch(AVATAR_SOURCE, /STATUS_ICON_CLASS_NAME =[\s\S]*scale-50/);
	assert.doesNotMatch(AVATAR_SOURCE, /dangerouslySetInnerHTML|createElement\("svg"/);
	assert.match(AVATAR_SOURCE, /<Icon[\s\S]*className=\{config\.iconClassName\}[\s\S]*render=\{<StatusIcon/);
	// Status ring matches presence (fixed white + ring-2); overflow-hidden preserves thickness.
	assert.match(
		AVATAR_SOURCE,
		/data-slot="avatar-presence"[\s\S]*"ring-\[#FFFFFF\] absolute right-0 bottom-0 z-10 inline-flex items-center justify-center overflow-hidden rounded-full ring-2"/,
	);
	assert.match(
		AVATAR_SOURCE,
		/data-slot="avatar-status"[\s\S]*"ring-\[#FFFFFF\] absolute top-0 right-0 z-10 overflow-hidden rounded-full ring-2"/,
	);
});

test("avatar presence indicators use ADS glyph treatments per variant", () => {
	assert.match(AVATAR_SOURCE, /function AvatarPresenceGlyph\(/);
	assert.match(AVATAR_SOURCE, /online: "bg-success"/);
	assert.match(AVATAR_SOURCE, /busy: "bg-destructive"/);
	assert.match(AVATAR_SOURCE, /focus: "bg-discovery"/);
	assert.match(AVATAR_SOURCE, /offline: "bg-bg-neutral-bold"/);
	// Busy: diagonal slash cutout; focus: purple rim + white disk + small discovery center dot; offline: hollow ring.
	assert.match(
		AVATAR_SOURCE,
		/case "busy":\s*return \(\s*<span[\s\S]*rotate-45[\s\S]*bg-background/,
	);
	assert.doesNotMatch(AVATAR_SOURCE, /GoalIcon|@atlaskit\/icon\/core\/goal/);
	assert.doesNotMatch(AVATAR_SOURCE, /FOCUS_PRESENCE_ICON_CLASS_NAME/);
	assert.match(
		AVATAR_SOURCE,
		/case "focus":\s*return \(\s*<>\s*<span[\s\S]*inset-\[18%\][\s\S]*bg-background[\s\S]*size-\[28%\][\s\S]*bg-discovery/,
	);
	assert.match(
		AVATAR_SOURCE,
		/data-slot="avatar-presence"[\s\S]*"ring-\[#FFFFFF\] absolute right-0 bottom-0 z-10 inline-flex items-center justify-center overflow-hidden rounded-full ring-2"/,
	);
	assert.match(
		AVATAR_SOURCE,
		/case "offline":\s*return \(\s*<span[\s\S]*inset-1\/4[\s\S]*bg-background/,
	);
	assert.match(AVATAR_SOURCE, /case "online":\s*return null/);
	assert.match(AVATAR_SOURCE, /const _exhaustive: never = presence/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarPresenceIndicator presence="online"/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarPresenceIndicator presence="busy"/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarPresenceIndicator presence="focus"/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarPresenceIndicator presence="offline"/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarStatusIndicator status="warning"/);
	assert.match(AVATAR_DEMO_SOURCE, /status="needs-input"/);
	assert.match(AVATAR_DEMO_SOURCE, /status="finished"/);
	assert.match(AVATAR_DEMO_SOURCE, /<span className="text-xs text-text-subtle">Needs input<\/span>/);
	assert.match(AVATAR_DEMO_SOURCE, /<span className="text-xs text-text-subtle">Finished<\/span>/);
	assert.match(
		AVATAR_DEMO_SOURCE,
		/export function AvatarDemoStatus\([\s\S]*<AgentAvatarVisual[\s\S]*status="needs-input"[\s\S]*status="finished"[\s\S]*export function AvatarDemoDisabled/,
	);
	assert.equal(
		[...AVATAR_DEMO_SOURCE.match(/export function AvatarDemoStatus\([\s\S]*?^export function /m)[0].matchAll(/<AgentAvatarVisual/g)].length,
		2,
	);
	assert.doesNotMatch(
		AVATAR_DEMO_SOURCE.match(/export function AvatarDemoStatus\([\s\S]*?^export function /m)[0],
		/<AgentAvatarVisual[\s\S]*status="(?:approved|warning|declined|locked)"/,
	);
	assert.match(AVATAR_DETAILS_SOURCE, /approved, declined, locked, warning, needs-input, finished/);
	assert.match(AVATAR_DETAILS_SOURCE, /Needs input and Finished/);
});

test("avatar badges optically scale wrapped Atlaskit icons", () => {
	assert.match(AVATAR_DEMO_SOURCE, /import AddIcon from "@atlaskit\/icon\/core\/add"/);
	assert.match(AVATAR_DEMO_SOURCE, /import CheckMarkIcon from "@atlaskit\/icon\/core\/check-mark"/);
	assert.match(
		AVATAR_DEMO_SOURCE,
		/<AvatarBadge>\s*<Icon aria-hidden render=\{<AddIcon label="" size="small" \/>\} \/>\s*<\/AvatarBadge>/,
	);
	assert.match(
		AVATAR_DEMO_SOURCE,
		/<AvatarBadge>\s*<Icon aria-hidden render=\{<CheckMarkIcon label="" size="small" \/>\} \/>\s*<\/AvatarBadge>/,
	);
	assert.match(
		AVATAR_SOURCE,
		/group-data-\[size=sm\]\/avatar:\[&>\[data-slot=icon\]\]:scale-50/,
	);
	assert.match(
		AVATAR_SOURCE,
		/group-data-\[size=default\]\/avatar:\[&>\[data-slot=icon\]\]:scale-75/,
	);
	assert.match(
		AVATAR_SOURCE,
		/group-data-\[size=lg\]\/avatar:\[&>\[data-slot=icon\]\]:scale-75/,
	);
	assert.match(
		AVATAR_SOURCE,
		/group-data-\[size=2xl\]\/avatar:\[&>\[data-slot=icon\]\]:scale-125/,
	);
});

test("agent avatars share one hexagon contract across 1P, 2P, and 3P visuals", () => {
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /shape="hexagon"/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /status=\{status\}/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /status\?: AvatarStatus/);
	assert.doesNotMatch(AGENT_AVATAR_VISUAL_SOURCE, /AvatarStatusIndicator/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /avatarSrc\?\.startsWith\("\/2p\/"\)/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /<LogoThirdParty borderless label="" name=\{brandName\}/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /32: "xsmall"/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /const PX_TO_EXTERNAL_LOGO_SIZE:[\s\S]*24: "small"[\s\S]*32: "small"[\s\S]*40: "small"/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /const PX_TO_INSET_IMAGE_CLASS_NAME:[\s\S]*24: "size-5"[\s\S]*32: "size-5"[\s\S]*40: "size-5"/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /<LogoThirdParty borderless label="" name=\{brandName\} size=\{externalLogoSize\}/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /const hasWhiteBackdrop = isExternalAgent \|\| logoName === "atlassian" \|\| Boolean\(vpkLogo\)/);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /import \{ AtlassianLogo, RovoColorIcon,/u);
	assert.match(
		AGENT_AVATAR_VISUAL_SOURCE,
		/vpkLogo === "rovo" \? \(\s*<RovoColorIcon label="" size="xxsmall" \/>/u,
	);
	// The external-mark backdrop follows the theme instead of a hardcoded `#fff`,
	// so the hexagon stops punching a white hole in a dark surface. Pinned as an
	// exact class because a literal color here is exactly the regression.
	assert.match(
		AGENT_AVATAR_VISUAL_SOURCE,
		/className=\{cn\("flex size-full items-center justify-center bg-surface"/u,
	);
	assert.doesNotMatch(
		AGENT_AVATAR_VISUAL_SOURCE,
		/bg-\[#fff\]|bg-white/u,
		"the agent hexagon backdrop must stay themeable — no hardcoded white",
	);
	// Themed backdrop + monochrome-black glyph = ~1.1:1, so the mark disappears.
	// The inversion is applied by the logo components themselves; this file must
	// NOT add its own. CSS filters on nested elements compose, so a wrapper-level
	// invert here would double-invert the glyph straight back to near-black.
	assert.doesNotMatch(
		AGENT_AVATAR_VISUAL_SOURCE,
		/dark:(?:\[[^\]]*\]:)*invert/u,
		"agent avatars must not apply their own inversion — LogoThirdParty already inverts near-black glyphs, and nested filters compose",
	);
	assert.match(
		AGENT_AVATAR_VISUAL_SOURCE,
		/bg-surface",[\s\S]*?\)\}>\{visual\}<\/span>/u,
		"the themed backdrop wraps the visual directly, with no inverting wrapper in between",
	);
	assert.match(AGENT_AVATAR_VISUAL_SOURCE, /avatarSrc \? \([\s\S]*<AvatarImage[\s\S]*fallbackText \? <AvatarFallback>\{fallbackText\}<\/AvatarFallback> : null/);
	assert.match(ENTITY_CARD_AGENT_SOURCE, /import \{ AgentAvatarVisual \} from "@\/components\/ui-custom\/agent-avatar-visual"/);
	assert.match(ENTITY_CARD_AGENT_SOURCE, /<AgentAvatarVisual[\s\S]*brandName=\{brandName\}[\s\S]*sizePx=\{32\}/);
	assert.match(AGENT_CARD_SOURCE, /<AgentAvatarVisual[\s\S]*brandName=\{brandName\}[\s\S]*sizePx=\{32\}/);
	assert.doesNotMatch(ENTITY_CARD_AGENT_SOURCE, /Brand-identity agent.*no hexagon/);
});

test("avatar docs demonstrate Rovo, 1P, 2P, and 3P agent tiers", () => {
	assert.match(AVATAR_DEMO_SOURCE, /export function AvatarDemoAgentTiers\(\)/);
	assert.match(AVATAR_DEMO_SOURCE, /label: "Rovo"[\s\S]*<AgentAvatarVisual label="Rovo agent" sizePx=\{32\} vpkLogo="rovo"/);
	assert.match(AVATAR_DEMO_SOURCE, /avatarSrc="\/avatar-agent\/teamwork-agents\/customer-insights\.svg"/);
	assert.match(AVATAR_DEMO_SOURCE, /avatarSrc="\/2p\/appfire\.png"/);
	assert.match(AVATAR_DEMO_SOURCE, /brandName="slack"/);
	assert.match(AVATAR_DETAILS_SOURCE, /demoSlug: "avatar-demo-agent-tiers"/);
	assert.match(REGISTRY_SOURCE, /"avatar-demo-agent-tiers"/);
	assert.match(REGISTRY_SOURCE, /default: mod\.AvatarDemoAgentTiers/);
	assert.match(
		AGENT_AVATAR_VISUAL_SOURCE,
		/const PX_TO_AVATAR_SIZE:[\s\S]*32: "default"[\s\S]*40: "lg"/,
	);
});

test("avatar group overflow count uses 12px text and 14px text for large groups", () => {
	assert.match(AVATAR_SOURCE, /data-slot="avatar-group-count"/);
	assert.match(AVATAR_SOURCE, /rounded-full text-xs/);
	assert.match(AVATAR_SOURCE, /group-has-data-\[size=lg\]\/avatar-group:text-sm/);
	assert.doesNotMatch(AVATAR_SOURCE, /rounded-full text-sm/);
});

test("avatar groups own descending face stacking without changing DOM order", () => {
	assert.match(AVATAR_SOURCE, /isolate \[&>\*\]:relative \[&>\*\]:\[z-index:calc\(sibling-count\(\)-sibling-index\(\)\+1\)\]/);
	assert.match(AVATAR_SOURCE, /isInAvatarGroup \? \{\} : \{ zIndex: 10 \}/);
});

test("avatar groups give hexagon agents a shape-aware background separator", () => {
	assert.match(AVATAR_SOURCE, /const AvatarGroupContext = React\.createContext\(false\)/);
	assert.match(AVATAR_SOURCE, /const isInAvatarGroup = React\.use\(AvatarGroupContext\)/);
	assert.match(
		AVATAR_SOURCE,
		/isInAvatarGroup \? \(\s*<span[\s\S]*bg-background[\s\S]*HEXAGON_SEPARATOR_CLIP[\s\S]*data-slot="avatar-hexagon-group-border"/,
	);
	assert.match(AVATAR_SOURCE, /<AvatarGroupContext value>/);
	assert.match(
		AVATAR_SOURCE,
		/\[&>\[data-slot=avatar\]\[data-shape=hexagon\]\]:ring-0/,
	);
	assert.match(AVATAR_SOURCE, /-space-x-2 has-data-\[size=xs\]:-space-x-1/);
});

test("labeled avatars expose an image role", () => {
	assert.equal((AVATAR_SOURCE.match(/role=\{label \? "img" : undefined\}/g) ?? []).length, 2);
});

test("avatar docs include the agent avatar group variant", () => {
	assert.match(AVATAR_DEMO_SOURCE, /export function AvatarDemoAgentGroup\(\)/);
	assert.match(AVATAR_DEMO_SOURCE, /AVATAR_GROUP_SIZES = \[[\s\S]*\{ label: "16px", size: "xs", sizePx: 16 \}/);
	assert.match(AVATAR_DEMO_SOURCE, /AVATAR_GROUP_SIZES\.map\(\(\{ label, size, sizePx \}\) =>/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarGroup label=\{`\$\{label\} agent avatar group`\}>/);
	assert.match(AVATAR_DETAILS_SOURCE, /demoSlug: "avatar-demo-agent-group"/);
	assert.match(REGISTRY_SOURCE, /"avatar-demo-agent-group"/);
	assert.match(REGISTRY_SOURCE, /default: mod\.AvatarDemoAgentGroup/);
});

test("avatar docs include 16px human avatar groups", () => {
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarGroup label=\{`\$\{label\} human avatar group`\}>/);
	assert.match(AVATAR_DEMO_SOURCE, /<Avatar key=\{avatar\.alt\} size=\{size\}>/);
	assert.match(AVATAR_DETAILS_SOURCE, /Overlapping 16, 24, 32, and 40px human avatar groups\./);
});

test("avatar group overflow icon scales down to 12px for small groups", () => {
	assert.match(AVATAR_SOURCE, /\[&_\[data-slot=icon\]\]:size-4/);
	assert.match(AVATAR_SOURCE, /\[&_svg\]:size-4/);
	assert.match(AVATAR_SOURCE, /group-has-data-\[size=sm\]\/avatar-group:\[&_\[data-slot=icon\]\]:size-3/);
	assert.match(AVATAR_SOURCE, /group-has-data-\[size=sm\]\/avatar-group:\[&_svg\]:size-3/);
	assert.match(AVATAR_SOURCE, /group-has-data-\[size=xs\]\/avatar-group:size-4/);
	assert.match(AVATAR_SOURCE, /group-has-data-\[size=xs\]\/avatar-group:\[&_svg\]:size-2/);
});

test("avatar docs include only the base unassigned demo states", () => {
	assert.match(AVATAR_DEMO_SOURCE, /export function AvatarDemoUnassigned\(\)/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarUnassigned \/>/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarUnassigned kind="agent" \/>/);
	assert.doesNotMatch(AVATAR_DEMO_SOURCE, /<AvatarUnassigned kind="agent">\s*<AvatarPresenceIndicator/);
	assert.match(AVATAR_DETAILS_SOURCE, /demoSlug: "avatar-demo-unassigned"/);
	assert.match(REGISTRY_SOURCE, /"avatar-demo-unassigned"/);
	assert.match(REGISTRY_SOURCE, /default: mod\.AvatarDemoUnassigned/);
});

test("AvatarCompanyBadge exposes a size-aware company-logo dot for agent avatars", () => {
	assert.match(AVATAR_SOURCE, /function AvatarCompanyBadge\(/);
	assert.match(AVATAR_SOURCE, /data-slot="avatar-company-badge"/);
	assert.match(AVATAR_SOURCE, /"bg-primary text-primary-foreground ring-\[#FFFFFF\]/);
	assert.match(AVATAR_SOURCE, /group-data-\[size=2xl\]\/avatar:\[&_svg\]:size-4/);
	assert.match(AVATAR_SOURCE, /\tAvatarCompanyBadge,/);
	assert.match(AVATAR_SOURCE, /type AvatarCompanyBadgeProps,/);
	assert.match(AVATAR_DEMO_SOURCE, /export function AvatarDemoCompany\(\)/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarCompanyBadge>/);
	assert.match(AVATAR_DETAILS_SOURCE, /demoSlug: "avatar-demo-company"/);
	assert.match(REGISTRY_SOURCE, /"avatar-demo-company"/);
	assert.match(REGISTRY_SOURCE, /default: mod\.AvatarDemoCompany/);
});

test("AvatarProjectBadge exposes a square project tile for team-created agents", () => {
	assert.match(AVATAR_SOURCE, /function AvatarProjectBadge\(/);
	assert.match(AVATAR_SOURCE, /data-slot="avatar-project-badge"/);
	assert.match(AVATAR_SOURCE, /rounded-xs ring-2 select-none \[&_img\]:size-full \[&_img\]:object-cover/);
	assert.match(AVATAR_SOURCE, /\tAvatarProjectBadge,/);
	assert.match(AVATAR_SOURCE, /type AvatarProjectBadgeProps,/);
	assert.match(AVATAR_DEMO_SOURCE, /export function AvatarDemoProject\(\)/);
	assert.match(AVATAR_DEMO_SOURCE, /<AvatarProjectBadge>/);
	assert.match(AVATAR_DEMO_SOURCE, /\/avatar-project\/group\.svg/);
	assert.match(AVATAR_DETAILS_SOURCE, /demoSlug: "avatar-demo-project"/);
	assert.match(REGISTRY_SOURCE, /"avatar-demo-project"/);
	assert.match(REGISTRY_SOURCE, /default: mod\.AvatarDemoProject/);
});

test("primary avatar asset stays sized for rendered avatar slots", () => {
	const dimensions = readPngDimensions(PRIMARY_AVATAR_PATH);

	assert.equal(dimensions.width, 192);
	assert.equal(dimensions.height, 192);
	assert.ok(dimensions.bytes < 80_000);
	assert.match(AVATAR_SOURCE, /"2xl": "size-24"/);
});
