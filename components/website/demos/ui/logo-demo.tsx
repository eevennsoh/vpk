"use client";

import { Tag } from "@/components/ui/tag";
import { AtlassianLogoMark, BrandLogoMark } from "@/components/ui/logo-mark";
import {
	AtlassianLogo,
	CustomLogo,
	AdminIcon,
	AlignIcon,
	AnalyticsIcon,
	AssetsIcon,
	AtlassianBrandIcon,
	BambooIcon,
	BitbucketIcon,
	ChatIcon,
	CompassIcon,
	ConfluenceIcon,
	CustomerServiceManagementIcon,
	FocusIcon,
	GoalsIcon,
	GuardIcon,
	HomeIcon,
	HubIcon,
	JiraIcon,
	JiraProductDiscoveryIcon,
	JiraServiceManagementIcon,
	LoomIcon,
	OpsgenieIcon,
	ProjectsIcon,
	RovoIcon,
	RovoColorIcon,
	RovoAppIcon,
	RovoDevIcon,
	RovoDevAgentIcon,
	SearchIcon,
	StatuspageIcon,
	StudioIcon,
	TalentIcon,
	TeamsIcon,
	TrelloIcon,
	LOGO_TILE_SIZES,
	type AtlassianLogoName,
} from "@/components/ui/logo";

const logoEntries: ReadonlyArray<{ name: AtlassianLogoName; label: string }> = [
	{ name: "atlassian", label: "Atlassian" },
	{ name: "home", label: "Home" },
	{ name: "search", label: "Search" },
	{ name: "jira", label: "Jira" },
	{ name: "confluence", label: "Confluence" },
	{ name: "rovo", label: "Rovo" },
	{ name: "bitbucket", label: "Bitbucket" },
	{ name: "loom", label: "Loom" },
	{ name: "goals", label: "Goals" },
	{ name: "teams", label: "Teams" },
	{ name: "compass", label: "Compass" },
	{ name: "jira-service-management", label: "JSM" },
	{ name: "jira-product-discovery", label: "JPD" },
	{ name: "assets", label: "Assets" },
	{ name: "projects", label: "Projects" },
	{ name: "focus", label: "Focus" },
	{ name: "admin", label: "Admin" },
	{ name: "align", label: "Align" },
	{ name: "analytics", label: "Analytics" },
	{ name: "bamboo", label: "Bamboo" },
	{ name: "chat", label: "Chat" },
	{ name: "customer-service-management", label: "CSM" },
	{ name: "guard", label: "Guard" },
	{ name: "hub", label: "Hub" },
	{ name: "opsgenie", label: "Opsgenie" },
	{ name: "rovo-dev", label: "RovoDev" },
	{ name: "rovo-dev-agent", label: "RovoDev Agent" },
	{ name: "statuspage", label: "Statuspage" },
	{ name: "studio", label: "Studio" },
	{ name: "talent", label: "Talent" },
	{ name: "trello", label: "Trello" },
	{ name: "atlassian-administration", label: "Atlassian Administration" },
	{ name: "atlassian-analytics", label: "Atlassian Analytics" },
	{ name: "crowd", label: "Crowd" },
	{ name: "dx", label: "DX" },
	{ name: "feedback", label: "Feedback" },
	{ name: "jira-align", label: "Jira Align" },
	{ name: "loom-attribution", label: "Loom Attribution" },
	{ name: "bitbucket-data-center", label: "Bitbucket Data Center" },
	{ name: "confluence-data-center", label: "Confluence Data Center" },
	{ name: "jira-data-center", label: "Jira Data Center" },
	{ name: "jira-service-management-data-center", label: "JSM Data Center" },
];

/* ── Overview demo (default export) ──────────────────────────────── */

export default function LogoDemo() {
	return (
		<div className="flex w-full flex-col gap-6">
			<div className="flex flex-wrap gap-4">
				{logoEntries.map((entry) => (
					<div key={entry.name} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 bg-surface">
						<AtlassianLogo name={entry.name} label={entry.label} size="small" />
						<span className="text-sm text-text">{entry.label}</span>
					</div>
				))}
				<div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 bg-surface">
					<RovoAppIcon label="Rovo app icon" size="small" />
					<span className="text-sm text-text">Rovo app icon</span>
				</div>
			</div>
		</div>
	);
}

/* ── Demo: Icons ──────────────────────────────────────────────── */

