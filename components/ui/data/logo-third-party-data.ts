/**
 * Canonical local registry for third-party (3P) brand logos. Each brand is
 * described once: VPK public id, display label, optional package entrypoint,
 * optional package export, and whether a legacy `public/3p/<id>/` asset exists.
 *
 * The package-backed icon lookup in `logo-third-party-icons.ts` and the public
 * arrays below all derive from this manifest.
 */

export type ThirdPartyLogoPackageIcon = Readonly<{
	entrypoint: string;
	exportName: string;
}>;

export const THIRD_PARTY_LOGO_MANIFEST = [
	{ name: "adobe", label: "Adobe", packageIcon: { entrypoint: "adobe", exportName: "AdobeIcon" } },
	{ name: "adobe-sign", label: "Adobe Sign", localAsset: true },
	{ name: "adobe-xd", label: "Adobe XD", packageIcon: { entrypoint: "adobexd", exportName: "AdobeXDIcon" }, localAsset: true },
	{ name: "aha", label: "Aha!", packageIcon: { entrypoint: "aha", exportName: "AhaIcon" }, localAsset: true },
	{ name: "airtable", label: "Airtable", packageIcon: { entrypoint: "airtable", exportName: "AirtableIcon" }, localAsset: true },
	{ name: "amazon", label: "Amazon", packageIcon: { entrypoint: "amazon", exportName: "AmazonIcon" } },
	{ name: "amazon-web-services-aws", label: "Amazon Web Services (AWS)", packageIcon: { entrypoint: "amazon-web-services-aws", exportName: "AmazonWebServicesAWSIcon" } },
	{ name: "amplitude", label: "Amplitude", packageIcon: { entrypoint: "amplitude", exportName: "AmplitudeIcon" }, localAsset: true },
	{ name: "ansible", label: "Ansible", packageIcon: { entrypoint: "ansible", exportName: "AnsibleIcon" } },
	{ name: "asana", label: "Asana", packageIcon: { entrypoint: "asana", exportName: "AsanaIcon" }, localAsset: true },
	{ name: "azure-devops", label: "Azure DevOps", packageIcon: { entrypoint: "microsoft-azure-devops", exportName: "MicrosoftAzureDevOpsIcon" }, localAsset: true },
	{ name: "box", label: "Box", packageIcon: { entrypoint: "box", exportName: "BoxIcon" }, localAsset: true },
	{ name: "brightspot", label: "Brightspot", packageIcon: { entrypoint: "brightspot", exportName: "BrightspotIcon" }, localAsset: true },
	{ name: "canva", label: "Canva", packageIcon: { entrypoint: "canva", exportName: "CanvaIcon" }, localAsset: true },
	{ name: "claude", label: "Claude", packageIcon: { entrypoint: "claude", exportName: "ClaudeIcon" } },
	{ name: "clickup", label: "ClickUp", packageIcon: { entrypoint: "clickup", exportName: "ClickupIcon" }, localAsset: true },
	{ name: "cloudflare", label: "Cloudflare", packageIcon: { entrypoint: "cloudflare", exportName: "CloudflareIcon" } },
	{ name: "coupa", label: "Coupa", localAsset: true },
	{ name: "cursor", label: "Cursor", packageIcon: { entrypoint: "cursor", exportName: "CursorIcon" }, localAsset: true },
	{ name: "daloopa", label: "Daloopa", packageIcon: { entrypoint: "daloopa", exportName: "DaloopaIcon" } },
	{ name: "databricks", label: "Databricks", packageIcon: { entrypoint: "databricks", exportName: "DatabricksIcon" }, localAsset: true },
	{ name: "datadog", label: "Datadog", packageIcon: { entrypoint: "datadog", exportName: "DataDogIcon" }, localAsset: true },
	{ name: "docker", label: "Docker", packageIcon: { entrypoint: "docker", exportName: "DockerIcon" } },
	{ name: "documentum", label: "Documentum", packageIcon: { entrypoint: "documentum", exportName: "DocumentumIcon" } },
	{ name: "docusign", label: "DocuSign", packageIcon: { entrypoint: "docusign", exportName: "DocuSignIcon" }, localAsset: true },
	{ name: "dovetail", label: "Dovetail", packageIcon: { entrypoint: "dovetail", exportName: "DovetailIcon" }, localAsset: true },
	{ name: "dropbox", label: "Dropbox", packageIcon: { entrypoint: "dropbox", exportName: "DropboxIcon" }, localAsset: true },
	{ name: "dynatrace", label: "Dynatrace", packageIcon: { entrypoint: "dynatrace", exportName: "DynatraceIcon" } },
	{ name: "egnyte", label: "Egnyte", packageIcon: { entrypoint: "egnyte", exportName: "EgnyteIcon" }, localAsset: true },
	{ name: "evernote", label: "Evernote", packageIcon: { entrypoint: "evernote", exportName: "EvernoteIcon" } },
	{ name: "figma", label: "Figma", packageIcon: { entrypoint: "figma", exportName: "FigmaIcon" }, localAsset: true },
	{ name: "fireflies", label: "Fireflies", packageIcon: { entrypoint: "fireflies", exportName: "FirefliesIcon" } },
	{ name: "freshservice", label: "Freshservice", packageIcon: { entrypoint: "freshservice", exportName: "FreshserviceIcon" }, localAsset: true },
	{ name: "gamma", label: "Gamma", packageIcon: { entrypoint: "gamma", exportName: "GammaIcon" } },
	{ name: "generic-mcp-server", label: "Generic MCP Server", packageIcon: { entrypoint: "generic-mcp-server", exportName: "GenericMCPServerIcon" } },
	{ name: "giphy", label: "Giphy", packageIcon: { entrypoint: "giphy", exportName: "GiphyIcon" } },
	{ name: "github", label: "GitHub", packageIcon: { entrypoint: "github", exportName: "GithubIcon" }, localAsset: true },
	{ name: "github-copilot", label: "GitHub Copilot", localAsset: true },
	{ name: "gitlab", label: "GitLab", packageIcon: { entrypoint: "gitlab", exportName: "GitlabIcon" }, localAsset: true },
	{ name: "gmail", label: "Gmail", packageIcon: { entrypoint: "gmail", exportName: "GmailIcon" }, localAsset: true },
	{ name: "gong", label: "Gong", packageIcon: { entrypoint: "gong", exportName: "GongIcon" } },
	{ name: "google-calendar", label: "Google Calendar", packageIcon: { entrypoint: "google-calendar", exportName: "GoogleCalendarIcon" }, localAsset: true },
	{ name: "google-chrome", label: "Google Chrome", localAsset: true },
	{ name: "google-cloud-platform", label: "Google Cloud Platform", packageIcon: { entrypoint: "google-cloud-platform", exportName: "GoogleCloudPlatformIcon" }, localAsset: true },
	{ name: "google-docs", label: "Google Docs", packageIcon: { entrypoint: "google-docs", exportName: "GoogleDocsIcon" } },
	{ name: "google-drive", label: "Google Drive", packageIcon: { entrypoint: "google-drive", exportName: "GoogleDriveIcon" }, localAsset: true },
	{ name: "google-gemini", label: "Gemini", packageIcon: { entrypoint: "google-gemini", exportName: "GoogleGeminiIcon" }, localAsset: true },
	{ name: "google-sheets", label: "Google Sheets", packageIcon: { entrypoint: "google-sheets", exportName: "GoogleSheetsIcon" } },
	{ name: "google-slides", label: "Google Slides", packageIcon: { entrypoint: "google-slides", exportName: "GoogleSlidesIcon" } },
	{ name: "hubspot", label: "HubSpot", packageIcon: { entrypoint: "hubspot", exportName: "HubSpotIcon" }, localAsset: true },
	{ name: "hugging-face", label: "Hugging Face", packageIcon: { entrypoint: "hugging-face", exportName: "HuggingFaceIcon" } },
	{ name: "identity-now", label: "Identity Now", packageIcon: { entrypoint: "identity-now", exportName: "IdentityNowIcon" } },
	{ name: "intercom", label: "Intercom", packageIcon: { entrypoint: "intercom", exportName: "IntercomIcon" } },
	{ name: "invision", label: "InVision", packageIcon: { entrypoint: "invision", exportName: "InVisionIcon" } },
	{ name: "jam", label: "Jam", packageIcon: { entrypoint: "jam", exportName: "JamIcon" } },
	{ name: "jenkins", label: "Jenkins", packageIcon: { entrypoint: "jenkins", exportName: "JenkinsIcon" }, localAsset: true },
	{ name: "launchdarkly", label: "LaunchDarkly", packageIcon: { entrypoint: "launchdarkly", exportName: "LaunchdarklyIcon" }, localAsset: true },
	{ name: "linear", label: "Linear", packageIcon: { entrypoint: "linear", exportName: "LinearIcon" } },
	{ name: "lucid-co", label: "Lucid", packageIcon: { entrypoint: "lucid", exportName: "LucidIcon" }, localAsset: true },
	{ name: "lucidchart", label: "Lucidchart", packageIcon: { entrypoint: "lucidchart", exportName: "LucidchartIcon" }, localAsset: true },
	{ name: "microsoft", label: "Microsoft", packageIcon: { entrypoint: "microsoft", exportName: "MicrosoftIcon" } },
	{ name: "microsoft-365", label: "Microsoft 365", packageIcon: { entrypoint: "microsoft-365", exportName: "Microsoft365Icon" } },
	{ name: "microsoft-azure", label: "Microsoft Azure", packageIcon: { entrypoint: "microsoft-azure", exportName: "MicrosoftAzureIcon" } },
	{ name: "microsoft-entra-id", label: "Microsoft Entra ID", packageIcon: { entrypoint: "microsoft-entra-id", exportName: "MicrosoftEntraIDIcon" } },
	{ name: "microsoft-excel", label: "Microsoft Excel", packageIcon: { entrypoint: "microsoft-excel", exportName: "MicrosoftExcelIcon" } },
	{ name: "microsoft-onedrive", label: "Microsoft OneDrive", packageIcon: { entrypoint: "microsoft-onedrive", exportName: "MicrosoftOneDriveIcon" }, localAsset: true },
	{ name: "microsoft-outlook", label: "Microsoft Outlook", packageIcon: { entrypoint: "microsoft-outlook", exportName: "MicrosoftOutlookIcon" }, localAsset: true },
	{ name: "microsoft-power-point", label: "Microsoft Power Point", packageIcon: { entrypoint: "microsoft-power-point", exportName: "MicrosoftPowerPointIcon" } },
	{ name: "microsoft-sharepoint", label: "Microsoft SharePoint", packageIcon: { entrypoint: "microsoft-sharepoint", exportName: "MicrosoftSharePointIcon" }, localAsset: true },
	{ name: "microsoft-teams", label: "Microsoft Teams", packageIcon: { entrypoint: "microsoft-teams", exportName: "MicrosoftTeamsIcon" }, localAsset: true },
	{ name: "microsoft-word", label: "Microsoft Word", packageIcon: { entrypoint: "microsoft-word", exportName: "MicrosoftWordIcon" } },
	{ name: "miro", label: "Miro", packageIcon: { entrypoint: "miro", exportName: "MiroIcon" }, localAsset: true },
	{ name: "monday", label: "monday.com", packageIcon: { entrypoint: "monday", exportName: "MondayIcon" }, localAsset: true },
	{ name: "mural", label: "Mural", packageIcon: { entrypoint: "mural", exportName: "MuralIcon" }, localAsset: true },
	{ name: "neon", label: "Neon", packageIcon: { entrypoint: "neon", exportName: "NeonIcon" } },
	{ name: "new-relic", label: "New Relic", packageIcon: { entrypoint: "new-relic", exportName: "NewRelicIcon" } },
	{ name: "notion", label: "Notion", packageIcon: { entrypoint: "notion", exportName: "NotionIcon" }, localAsset: true },
	{ name: "octopus-deploy", label: "Octopus Deploy", packageIcon: { entrypoint: "octopus-deploy", exportName: "OctopusDeployIcon" } },
	{ name: "okta", label: "Okta", packageIcon: { entrypoint: "okta", exportName: "OktaIcon" } },
	{ name: "openai", label: "OpenAI", packageIcon: { entrypoint: "openai", exportName: "OpenAIIcon" } },
	{ name: "openai-codex", label: "Codex", packageIcon: { entrypoint: "codex", exportName: "CodexIcon" }, localAsset: true },
	{ name: "oracle", label: "Oracle", packageIcon: { entrypoint: "oracle", exportName: "OracleIcon" } },
	{ name: "outreach", label: "Outreach", packageIcon: { entrypoint: "outreach", exportName: "OutreachIcon" }, localAsset: true },
	{ name: "pagerduty", label: "PagerDuty", packageIcon: { entrypoint: "pager-duty", exportName: "PagerDutyIcon" }, localAsset: true },
	{ name: "paypal", label: "PayPal", packageIcon: { entrypoint: "paypal", exportName: "PayPalIcon" } },
	{ name: "pipedrive", label: "Pipedrive", packageIcon: { entrypoint: "pipedrive", exportName: "PipedriveIcon" }, localAsset: true },
	{ name: "postman", label: "Postman", packageIcon: { entrypoint: "postman", exportName: "PostmanIcon" } },
	{ name: "powerbi", label: "Power BI", packageIcon: { entrypoint: "microsoft-power-bi", exportName: "MicrosoftPowerBIIcon" }, localAsset: true },
	{ name: "quip", label: "Quip", packageIcon: { entrypoint: "quip", exportName: "QuipIcon" } },
	{ name: "salesforce", label: "Salesforce", packageIcon: { entrypoint: "salesforce", exportName: "SalesforceIcon" }, localAsset: true },
	{ name: "sap", label: "SAP", packageIcon: { entrypoint: "sap", exportName: "SAPIcon" } },
	{ name: "scriptrunner", label: "Scriptrunner", packageIcon: { entrypoint: "scriptrunner", exportName: "ScriptrunnerIcon" } },
	{ name: "sentry", label: "Sentry", packageIcon: { entrypoint: "sentry", exportName: "SentryIcon" }, localAsset: true },
	{ name: "servicenow", label: "ServiceNow", packageIcon: { entrypoint: "servicenow", exportName: "ServiceNowIcon" }, localAsset: true },
	{ name: "shopify", label: "Shopify", packageIcon: { entrypoint: "shopify", exportName: "ShopifyIcon" } },
	{ name: "simpplr", label: "Simpplr", packageIcon: { entrypoint: "simpplr", exportName: "SimpplrIcon" }, localAsset: true },
	{ name: "slack", label: "Slack", packageIcon: { entrypoint: "slack", exportName: "SlackIcon" }, localAsset: true },
	{ name: "smartsheet", label: "Smartsheet", packageIcon: { entrypoint: "smartsheet", exportName: "SmartsheetIcon" }, localAsset: true },
	{ name: "snowflake", label: "Snowflake", packageIcon: { entrypoint: "snowflake", exportName: "SnowflakeIcon" } },
	{ name: "spinnaker", label: "Spinnaker", packageIcon: { entrypoint: "spinnaker", exportName: "SpinnakerIcon" }, localAsset: true },
	{ name: "splunk", label: "Splunk", packageIcon: { entrypoint: "splunk", exportName: "SplunkIcon" } },
	{ name: "square", label: "Square", packageIcon: { entrypoint: "square", exportName: "SquareIcon" } },
	{ name: "stack-overflow", label: "Stack Overflow", packageIcon: { entrypoint: "stack-overflow", exportName: "StackOverflowIcon" }, localAsset: true },
	{ name: "stripe", label: "Stripe", packageIcon: { entrypoint: "stripe", exportName: "StripeIcon" }, localAsset: true },
	{ name: "stych", label: "Stych", packageIcon: { entrypoint: "stych", exportName: "StychIcon" } },
	{ name: "tableau", label: "Tableau", packageIcon: { entrypoint: "tableau", exportName: "TableauIcon" }, localAsset: true },
	{ name: "tempo-timesheets", label: "Tempo Timesheets", packageIcon: { entrypoint: "tempo-timesheets", exportName: "TempoTimesheetsIcon" } },
	{ name: "todoist", label: "Todoist", packageIcon: { entrypoint: "todoist", exportName: "TodoistIcon" }, localAsset: true },
	{ name: "twilio", label: "Twilio", packageIcon: { entrypoint: "twilio", exportName: "TwilioIcon" } },
	{ name: "vercel", label: "Vercel", packageIcon: { entrypoint: "vercel", exportName: "VercelIcon" } },
	{ name: "vs-code", label: "VS Code", localAsset: true },
	{ name: "webex", label: "Webex", packageIcon: { entrypoint: "webex", exportName: "WebexIcon" }, localAsset: true },
	{ name: "wix", label: "Wix", packageIcon: { entrypoint: "wix", exportName: "WixIcon" } },
	{ name: "workato", label: "Workato", packageIcon: { entrypoint: "workato", exportName: "WorkatoIcon" } },
	{ name: "workday", label: "Workday", packageIcon: { entrypoint: "workday", exportName: "WorkdayIcon" }, localAsset: true },
	{ name: "youtube", label: "YouTube", packageIcon: { entrypoint: "youtube", exportName: "YoutubeIcon" } },
	{ name: "zapier", label: "Zapier", packageIcon: { entrypoint: "zapier", exportName: "ZapierIcon" } },
	{ name: "zendesk", label: "Zendesk", packageIcon: { entrypoint: "zendesk", exportName: "ZendeskIcon" }, localAsset: true },
	{ name: "zeplin", label: "Zeplin", packageIcon: { entrypoint: "zeplin", exportName: "ZeplinIcon" }, localAsset: true },
	{ name: "ziprecruiter", label: "ZipRecruiter", packageIcon: { entrypoint: "ziprecruiter", exportName: "ZipRecruiterIcon" }, localAsset: true },
	{ name: "zoom", label: "Zoom", packageIcon: { entrypoint: "zoom", exportName: "ZoomIcon" }, localAsset: true },
] as const;

