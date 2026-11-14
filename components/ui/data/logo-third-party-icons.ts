/**
 * Resolves VPK third-party brand ids to their `@atlassian/logo-third-party`
 * icon components.
 *
 * The package ships no root `exports` map, so each brand is imported from its
 * deep entrypoint path, and only when its logo first renders: the whole map is
 * about 300 KB, while a route shows a few brands. Brand ids, labels, package
 * entrypoints, package export names, and local fallback ids live in
 * `logo-third-party-data.ts`; this module only binds the manifest-declared
 * package entrypoints to their loaders.
 */
import type { ComponentType } from "react";

import { CUSTOM_LOGO_SIZES } from "@/components/ui/data/logo-data";
import {
	THIRD_PARTY_LOGO_PACKAGE_ICON_ENTRIES,
	type ThirdPartyLogoName,
	type ThirdPartyLogoPackageEntry,
} from "@/components/ui/data/logo-third-party-data";
import { SHARED_LOGO_WRAPPERS } from "@/components/ui/data/logo-wrappers";
import { createLazyGlyph } from "@/components/ui/lazy-glyph";

/** Tile size scale shared with `@atlaskit/tile` (matches `CUSTOM_LOGO_SIZES`). */
export type ThirdPartyLogoTileSize =
	| "xxsmall"
	| "xsmall"
	| "small"
	| "medium"
	| "large"
	| "xlarge";

type ThirdPartyLogoIconProps = {
	size?: ThirdPartyLogoTileSize;
	label?: string;
	testId?: string;
};

export type ThirdPartyLogoIcon = ComponentType<ThirdPartyLogoIconProps>;

type ThirdPartyLogoIconModule = Readonly<Record<string, unknown>>;

const TILE_SIZES: ReadonlySet<string> = new Set([
	"xxsmall",
	"xsmall",
	"small",
	"medium",
	"large",
	"xlarge",
]);

/**
 * Map a VPK logo `size` (the shared named scale) to a Tile size. Numeric or
 * unknown sizes degrade to `"small"`, matching `CustomLogo`'s default.
 */
export function toThirdPartyLogoTileSize(size?: string | number): ThirdPartyLogoTileSize {
	return typeof size === "string" && TILE_SIZES.has(size)
		? (size as ThirdPartyLogoTileSize)
		: "small";
}

