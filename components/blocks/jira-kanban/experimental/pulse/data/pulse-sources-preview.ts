import type { SourcePreviewPage } from "@/components/ui-custom/source-preview-menu-data";
import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";

/**
 * The fourteen connected sources the Pulse synthesis reads across.
 *
 * Lives next to the preview-menu fixtures so the stack logos and the cards
 * they open stay one data owner. A component file that also exported this
 * list would full-reload on every edit.
 */
export const PULSE_SOURCES = [
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "github", label: "GitHub", provider: "twg", name: "github" },
	{ id: "slack", label: "Slack", provider: "twg", name: "slack" },
	{ id: "sentry", label: "Sentry", provider: "twg", name: "sentry" },
	{ id: "launchdarkly", label: "LaunchDarkly", provider: "twg", name: "launchdarkly" },
	{ id: "loom", label: "Loom", provider: "loom" },
	{ id: "figma", label: "Figma", provider: "twg", name: "figma" },
	{ id: "google-docs", label: "Google Docs", provider: "twg", name: "google-docs" },
	{ id: "google-drive", label: "Google Drive", provider: "google-drive" },
	{ id: "bitbucket", label: "Bitbucket", provider: "bitbucket" },
	{ id: "rovo", label: "Rovo", provider: "rovo" },
	{ id: "opsgenie", label: "Opsgenie", provider: "opsgenie" },
	{ id: "statuspage", label: "Statuspage", provider: "statuspage" },
] satisfies readonly TwgToolSource[];

type PulseSourceId = (typeof PULSE_SOURCES)[number]["id"];

type PulseSourcePreviewCopy = Omit<SourcePreviewPage, "id" | "source">;

/**
 * One preview card per connected source so the menu matches the trigger count.
 *
 * Copy comes from the Pulse timeline. Owners mix the humans and agents who
 * actually produced the artifact — not the whole roster on every row.
 */