export type ThirdPartyLogoManifestEntry = (typeof THIRD_PARTY_LOGO_MANIFEST)[number];
export type ThirdPartyLogoName = ThirdPartyLogoManifestEntry["name"];
export type ThirdPartyLogoPackageIconManifestEntry = Extract<
	ThirdPartyLogoManifestEntry,
	{ readonly packageIcon: ThirdPartyLogoPackageIcon }
>;
export type ThirdPartyLogoPackageEntry = ThirdPartyLogoPackageIconManifestEntry["packageIcon"]["entrypoint"];
export type LocalAssetThirdPartyLogoName = Extract<
	ThirdPartyLogoManifestEntry,
	{ readonly localAsset: true }
>["name"];
type ThirdPartyLogoManifestEntryWithoutPackageIcon = ThirdPartyLogoManifestEntry extends infer Entry
	? Entry extends { readonly packageIcon: ThirdPartyLogoPackageIcon }
		? never
		: Entry
	: never;
export type LocalFallbackThirdPartyLogoName = Extract<
	ThirdPartyLogoManifestEntryWithoutPackageIcon,
	{ readonly localAsset: true }
>["name"];

function getManifestNames<const Entries extends ReadonlyArray<{ readonly name: string }>>(
	entries: Entries,
): { readonly [Index in keyof Entries]: Entries[Index] extends { readonly name: infer Name } ? Name : never } {
	return entries.map((entry) => entry.name) as {
		readonly [Index in keyof Entries]: Entries[Index] extends { readonly name: infer Name } ? Name : never;
	};
}