// One loader per package entrypoint: a brand's module downloads the first time its logo renders.
const THIRD_PARTY_LOGO_PACKAGE_LOADERS = {
	"adobe": () => import("@atlassian/logo-third-party/dist/esm/entry-points/adobe"),
	"adobexd": () => import("@atlassian/logo-third-party/dist/esm/entry-points/adobexd"),
	"aha": () => import("@atlassian/logo-third-party/dist/esm/entry-points/aha"),
	"airtable": () => import("@atlassian/logo-third-party/dist/esm/entry-points/airtable"),
	"amazon": () => import("@atlassian/logo-third-party/dist/esm/entry-points/amazon"),
	"amazon-web-services-aws": () => import("@atlassian/logo-third-party/dist/esm/entry-points/amazon-web-services-aws"),
	"amplitude": () => import("@atlassian/logo-third-party/dist/esm/entry-points/amplitude"),
	"ansible": () => import("@atlassian/logo-third-party/dist/esm/entry-points/ansible"),
	"asana": () => import("@atlassian/logo-third-party/dist/esm/entry-points/asana"),
	"microsoft-azure-devops": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-azure-devops"),
	"box": () => import("@atlassian/logo-third-party/dist/esm/entry-points/box"),
	"brightspot": () => import("@atlassian/logo-third-party/dist/esm/entry-points/brightspot"),
	"canva": () => import("@atlassian/logo-third-party/dist/esm/entry-points/canva"),
	"claude": () => import("@atlassian/logo-third-party/dist/esm/entry-points/claude"),
	"clickup": () => import("@atlassian/logo-third-party/dist/esm/entry-points/clickup"),
	"cloudflare": () => import("@atlassian/logo-third-party/dist/esm/entry-points/cloudflare"),
	"codex": () => import("@atlassian/logo-third-party/dist/esm/entry-points/codex"),
	"cursor": () => import("@atlassian/logo-third-party/dist/esm/entry-points/cursor"),
	"daloopa": () => import("@atlassian/logo-third-party/dist/esm/entry-points/daloopa"),
	"databricks": () => import("@atlassian/logo-third-party/dist/esm/entry-points/databricks"),
	"datadog": () => import("@atlassian/logo-third-party/dist/esm/entry-points/datadog"),
	"docker": () => import("@atlassian/logo-third-party/dist/esm/entry-points/docker"),
	"documentum": () => import("@atlassian/logo-third-party/dist/esm/entry-points/documentum"),
	"docusign": () => import("@atlassian/logo-third-party/dist/esm/entry-points/docusign"),
	"dovetail": () => import("@atlassian/logo-third-party/dist/esm/entry-points/dovetail"),
	"dropbox": () => import("@atlassian/logo-third-party/dist/esm/entry-points/dropbox"),
	"dynatrace": () => import("@atlassian/logo-third-party/dist/esm/entry-points/dynatrace"),
	"egnyte": () => import("@atlassian/logo-third-party/dist/esm/entry-points/egnyte"),
	"evernote": () => import("@atlassian/logo-third-party/dist/esm/entry-points/evernote"),
	"figma": () => import("@atlassian/logo-third-party/dist/esm/entry-points/figma"),
	"fireflies": () => import("@atlassian/logo-third-party/dist/esm/entry-points/fireflies"),
	"freshservice": () => import("@atlassian/logo-third-party/dist/esm/entry-points/freshservice"),
	"gamma": () => import("@atlassian/logo-third-party/dist/esm/entry-points/gamma"),
	"generic-mcp-server": () => import("@atlassian/logo-third-party/dist/esm/entry-points/generic-mcp-server"),
	"giphy": () => import("@atlassian/logo-third-party/dist/esm/entry-points/giphy"),
	"github": () => import("@atlassian/logo-third-party/dist/esm/entry-points/github"),
	"gitlab": () => import("@atlassian/logo-third-party/dist/esm/entry-points/gitlab"),
	"gmail": () => import("@atlassian/logo-third-party/dist/esm/entry-points/gmail"),
	"gong": () => import("@atlassian/logo-third-party/dist/esm/entry-points/gong"),
	"google-calendar": () => import("@atlassian/logo-third-party/dist/esm/entry-points/google-calendar"),
	"google-cloud-platform": () => import("@atlassian/logo-third-party/dist/esm/entry-points/google-cloud-platform"),
	"google-docs": () => import("@atlassian/logo-third-party/dist/esm/entry-points/google-docs"),
	"google-drive": () => import("@atlassian/logo-third-party/dist/esm/entry-points/google-drive"),
	"google-gemini": () => import("@atlassian/logo-third-party/dist/esm/entry-points/google-gemini"),
	"google-sheets": () => import("@atlassian/logo-third-party/dist/esm/entry-points/google-sheets"),
	"google-slides": () => import("@atlassian/logo-third-party/dist/esm/entry-points/google-slides"),
	"hubspot": () => import("@atlassian/logo-third-party/dist/esm/entry-points/hubspot"),
	"hugging-face": () => import("@atlassian/logo-third-party/dist/esm/entry-points/hugging-face"),
	"identity-now": () => import("@atlassian/logo-third-party/dist/esm/entry-points/identity-now"),
	"intercom": () => import("@atlassian/logo-third-party/dist/esm/entry-points/intercom"),
	"invision": () => import("@atlassian/logo-third-party/dist/esm/entry-points/invision"),
	"jam": () => import("@atlassian/logo-third-party/dist/esm/entry-points/jam"),
	"jenkins": () => import("@atlassian/logo-third-party/dist/esm/entry-points/jenkins"),
	"launchdarkly": () => import("@atlassian/logo-third-party/dist/esm/entry-points/launchdarkly"),
	"linear": () => import("@atlassian/logo-third-party/dist/esm/entry-points/linear"),
	"lucid": () => import("@atlassian/logo-third-party/dist/esm/entry-points/lucid"),
	"lucidchart": () => import("@atlassian/logo-third-party/dist/esm/entry-points/lucidchart"),
	"microsoft": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft"),
	"microsoft-365": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-365"),
	"microsoft-azure": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-azure"),
	"microsoft-entra-id": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-entra-id"),
	"microsoft-excel": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-excel"),
	"microsoft-onedrive": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-onedrive"),
	"microsoft-outlook": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-outlook"),
	"microsoft-power-point": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-power-point"),
	"microsoft-sharepoint": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-sharepoint"),
	"microsoft-teams": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-teams"),
	"microsoft-word": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-word"),
	"miro": () => import("@atlassian/logo-third-party/dist/esm/entry-points/miro"),
	"monday": () => import("@atlassian/logo-third-party/dist/esm/entry-points/monday"),
	"mural": () => import("@atlassian/logo-third-party/dist/esm/entry-points/mural"),
	"neon": () => import("@atlassian/logo-third-party/dist/esm/entry-points/neon"),
	"new-relic": () => import("@atlassian/logo-third-party/dist/esm/entry-points/new-relic"),
	"notion": () => import("@atlassian/logo-third-party/dist/esm/entry-points/notion"),
	"octopus-deploy": () => import("@atlassian/logo-third-party/dist/esm/entry-points/octopus-deploy"),
	"okta": () => import("@atlassian/logo-third-party/dist/esm/entry-points/okta"),
	"openai": () => import("@atlassian/logo-third-party/dist/esm/entry-points/openai"),
	"oracle": () => import("@atlassian/logo-third-party/dist/esm/entry-points/oracle"),
	"outreach": () => import("@atlassian/logo-third-party/dist/esm/entry-points/outreach"),
	"pager-duty": () => import("@atlassian/logo-third-party/dist/esm/entry-points/pager-duty"),
	"paypal": () => import("@atlassian/logo-third-party/dist/esm/entry-points/paypal"),
	"pipedrive": () => import("@atlassian/logo-third-party/dist/esm/entry-points/pipedrive"),
	"postman": () => import("@atlassian/logo-third-party/dist/esm/entry-points/postman"),
	"microsoft-power-bi": () => import("@atlassian/logo-third-party/dist/esm/entry-points/microsoft-power-bi"),
	"quip": () => import("@atlassian/logo-third-party/dist/esm/entry-points/quip"),
	"salesforce": () => import("@atlassian/logo-third-party/dist/esm/entry-points/salesforce"),
	"sap": () => import("@atlassian/logo-third-party/dist/esm/entry-points/sap"),
	"scriptrunner": () => import("@atlassian/logo-third-party/dist/esm/entry-points/scriptrunner"),
	"sentry": () => import("@atlassian/logo-third-party/dist/esm/entry-points/sentry"),
	"servicenow": () => import("@atlassian/logo-third-party/dist/esm/entry-points/servicenow"),
	"shopify": () => import("@atlassian/logo-third-party/dist/esm/entry-points/shopify"),
	"simpplr": () => import("@atlassian/logo-third-party/dist/esm/entry-points/simpplr"),
	"slack": () => import("@atlassian/logo-third-party/dist/esm/entry-points/slack"),
	"smartsheet": () => import("@atlassian/logo-third-party/dist/esm/entry-points/smartsheet"),
	"snowflake": () => import("@atlassian/logo-third-party/dist/esm/entry-points/snowflake"),
	"spinnaker": () => import("@atlassian/logo-third-party/dist/esm/entry-points/spinnaker"),
	"splunk": () => import("@atlassian/logo-third-party/dist/esm/entry-points/splunk"),
	"square": () => import("@atlassian/logo-third-party/dist/esm/entry-points/square"),
	"stack-overflow": () => import("@atlassian/logo-third-party/dist/esm/entry-points/stack-overflow"),
	"stripe": () => import("@atlassian/logo-third-party/dist/esm/entry-points/stripe"),
	"stych": () => import("@atlassian/logo-third-party/dist/esm/entry-points/stych"),
	"tableau": () => import("@atlassian/logo-third-party/dist/esm/entry-points/tableau"),
	"tempo-timesheets": () => import("@atlassian/logo-third-party/dist/esm/entry-points/tempo-timesheets"),
	"todoist": () => import("@atlassian/logo-third-party/dist/esm/entry-points/todoist"),
	"twilio": () => import("@atlassian/logo-third-party/dist/esm/entry-points/twilio"),
	"vercel": () => import("@atlassian/logo-third-party/dist/esm/entry-points/vercel"),
	"webex": () => import("@atlassian/logo-third-party/dist/esm/entry-points/webex"),
	"wix": () => import("@atlassian/logo-third-party/dist/esm/entry-points/wix"),
	"workato": () => import("@atlassian/logo-third-party/dist/esm/entry-points/workato"),
	"workday": () => import("@atlassian/logo-third-party/dist/esm/entry-points/workday"),
	"youtube": () => import("@atlassian/logo-third-party/dist/esm/entry-points/youtube"),
	"zapier": () => import("@atlassian/logo-third-party/dist/esm/entry-points/zapier"),
	"zendesk": () => import("@atlassian/logo-third-party/dist/esm/entry-points/zendesk"),
	"zeplin": () => import("@atlassian/logo-third-party/dist/esm/entry-points/zeplin"),
	"ziprecruiter": () => import("@atlassian/logo-third-party/dist/esm/entry-points/ziprecruiter"),
	"zoom": () => import("@atlassian/logo-third-party/dist/esm/entry-points/zoom"),
} as const satisfies Record<ThirdPartyLogoPackageEntry, () => Promise<ThirdPartyLogoIconModule>>;