export function LogoDemoIcons() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			{logoEntries.map((entry) => (
				<div key={entry.name} className="flex flex-col items-center gap-1.5">
					<AtlassianLogo name={entry.name} label={entry.label} size="small" />
					<span className="text-xs text-text-subtle">{entry.label}</span>
				</div>
			))}
		</div>
	);
}

/* ── Demo: Rovo app icon ─────────────────────────────────────── */

export function LogoDemoRovoAppIcon() {
	return (
		<div className="flex flex-wrap items-end gap-4">
			{LOGO_TILE_SIZES.map((size) => (
				<div key={size} className="flex flex-col items-center gap-1.5">
					<RovoAppIcon label={`Rovo app icon ${size}`} size={size} />
					<span className="text-xs text-text-subtle">{size}</span>
				</div>
			))}
		</div>
	);
}

/* ── Demo: Lockups (icon + wordmark) ──────────────────────────── */

const lockupEntries: ReadonlyArray<{ name: AtlassianLogoName; label: string }> = [
	{ name: "atlassian", label: "Atlassian" },
	{ name: "jira", label: "Jira" },
	{ name: "confluence", label: "Confluence" },
	{ name: "bitbucket", label: "Bitbucket" },
	{ name: "loom", label: "Loom" },
	{ name: "rovo", label: "Rovo" },
	{ name: "home", label: "Home" },
	{ name: "goals", label: "Goals" },
	{ name: "teams", label: "Teams" },
	{ name: "compass", label: "Compass" },
	{ name: "focus", label: "Focus" },
	{ name: "admin", label: "Admin" },
	{ name: "guard", label: "Guard" },
	{ name: "studio", label: "Studio" },
	{ name: "trello", label: "Trello" },
	{ name: "chat", label: "Chat" },
	{ name: "hub", label: "Hub" },
	{ name: "rovo-dev", label: "RovoDev" },
	{ name: "bamboo", label: "Bamboo" },
	{ name: "opsgenie", label: "Opsgenie" },
	{ name: "statuspage", label: "Statuspage" },
	{ name: "atlassian-administration", label: "Atlassian Administration" },
	{ name: "atlassian-analytics", label: "Atlassian Analytics" },
	{ name: "crowd", label: "Crowd" },
	{ name: "feedback", label: "Feedback" },
	{ name: "jira-align", label: "Jira Align" },
	{ name: "loom-attribution", label: "Loom Attribution" },
];

export function LogoDemoLockups() {
	return (
		<div className="flex flex-wrap items-center gap-6">
			{lockupEntries.map((entry) => (
				<AtlassianLogo
					key={entry.name}
					name={entry.name}
					label={entry.label}
					variant="lockup"
					size="small"
				/>
			))}
		</div>
	);
}

/* ── Demo: Sizes ──────────────────────────────────────────────── */

export function LogoDemoSizes() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end gap-4">
				{LOGO_TILE_SIZES.map((size) => (
					<div key={size} className="flex flex-col items-center gap-1.5">
						<JiraIcon label="Jira" size={size} />
						<span className="text-xs text-text-subtle">{size}</span>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-end gap-4">
				{LOGO_TILE_SIZES.map((size) => (
					<div key={size} className="flex flex-col items-center gap-1.5">
						<AtlassianLogo name="jira" label="Jira" variant="lockup" size={size} />
						<span className="text-xs text-text-subtle">{size}</span>
					</div>
				))}
			</div>
			<div className="flex flex-wrap items-end gap-4">
				{LOGO_TILE_SIZES.map((size) => (
					<div key={size} className="flex flex-col items-center gap-1.5">
						<AtlassianLogo name="atlassian" label="Atlassian" size={size} />
						<span className="text-xs text-text-subtle">{size}</span>
					</div>
				))}
			</div>
		</div>
	);
}

/* ── Demo: Appearances ────────────────────────────────────────── */

const appearances: ReadonlyArray<"brand" | "neutral" | "inverse"> = [
	"brand",
	"neutral",
	"inverse",
];

export function LogoDemoAppearances() {
	return (
		<div className="flex flex-wrap gap-6">
			{appearances.map((appearance) => (
				<div
					key={appearance}
					className="flex flex-col items-center gap-2 rounded-md border border-border px-4 py-3"
					style={{
						backgroundColor: appearance === "inverse" ? "var(--ds-background-neutral-bold, #44546F)" : undefined,
					}}
				>
					<AtlassianLogo
						name="jira"
						label="Jira"
						variant="lockup"
						size="medium"
						appearance={appearance}
						themeAware={false}
					/>
					<span
						className="text-xs"
						style={{
							color: appearance === "inverse" ? "var(--ds-text-inverse, #FFF)" : undefined,
						}}
					>
						{appearance}
					</span>
				</div>
			))}
		</div>
	);
}

/* ── Demo: Custom Logo ────────────────────────────────────────── */

function RovoSvg(props: { width?: number; height?: number; "aria-hidden"?: boolean }) {
	return <RovoColorIcon {...props} />;
}

export function LogoDemoCustom() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-6">
				<CustomLogo
					svg={<RovoSvg />}
					label="Rovo icon"
					size="small"
				/>
				<CustomLogo
					svg={<RovoSvg />}
					wordmark="Rovo"
					label="Rovo"
					size="small"
				/>
				<CustomLogo
					svg={<RovoSvg />}
					wordmark="Rovo"
					label="Rovo"
					size="medium"
				/>
				<CustomLogo
					svg={<RovoSvg />}
					wordmark="Rovo"
					label="Rovo"
					size="large"
				/>
			</div>
			<p className="text-xs text-text-subtle">
				Pass any SVG element via the <code className="rounded bg-bg-neutral px-1 py-0.5">svg</code> prop. Add an optional <code className="rounded bg-bg-neutral px-1 py-0.5">wordmark</code> for a lockup layout.
			</p>
		</div>
	);
}