function hasPackageIcon(entry: ThirdPartyLogoManifestEntry): entry is ThirdPartyLogoPackageIconManifestEntry {
	return "packageIcon" in entry;
}

function hasLocalAsset(
	entry: ThirdPartyLogoManifestEntry,
): entry is Extract<ThirdPartyLogoManifestEntry, { readonly localAsset: true }> {
	return "localAsset" in entry && entry.localAsset === true;
}

function isLocalFallbackManifestEntry(
	entry: ThirdPartyLogoManifestEntry,
): entry is Extract<ThirdPartyLogoManifestEntryWithoutPackageIcon, { readonly localAsset: true }> {
	return hasLocalAsset(entry) && !hasPackageIcon(entry);
}

/** Every supported third-party brand id. */
export const THIRD_PARTY_LOGO_NAMES = getManifestNames(THIRD_PARTY_LOGO_MANIFEST);

/** Package-backed brand metadata consumed by `logo-third-party-icons.ts`. */
export const THIRD_PARTY_LOGO_PACKAGE_ICON_ENTRIES = THIRD_PARTY_LOGO_MANIFEST.filter(hasPackageIcon);

/** Brand ids with a local `public/3p/<id>/` asset folder. MUST match the folders. */
export const THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES: ReadonlyArray<LocalAssetThirdPartyLogoName> =
	THIRD_PARTY_LOGO_MANIFEST.filter(hasLocalAsset).map((entry) => entry.name);