const PULSE_SOURCE_PREVIEW_COPY = {
	jira: {
		title: "PAY-102 — prove the adapter can go",
		href: "https://hello.atlassian.net/browse/PAY-102",
		updatedAt: new Date(2026, 7, 17),
		owner: "Maya Ferreira",
		snippet:
			"v2 exposes the same idempotency guarantees the adapter was faking on top of v1, so LegacyGatewayAdapter can be deleted outright.",
	},
	confluence: {
		title: "Payments SDK v2 — migration scope",
		href: "https://hello.atlassian.net/wiki/spaces/PAY/pages/5483563901",
		updatedAt: new Date(2026, 7, 17),
		owner: "Priya Raman",
		snippet:
			"Fourteen items, one epic, and 61 call sites to port rather than the 47 everyone had been quoting since June.",
	},
	github: {
		title: "Delete LegacyGatewayAdapter (proof branch)",
		href: "https://github.com/acme/storefront/pull/1847",
		updatedAt: new Date(2026, 7, 17),
		owner: "Maya Ferreira",
		snippet:
			"GitHub · #1847 open · −4,180 lines. The proof is a branch nobody has linked, so PAY-102 still reads “investigate”.",
	},
	slack: {
		title: "#payments-migration — keep or delete the adapter",
		href: "https://atlassian.slack.com/archives/C0PAYMENTS",
		updatedAt: new Date(2026, 7, 17),
		owner: "Priya Raman",
		snippet:
			"38-message thread where removal won, conditional on PAY-102 proving it is possible before anyone ports a call site.",
	},
	sentry: {
		title: "invalid_idempotency_scope — 1,204 events",
		href: "https://atlassian.sentry.io/issues/PAY-IDEMPOTENCY",
		updatedAt: new Date(2026, 7, 18),
		owner: "Jordan Okafor",
		snippet:
			"sandbox-eu truncates merchant-prefixed keys at 64 characters instead of erroring, which is why unit tests stayed green.",
	},
	launchdarkly: {
		title: "payments_sdk_v2_rollout — per-account kill switch",
		href: "https://app.launchdarkly.com/default/production/features/payments_sdk_v2_rollout",
		updatedAt: new Date(2026, 7, 19),
		owner: "Release Captain Agent",
		snippet:
			"Three targeting rules edited directly in LaunchDarkly at 01:14 so the flag can be pulled for one merchant instead of all of them.",
	},
	loom: {
		title: "Adapter spike walkthrough",
		href: "https://www.loom.com/share/pay102-adapter-spike",
		updatedAt: new Date(2026, 7, 17),
		owner: "Maya Ferreira",
		snippet:
			"Nine minutes on the delete proof: 41 files, all deletions, checkout-web compiling against v2 with the challenge handler stubbed.",
	},
	figma: {
		title: "Wallet — saved payment methods, v2",
		href: "https://www.figma.com/design/pay-wallet-v2",
		updatedAt: new Date(2026, 7, 19),
		owner: "Diego Santos",
		snippet:
			"Frames parked after the v2 payment-method object proved it does not carry the card artwork the design depends on.",
	},
	"google-docs": {
		title: "Eleven decline reasons, customer-facing copy",
		href: "https://docs.google.com/document/d/pay-decline-copy",
		updatedAt: new Date(2026, 7, 19),
		owner: "Diego Santos",
		snippet:
			"Approved by legal, still sitting in a Google Doc with no localisation ticket for nine languages.",
	},
	"google-drive": {
		title: "Call-site inventory across four services",
		href: "https://drive.google.com/file/d/pay-call-site-inventory",
		updatedAt: new Date(2026, 7, 17),
		owner: "Jordan Okafor",
		snippet:
			"The spreadsheet that pushed the count from 47 to 61 by including the two test harnesses everyone forgets.",
	},
	bitbucket: {
		title: "payments-sdk — mirror of the proof branch",
		href: "https://bitbucket.org/atlassian/payments-sdk/pull-requests/1847",
		updatedAt: new Date(2026, 7, 17),
		owner: "Review Agent",
		snippet:
			"Reviewed as a proof, not a merge candidate. One unresolved comment: idempotency key length is not bounded.",
	},
	rovo: {
		title: "Why the adapter is going",
		href: "https://hello.atlassian.net/wiki/spaces/PAY/pages/rovo-adapter-decision",
		updatedAt: new Date(2026, 7, 17),
		owner: "Venn",
		snippet:
			"The reasoning exists only in a local session on PAY-101. This is the Rovo capture so a new joiner can find it.",
	},
	opsgenie: {
		title: "sandbox-eu 401 — on-call alert",
		href: "https://atlassian.app.opsgenie.com/alert/PAY-SANDBOX-401",
		updatedAt: new Date(2026, 7, 18),
		owner: "Jordan Okafor",
		snippet:
			"Paged at 10:20. Root cause at 10:52. The handover note is still sitting in a personal space.",
	},
	statuspage: {
		title: "No public incident — sandbox only",
		href: "https://manage.statuspage.io/pages/pay/incidents/sandbox-eu-401",
		updatedAt: new Date(2026, 7, 18),
		owner: "Release Captain Agent",
		snippet:
			"Held as internal. Truncated keys never left sandbox-eu, so no customer-facing incident was opened.",
	},
} satisfies Record<PulseSourceId, PulseSourcePreviewCopy>;

function getPulseSourcePreviewCopy(id: string): PulseSourcePreviewCopy {
	const copy = (PULSE_SOURCE_PREVIEW_COPY as Record<string, PulseSourcePreviewCopy | undefined>)[id];
	if (copy === undefined) {
		throw new Error(`Missing Pulse source preview for "${id}"`);
	}
	return copy;
}

/**
 * Preview-menu fixtures for the Pulse Insights app stack.
 *
 * One card per connected source, in stack order, so the open list matches the
 * "14 Sources" trigger rather than only the four visible logos.
 */
export const PULSE_SOURCE_PREVIEW_PAGES: readonly SourcePreviewPage[] = PULSE_SOURCES.map((source) => ({
	id: source.id,
	source,
	...getPulseSourcePreviewCopy(source.id),
}));