/* ── Demo: Brand logos (1P / 2P) ──────────────────────────────── */

// Representative marks for each tier. Border treatment is NOT set here — it is
// resolved from components/ui/data/logo-usage.json. 3P brands are documented on
// their own component, /components/ui/logo-third-party.
type BrandLogoSample =
	| { tier: "1p"; name: AtlassianLogoName; label: string; caption: string }
	| { tier: "2p"; src: string; label: string; caption: string };

const BRAND_LOGO_SAMPLES: ReadonlyArray<BrandLogoSample> = [
	// 1P Atlassian product mark: renders bare on its own solid background. (The
	// Atlassian master logo's tile treatment is shown in the In a Tile demo.)
	{ tier: "1p", name: "jira", label: "Jira", caption: "1P · product → bare" },
	// 2P partner marks: bare PNGs, always get a bordered tile.
	{ tier: "2p", src: "/2p/appfire.png", label: "Appfire", caption: "2P · bare PNG → tile" },
	{ tier: "2p", src: "/2p/adaptavist.png", label: "Adaptavist", caption: "2P · bare PNG → tile" },
];

export function LogoDemoBrandLogos() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-start gap-x-6 gap-y-4">
				{BRAND_LOGO_SAMPLES.map((sample) => (
					<div key={sample.label} className="flex w-28 flex-col items-center gap-2 text-center">
						{sample.tier === "1p" ? (
							<AtlassianLogo name={sample.name} label={sample.label} size="large" withUsageBorder />
						) : (
							<CustomLogo src={sample.src} label={sample.label} size="large" />
						)}
						<span className="text-xs font-semibold text-text">{sample.label}</span>
						<span className="text-[11px] leading-tight text-text-subtle">{sample.caption}</span>
					</div>
				))}
			</div>
			<p className="text-xs text-text-subtle">
				1P Atlassian marks render via <code className="rounded bg-bg-neutral px-1 py-0.5">AtlassianLogo</code>{" "}
				(opt into the tile treatment with <code className="rounded bg-bg-neutral px-1 py-0.5">withUsageBorder</code>);
				2P partner marks pass an asset path via <code className="rounded bg-bg-neutral px-1 py-0.5">src</code> to{" "}
				<code className="rounded bg-bg-neutral px-1 py-0.5">CustomLogo</code> (the bordered tile is resolved from{" "}
				<code className="rounded bg-bg-neutral px-1 py-0.5">logo-usage.json</code>). 3P brands live on{" "}
				<code className="rounded bg-bg-neutral px-1 py-0.5">LogoThirdParty</code>.
			</p>
		</div>
	);
}

/* ── Demo: Brand logos in a Tile (picker / menu rows) ─────────── */