type PackageIconEntry = (typeof THIRD_PARTY_LOGO_PACKAGE_ICON_ENTRIES)[number];

async function loadPackageIcon(entry: PackageIconEntry): Promise<ThirdPartyLogoIcon> {
	const iconModule: ThirdPartyLogoIconModule = await THIRD_PARTY_LOGO_PACKAGE_LOADERS[entry.packageIcon.entrypoint]();
	const Icon = iconModule[entry.packageIcon.exportName] as ThirdPartyLogoIcon | undefined;
	if (!Icon) {
		throw new Error(
			`Missing @atlassian/logo-third-party icon export ${entry.packageIcon.exportName} ` +
				`from entrypoint ${entry.packageIcon.entrypoint}`,
		);
	}
	return Icon;
}

// The package tile is square at its Tile size; until the module arrives that box is held empty.
function thirdPartyLogoBoxSize(props: Readonly<ThirdPartyLogoIconProps>): number {
	return CUSTOM_LOGO_SIZES[toThirdPartyLogoTileSize(props.size)] ?? CUSTOM_LOGO_SIZES.small;
}

function buildThirdPartyLogoIconMap(): Partial<Record<ThirdPartyLogoName, ThirdPartyLogoIcon>> {
	return Object.fromEntries(
		THIRD_PARTY_LOGO_PACKAGE_ICON_ENTRIES.map((entry) => [
			entry.name,
			createLazyGlyph<ThirdPartyLogoIconProps>(() => loadPackageIcon(entry), thirdPartyLogoBoxSize),
		]),
	) as Partial<Record<ThirdPartyLogoName, ThirdPartyLogoIcon>>;
}

// Keeps the shared logo wrappers and their stylesheets in the page (logo-wrappers.ts).
void SHARED_LOGO_WRAPPERS;

/**
 * VPK brand id to Atlassian package icon component. Fallback-only brands are
 * omitted and handled by the local `public/3p` renderer.
 */
export const THIRD_PARTY_LOGO_ICONS = buildThirdPartyLogoIconMap();

/**
 * Look up a brand icon by raw id (e.g. `"figma"`). Returns `undefined` when the
 * brand has no upstream package asset.
 */
export function getThirdPartyLogoIconById(id: string): ThirdPartyLogoIcon | undefined {
	return (THIRD_PARTY_LOGO_ICONS as Record<string, ThirdPartyLogoIcon | undefined>)[id];
}

/**
 * Extract the `/3p/<id>/...` brand id from an asset path and resolve its package
 * icon. Returns `undefined` for non-3p paths or brands without an upstream asset.
 */
export function getThirdPartyLogoIconFromSrc(src: string): ThirdPartyLogoIcon | undefined {
	const match = /^\/3p\/([^/]+)\//.exec(src);
	return match ? getThirdPartyLogoIconById(match[1]) : undefined;
}