/** Local-asset brands with no upstream package entry, rendered from `public/3p`. */
export const THIRD_PARTY_LOGO_LOCAL_FALLBACKS: ReadonlyArray<LocalFallbackThirdPartyLogoName> =
	THIRD_PARTY_LOGO_MANIFEST.filter(isLocalFallbackManifestEntry).map((entry) => entry.name);

/** Human-readable brand names. Used for accessible labels and demo captions. */
export const THIRD_PARTY_LOGO_LABELS: Readonly<Record<ThirdPartyLogoName, string>> = Object.fromEntries(
	THIRD_PARTY_LOGO_MANIFEST.map(({ name, label }) => [name, label]),
) as Readonly<Record<ThirdPartyLogoName, string>>;

const LOCAL_ASSET_SET: ReadonlySet<string> = new Set(THIRD_PARTY_LOGO_LOCAL_ASSET_NAMES);
const LOCAL_FALLBACK_SET: ReadonlySet<string> = new Set(THIRD_PARTY_LOGO_LOCAL_FALLBACKS);

/** Narrow a brand id to one that has a local `public/3p` asset. */
export function isLocalAssetThirdPartyLogoName(
	name: ThirdPartyLogoName,
): name is LocalAssetThirdPartyLogoName {
	return LOCAL_ASSET_SET.has(name);
}

/** Narrow a brand id to one that only has a local `public/3p` fallback asset. */
export function isLocalFallbackThirdPartyLogoName(
	name: ThirdPartyLogoName,
): name is LocalFallbackThirdPartyLogoName {
	return LOCAL_FALLBACK_SET.has(name);
}

/**
 * Local asset path consumed by `CustomLogo` for `public/3p` assets. Restricted
 * to local-asset ids so package-only brands cannot produce a 404ing path.
 */
export function thirdPartyLogoSrc(name: LocalAssetThirdPartyLogoName, variant: "standard" | "glyph" = "standard"): string {
	if (name === "openai-codex" && variant === "glyph") return "/3p/openai-codex/glyph.svg";
	const cacheVersion = name === "github-copilot" ? "?v=transparent-bg" : "";

	return `/3p/${name}/24.svg${cacheVersion}`;
}