export function LogoDemoInTile() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-3">
				<div className="flex items-end gap-3">
					{LOGO_TILE_SIZES.map((size) => (
						<AtlassianLogoMark
							key={size}
							label={`Atlassian ${size}`}
							name="atlassian"
							size={size}
						/>
					))}
					<span className="self-center text-sm text-text">Atlassian company</span>
				</div>
				{BRAND_LOGO_SAMPLES.map((sample) => (
					<div key={sample.label} className="flex items-end gap-3">
						{LOGO_TILE_SIZES.map((size) =>
							sample.tier === "1p" ? (
								<AtlassianLogoMark
									key={size}
									name={sample.name}
									label={`${sample.label} ${size}`}
									size={size}
								/>
							) : (
								<BrandLogoMark
									key={size}
									frame="tile"
									src={sample.src}
									label={`${sample.label} ${size}`}
									size={size}
								/>
							),
						)}
						<span className="self-center text-sm text-text">{sample.label}</span>
					</div>
				))}
			</div>
			<p className="text-xs text-text-subtle">
				Picker / suggestion-menu rows (e.g. the editor-palette). The Atlassian master logo and bare 2P
				partner marks sit on a surface{" "}
				<code className="rounded bg-bg-neutral px-1 py-0.5">Tile</code> and use the inset content scale
				shown on{" "}
				<code className="rounded bg-bg-neutral px-1 py-0.5">/components/ui/tile#sizes</code>.
				Solid-background 1P product marks (e.g. Jira) fill the whole tile because they already include
				their own background.
			</p>
		</div>
	);
}

/* ── Demo: Brand logos in a Tag (inline chips / config panel) ─── */

export function LogoDemoInTag() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Tag elemBefore={<AtlassianLogoMark frame="chip" name="atlassian" label="Atlassian" />}>
					Atlassian
				</Tag>
				{BRAND_LOGO_SAMPLES.map((sample) => (
					<Tag
						key={sample.label}
						elemBefore={
							sample.tier === "1p" ? (
								<AtlassianLogoMark frame="chip" name={sample.name} label={sample.label} />
							) : (
								<BrandLogoMark frame="chip" src={sample.src} label={sample.label} />
							)
						}
					>
						{sample.label}
					</Tag>
				))}
			</div>
			<p className="text-xs text-text-subtle">
				Inline chips (e.g. the agent config panel&apos;s tags): every mark is normalized to a 16px box.
				The Atlassian master logo and bare 2P marks render as a centered 12px glyph (no tile);
				solid-background 1P product marks fill the box.
			</p>
		</div>
	);
}

/* ── Demo: Named exports ──────────────────────────────────────── */

export function LogoDemoNamedExports() {
	return (
		<div className="flex flex-wrap items-center gap-4">
			<AdminIcon label="Admin" size="small" />
			<AlignIcon label="Align" size="small" />
			<AnalyticsIcon label="Analytics" size="small" />
			<AssetsIcon label="Assets" size="small" />
			<AtlassianBrandIcon label="Atlassian" size="small" />
			<BambooIcon label="Bamboo" size="small" />
			<BitbucketIcon label="Bitbucket" size="small" />
			<ChatIcon label="Chat" size="small" />
			<CompassIcon label="Compass" size="small" />
			<ConfluenceIcon label="Confluence" size="small" />
			<CustomerServiceManagementIcon label="CSM" size="small" />
			<FocusIcon label="Focus" size="small" />
			<GoalsIcon label="Goals" size="small" />
			<GuardIcon label="Guard" size="small" />
			<HomeIcon label="Home" size="small" />
			<HubIcon label="Hub" size="small" />
			<JiraIcon label="Jira" size="small" />
			<JiraProductDiscoveryIcon label="JPD" size="small" />
			<JiraServiceManagementIcon label="JSM" size="small" />
			<LoomIcon label="Loom" size="small" />
			<OpsgenieIcon label="Opsgenie" size="small" />
			<ProjectsIcon label="Projects" size="small" />
			<RovoIcon label="Rovo" size="small" />
			<RovoDevIcon label="RovoDev" size="small" />
			<RovoDevAgentIcon label="RovoDev Agent" size="small" />
			<SearchIcon label="Search" size="small" />
			<StatuspageIcon label="Statuspage" size="small" />
			<StudioIcon label="Studio" size="small" />
			<TalentIcon label="Talent" size="small" />
			<TeamsIcon label="Teams" size="small" />
			<TrelloIcon label="Trello" size="small" />
		</div>
	);
}
