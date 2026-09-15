import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import type { ChangedFile } from "@/components/blocks/code-review";
import type { CodeListItem } from "@/components/ui-custom/code-list";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { TagColor } from "@/components/ui/tag";

import { getPullRequestIdentity } from "./jira-activity-adapter";

const GUIDED_REVIEW_PULL_REQUEST_IDENTITY = "acme/storefront#1847";

export interface PullRequestGuideChapter {
	id: string;
	title: string;
	description: string;
	fileIds: readonly string[];
}

export interface PullRequestProvider {
	id: "github" | "bitbucket" | "gitlab" | "other";
	name: string;
}

export interface PullRequestPerson {
	id: string;
	name: string;
	avatarSrc?: string;
	/** When omitted, treat as a human person avatar. */
	kind?: "person" | "agent" | "app";
}

export interface PullRequestReviewer extends PullRequestPerson {
	status: "approved" | "changes-requested" | "commented" | "pending";
}

export interface PullRequestLabel {
	id: string;
	name: string;
	color?: TagColor;
}

export interface PullRequestCommit {
	id: string;
	shortSha: string;
	title: string;
	author: PullRequestPerson;
	timestamp: string;
	additions: number;
	deletions: number;
	/** SCM commit page URL opened from the commits rail SHA. */
	url?: string;
}

export interface PullRequestCheck {
	id: string;
	name: string;
	status: "passed" | "failed" | "running" | "queued";
	details: string;
	/** Optional CI provider run URL opened from the failed-check external-link control. */
	url?: string;
}

export type PullRequestReviewDecision =
	| "approved"
	| "changes-requested"
	| "review-required"
	| "not-required";

export type PullRequestMergeState = "ready" | "blocked" | "conflicts" | "merged";

export interface PullRequestActivityActor extends PullRequestPerson {
	kind: "person" | "agent" | "app";
	/** Third-party brand mark for agents/apps (e.g. Claude Code → `claude`). */
	brandName?: ThirdPartyLogoName;
}

export interface PullRequestActivityReply {
	id: string;
	actor: PullRequestActivityActor;
	timestamp: string;
	body: string;
}

interface PullRequestActivityBase {
	id: string;
	actor: PullRequestActivityActor;
	/** Millisecond timestamp used to establish a deterministic chronological order. */
	occurredAtMs: number;
	/** Provider-supplied display timestamp, retained for the fixture UI. */
	timestamp: string;
}

export type PullRequestActivity =
	| (PullRequestActivityBase & {
			kind: "opened";
			baseBranch: string;
			headBranch: string;
		})
	| (PullRequestActivityBase & {
			kind: "commits-pushed";
			commitCount: number;
			headSha: string;
		})
	| (PullRequestActivityBase & {
			kind: "checks-completed";
			passed: number;
			total: number;
		})
	| (PullRequestActivityBase & {
			kind: "comment-posted";
			body: string;
			tag?: string;
			detail?: {
				label: string;
				body: string;
			};
		})
	| (PullRequestActivityBase & {
			kind: "review-submitted";
			decision: "approved" | "changes-requested" | "commented";
			body: string;
			filePath?: string;
			replies?: readonly PullRequestActivityReply[];
			/** Opt into Reply on this review discussion thread. */
			allowReply?: boolean;
			/**
			 * Opt into Resolve / Unresolve. Review discussion threads from
			 * Submit review should set this so Activity mirrors SCM threads.
			 */
			allowResolve?: boolean;
			/** Whether the review discussion thread is currently resolved. */
			resolved?: boolean;
			detail?: {
				label: string;
				body: string;
			};
		})
	| (PullRequestActivityBase & {
			/** One inline discussion thread attached to a submitted review. */
			kind: "review-comment";
			parentActivityId: string;
			body: string;
			filePath: string;
			replies?: readonly PullRequestActivityReply[];
			allowReply?: boolean;
			allowResolve?: boolean;
			resolved?: boolean;
		})
	| (PullRequestActivityBase & {
			kind: "thread-resolved";
			filePath: string;
		})
	| (PullRequestActivityBase & {
			kind: "ready-to-merge";
		});

export interface PullRequestGuideMetric {
	label: string;
	/** Filled segment count on the 1–5 bar (also drives bar color). */
	filled: number;
	/** Short blurb shown in place of the score on card hover/focus. */
	description: string;
}

export interface PullRequestGuidedReview {
	summary: readonly string[];
	metrics: Readonly<{
		risk: PullRequestGuideMetric;
		impact: PullRequestGuideMetric;
		reviewDepth: PullRequestGuideMetric;
		mergeConfidence: PullRequestGuideMetric;
	}>;
	/** Full markdown body for the Overview TipTap description editor. */
	description: string;
	chapters: readonly PullRequestGuideChapter[];
	files: readonly PullRequestReviewFile[];
}

export type PullRequestReviewFile = ChangedFile & CodeListItem;

export { resolveInitialReviewedChapterIds } from "./resolve-initial-reviewed-chapter-ids";

export interface PullRequestDetailData {
	identity: string;
	number: number;
	title: string;
	/** Markdown body shown in the Overview TipTap description editor. */
	description: string;
	repository: string;
	status: "Open" | "Merged";
	authorName: string;
	authorAvatarSrc?: string;
	authorKind: "person" | "agent" | "app";
	baseBranch: string | null;
	headBranch: string | null;
	additions: number;
	deletions: number;
	provider: PullRequestProvider;
	reviewers: readonly PullRequestReviewer[];
	labels: readonly PullRequestLabel[];
	commits: readonly PullRequestCommit[];
	checks: readonly PullRequestCheck[];
	createdTime: string;
	updatedTime: string;
	reviewDecision: PullRequestReviewDecision;
	mergeState: PullRequestMergeState;
	activity: readonly PullRequestActivity[];
	url: string;
	guidedReview: PullRequestGuidedReview | null;
}

const GUIDED_REVIEW_FILES = [
	{
		id: "guest-checkout-flow",
		path: "components/storefront/checkout/guest-checkout-flow.tsx",
		status: "modified",
		language: "tsx",
		oldContents: `export function CheckoutFlow() {
	return <AccountSignIn onComplete={startCheckout} />;
}`,
		newContents: `export function CheckoutFlow() {
	return (
		<GuestCheckoutForm
			onSubmit={createGuestOrder}
			onRecoverableError={restoreCheckoutDraft}
		/>
	);
}`,
		additions: 34,
		deletions: 8,
		defaultExpanded: true,
		explorerPath: "components/storefront/checkout/guest-checkout-flow.tsx",
		code: `diff --git a/components/storefront/checkout/guest-checkout-flow.tsx b/components/storefront/checkout/guest-checkout-flow.tsx
@@ -42,8 +42,15 @@ export function CheckoutFlow() {
-\treturn <AccountSignIn onComplete={startCheckout} />;
+\treturn (
+\t\t<GuestCheckoutForm
+\t\t\tonSubmit={createGuestOrder}
+\t\t\tonRecoverableError={restoreCheckoutDraft}
+\t\t/>
+\t);
 }`,
	},
	{
		id: "guest-orders-route",
		path: "backend/routes/guest-orders.js",
		status: "modified",
		language: "javascript",
		oldContents: `router.post("/guest-orders", async (req, res) => {
	const order = await orders.create(req.body);
	res.status(201).json({ orderId: order.id });
});`,
		newContents: `router.post("/guest-orders", async (req, res) => {
	const order = await guestOrderService.create({
		cartId: req.body.cartId,
		delivery: req.body.delivery,
		email: req.body.email,
	});
	res.status(201).json({ orderId: order.id });
});`,
		additions: 24,
		deletions: 6,
		defaultExpanded: false,
		explorerPath: "backend/routes/guest-orders.js",
		code: `diff --git a/backend/routes/guest-orders.js b/backend/routes/guest-orders.js
@@ -8,6 +8,13 @@ router.post("/guest-orders", async (req, res) => {
-\tconst order = await orders.create(req.body);
+\tconst order = await guestOrderService.create({
+\t\tcartId: req.body.cartId,
+\t\tdelivery: req.body.delivery,
+\t\temail: req.body.email,
+\t});
 \tres.status(201).json({ orderId: order.id });
 });`,
	},
	{
		id: "guest-order-service",
		path: "backend/services/guest-order-service.js",
		status: "modified",
		language: "javascript",
		oldContents: `export async function createGuestOrder(input) {
	return commerceClient.orders.create(input);
}`,
		newContents: `export async function createGuestOrder(input) {
	const order = await commerceClient.orders.create({
		...input,
		customerMode: "guest",
	});
	return { id: order.id, recoveryToken: order.recoveryToken };
}`,
		additions: 18,
		deletions: 4,
		defaultExpanded: false,
		explorerPath: "backend/services/guest-order-service.js",
		code: `diff --git a/backend/services/guest-order-service.js b/backend/services/guest-order-service.js
@@ -15,7 +15,12 @@ export async function createGuestOrder(input) {
-\treturn commerceClient.orders.create(input);
+\tconst order = await commerceClient.orders.create({
+\t\t...input,
+\t\tcustomerMode: "guest",
+\t});
+\treturn { id: order.id, recoveryToken: order.recoveryToken };
 }`,
	},
	{
		id: "guest-checkout-spec",
		path: "tests/storefront/guest-checkout.spec.ts",
		status: "modified",
		language: "typescript",
		oldContents: `test("guest checkout", async ({ page }) => {
	await page.goto("/checkout");
});`,
		newContents: `test("guest checkout", async ({ page }) => {
	await page.goto("/checkout");
	await page.getByRole("button", { name: "Checkout as guest" }).click();
	await page.getByLabel("Email").fill("guest@example.com");
	await page.getByRole("button", { name: "Place order" }).click();
	await expect(page.getByRole("heading", { name: "Order confirmed" })).toBeVisible();
});`,
		additions: 10,
		deletions: 3,
		defaultExpanded: false,
		explorerPath: "tests/storefront/guest-checkout.spec.ts",
		code: `diff --git a/tests/storefront/guest-checkout.spec.ts b/tests/storefront/guest-checkout.spec.ts
@@ -21,6 +21,11 @@ test("guest checkout", async ({ page }) => {
+\tawait page.getByRole("button", { name: "Checkout as guest" }).click();
+\tawait page.getByLabel("Email").fill("guest@example.com");
+\tawait page.getByRole("button", { name: "Place order" }).click();
+\tawait expect(page.getByRole("heading", { name: "Order confirmed" })).toBeVisible();
 });`,
	},
] as const satisfies readonly PullRequestReviewFile[];

const GUIDED_REVIEW: PullRequestGuidedReview = {
	summary: [
		"Lets shoppers complete checkout without creating an account.",
		"Keeps privileged order creation on the server behind a dedicated guest-order route.",
		"Preserves checkout details after recoverable errors and verifies the full guest flow.",
	],
	metrics: {
		risk: {
			label: "Low",
			filled: 1,
			description: "Contained to guest checkout entry and the dedicated guest-order route.",
		},
		impact: {
			label: "High",
			filled: 5,
			description: "Affects the shared checkout path for all shoppers without accounts.",
		},
		reviewDepth: {
			label: "3/5",
			filled: 3,
			description: "Spans storefront flow, guest-order API, and recovery coverage.",
		},
		mergeConfidence: {
			label: "4/5",
			filled: 4,
			description: "Browser suite and recoverable-error checks support a safe merge.",
		},
	},
	description: `Adds a guest checkout path so shoppers can finish purchase without creating an account, while keeping privileged commerce work on the server.

#### Summary

- Lets shoppers complete checkout without creating an account.
- Keeps privileged order creation on the server behind a dedicated guest-order route.
- Preserves checkout details after recoverable errors and verifies the full guest flow.

#### Changes

- **Storefront guest flow** — Replace the account-required checkout entry with \`GuestCheckoutForm\`, wired to \`createGuestOrder\` and \`restoreCheckoutDraft\` so delivery and contact details survive recoverable failures.
- **Guest-order route** — Narrow \`POST /guest-orders\` to accept cart, delivery, and email only, then delegate to \`guestOrderService.create\` instead of creating orders from the raw request body.
- **Server-owned order service** — Create guest orders with \`customerMode: "guest"\` and return a recovery token so the client can resume safely after validation or payment issues.
- **Browser coverage** — Extend the guest checkout Playwright spec to click “Checkout as guest”, submit email, place the order, and assert the confirmation heading.

#### Test plan

- [ ] From cart or sign-in, choose **Checkout as guest** and complete delivery → payment → confirmation without creating an account
- [ ] Confirm declined payments and recoverable validation errors keep safe checkout fields populated
- [ ] Retry a failed submission and verify the guest-order route does not create a duplicate order
- [ ] Spot-check that privileged pricing / inventory / order creation still runs only through the guest-order service
- [ ] Run lint, unit tests, and the guest checkout browser suite`,
	chapters: [
		{
			id: "start-guest-checkout",
			title: "Start a guest checkout",
			description:
				"Follow the new storefront path from the guest choice through validated delivery details. Confirm GuestCheckoutForm replaces the account-required entry and submits through createGuestOrder. Check that delivery and contact fields stay populated when restoreCheckoutDraft runs after a recoverable failure.",
			fileIds: ["guest-checkout-flow", "guest-orders-route"],
		},
		{
			id: "server-owned-order",
			title: "Keep order creation server-owned",
			description:
				"Review the narrow API boundary and the service that owns privileged commerce calls. POST /guest-orders should accept only cart, delivery, and email, then delegate to guestOrderService.create. Confirm guest orders set customerMode: \"guest\" and return a recovery token instead of creating orders from the raw request body.",
			fileIds: ["guest-orders-route", "guest-order-service"],
		},
		{
			id: "recover-and-verify",
			title: "Recover safely and verify the flow",
			description:
				"Check recoverable-error behavior and the browser test that completes a guest order. Declined payments and validation errors should keep safe checkout fields populated so the shopper can retry. Walk the Playwright path from Checkout as guest through confirmation, and confirm a failed retry does not create a duplicate order.",
			fileIds: ["guest-checkout-flow", "guest-checkout-spec"],
		},
	],
	files: GUIDED_REVIEW_FILES,
};

const COMPLETED_GUIDED_REVIEW: PullRequestGuidedReview = {
	...GUIDED_REVIEW,
	description: GUIDED_REVIEW.description.replaceAll("- [ ] ", "- [x] "),
};

function resolveGuidedReview(
	checks: readonly PullRequestCheck[],
): PullRequestGuidedReview {
	return checks.length > 0 && checks.every((check) => check.status === "passed")
		? COMPLETED_GUIDED_REVIEW
		: GUIDED_REVIEW;
}

const VENN: PullRequestActivityActor = {
	id: "venn",
	name: "Venn",
	kind: "person",
	avatarSrc: "/avatar-user/venn/venn.png",
};

const MAYA_CHEN: PullRequestActivityActor = {
	id: "maya-chen",
	name: "Maya Chen",
	kind: "person",
	avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
};

const JORDAN_LEE: PullRequestActivityActor = {
	id: "jordan-lee",
	name: "Jordan Lee",
	kind: "person",
	avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
};

const PRIYA_NARAYANAN: PullRequestActivityActor = {
	id: "priya-narayanan",
	name: "Priya Narayanan",
	kind: "person",
	avatarSrc: "/avatar-user/priya-hansra/color/asow-strategy-orange.png",
};

const SAM_RIVERA: PullRequestActivityActor = {
	id: "sam-rivera",
	name: "Sam Rivera",
	kind: "person",
	avatarSrc: "/avatar-user/raul-gonzalez/color/asow-strategy-orange.png",
};

const CLAUDE_CODE: PullRequestActivityActor = {
	id: "claude-code",
	name: "Claude",
	kind: "agent",
	brandName: "claude",
};

const GITHUB: PullRequestActivityActor = {
	id: "github",
	name: "GitHub",
	kind: "app",
};

const GITHUB_ACTIONS: PullRequestActivityActor = {
	id: "github-actions",
	name: "github-actions",
	kind: "app",
};

const CODEX: PullRequestActivityActor = {
	id: "codex",
	name: "Codex",
	kind: "app",
};

const GUIDED_REVIEW_REPO_COMMIT_URL = "https://github.com/acme/storefront/commit";

/** Demo commits use people portraits only — agent tiles stay out of this rail. */
const GUIDED_REVIEW_COMMITS: readonly PullRequestCommit[] = [
	{
		id: "5f02a91",
		shortSha: "5f02a91",
		title: "Add the guest checkout storefront flow",
		author: VENN,
		timestamp: "24 minutes ago",
		additions: 34,
		deletions: 8,
		url: `${GUIDED_REVIEW_REPO_COMMIT_URL}/5f02a91`,
	},
	{
		id: "91c73d4",
		shortSha: "91c73d4",
		title: "Keep guest order creation server-owned",
		author: MAYA_CHEN,
		timestamp: "22 minutes ago",
		additions: 24,
		deletions: 6,
		url: `${GUIDED_REVIEW_REPO_COMMIT_URL}/91c73d4`,
	},
	{
		id: "a2f74c1",
		shortSha: "a2f74c1",
		title: "Preserve checkout drafts after recoverable failures",
		author: JORDAN_LEE,
		timestamp: "20 minutes ago",
		additions: 18,
		deletions: 4,
		url: `${GUIDED_REVIEW_REPO_COMMIT_URL}/a2f74c1`,
	},
	{
		id: "d34c112",
		shortSha: "d34c112",
		title: "Cover declined payments and idempotent retries",
		author: PRIYA_NARAYANAN,
		timestamp: "18 minutes ago",
		additions: 10,
		deletions: 3,
		url: `${GUIDED_REVIEW_REPO_COMMIT_URL}/d34c112`,
	},
	{
		id: "8b4e6fa",
		shortSha: "8b4e6fa",
		title: "Fix nullable delivery-address validation in CI",
		author: SAM_RIVERA,
		timestamp: "14 minutes ago",
		additions: 7,
		deletions: 2,
		url: `${GUIDED_REVIEW_REPO_COMMIT_URL}/8b4e6fa`,
	},
	{
		id: "f8cc291",
		shortSha: "f8cc291",
		title: "Tighten checkout keyboard coverage",
		author: MAYA_CHEN,
		timestamp: "12 minutes ago",
		additions: 5,
		deletions: 1,
		url: `${GUIDED_REVIEW_REPO_COMMIT_URL}/f8cc291`,
	},
];

const GUIDED_REVIEW_CHECKS: readonly PullRequestCheck[] = [
	{
		id: "lint-types",
		name: "Lint and typecheck",
		status: "passed",
		details: "Completed in 1m 18s",
	},
	{
		id: "unit-tests",
		name: "Unit tests",
		status: "passed",
		details: "418 tests in 2m 46s",
	},
	{
		id: "browser-tests",
		name: "Guest checkout browser tests",
		status: "passed",
		details: "5 scenarios in 1m 32s",
	},
];

const GUIDED_REVIEW_ACTIVITY: readonly PullRequestActivity[] = [
	{
		id: "opened",
		kind: "opened",
		actor: VENN,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 35),
		timestamp: "25 minutes ago",
		baseBranch: "main",
		headBranch: "feature/shop-4821-guest-checkout",
	},
	{
		id: "initial-commits-pushed",
		kind: "commits-pushed",
		actor: CLAUDE_CODE,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 42),
		timestamp: "18 minutes ago",
		commitCount: 4,
		headSha: "d34c112",
	},
	{
		id: "github-actions-review",
		kind: "review-submitted",
		actor: GITHUB_ACTIONS,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 44),
		timestamp: "16 minutes ago",
		decision: "commented",
		body: "Lint and typecheck found one blocking issue in the guest-order service.",
		allowReply: false,
		allowResolve: false,
	},
	{
		id: "delivery-address-review-thread",
		kind: "review-comment",
		parentActivityId: "github-actions-review",
		actor: CODEX,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 45),
		timestamp: "15 minutes ago",
		body: "Narrow the nullable delivery address before creating the order. The current route can still forward an incomplete address after a recoverable validation failure.",
		filePath: "backend/services/guest-order-service.js",
		allowReply: true,
		allowResolve: true,
		resolved: false,
	},
	{
		id: "checkout-draft-review-thread",
		kind: "review-comment",
		parentActivityId: "github-actions-review",
		actor: CODEX,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 45, 30),
		timestamp: "14 minutes ago",
		body: "Preserve safe checkout fields when a recoverable validation error returns. The current fallback clears the shopper's delivery draft before they can retry.",
		filePath: "components/storefront/checkout/guest-checkout-flow.tsx",
		allowReply: true,
		allowResolve: true,
		resolved: false,
	},
	{
		id: "fix-commits-pushed",
		kind: "commits-pushed",
		actor: CODEX,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 49),
		timestamp: "11 minutes ago",
		commitCount: 1,
		headSha: "8b4e6fa",
	},
	{
		id: "checks-completed",
		kind: "checks-completed",
		actor: GITHUB,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 52),
		timestamp: "8 minutes ago",
		passed: GUIDED_REVIEW_CHECKS.filter((check) => check.status === "passed").length,
		total: GUIDED_REVIEW_CHECKS.length,
	},
	{
		id: "priya-review",
		kind: "review-submitted",
		actor: PRIYA_NARAYANAN,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 57),
		timestamp: "3 minutes ago",
		decision: "approved",
		body: "The guest checkout implementation and validation evidence are ready to merge.",
	},
	{
		id: "jordan-review",
		kind: "review-submitted",
		actor: JORDAN_LEE,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 58),
		timestamp: "2 minutes ago",
		decision: "approved",
		body: "The pull request has the required human approval.",
	},
	{
		id: "ready-to-merge",
		kind: "ready-to-merge",
		actor: GITHUB,
		occurredAtMs: Date.UTC(2026, 7, 10, 1, 59),
		timestamp: "1 minute ago",
	},
];

/**
 * Human approvers: teammates stay pending until a review lands, even when CI is
 * green. Request-changes marks the guided current reviewer (Priya); a fully
 * approved PR marks the whole team approved. Author does not approve their own
 * work.
 */
function resolveGuidedReviewReviewers(
	checks: readonly PullRequestCheck[],
	reviewDecision: PullRequestReviewDecision,
): readonly PullRequestReviewer[] {
	const checksReady = checks.length > 0
		&& checks.every((check) => check.status === "passed");
	if (reviewDecision === "changes-requested") {
		return [
			{ ...PRIYA_NARAYANAN, status: "changes-requested" },
			{ ...JORDAN_LEE, status: "pending" },
		];
	}
	const teamApprovalStatus = reviewDecision === "approved" && checksReady
		? "approved"
		: "pending";
	return [
		{ ...PRIYA_NARAYANAN, status: teamApprovalStatus },
		{ ...JORDAN_LEE, status: teamApprovalStatus },
	];
}

const GUIDED_REVIEW_LABELS: readonly PullRequestLabel[] = [
	{ id: "checkout", name: "checkout", color: "blue" },
	{ id: "customer-experience", name: "customer experience", color: "purple" },
];

function fallbackPullRequestUrl(repository: string, number: number): string {
	return repository ? `https://github.com/${repository}/pull/${number}` : "https://github.com";
}

function resolvePullRequestProvider(url: string | undefined): PullRequestProvider {
	if (url?.includes("bitbucket.org")) return { id: "bitbucket", name: "Bitbucket" };
	if (url?.includes("gitlab.com")) return { id: "gitlab", name: "GitLab" };
	if (!url || url.includes("github.com")) return { id: "github", name: "GitHub" };
	return { id: "other", name: "Source code provider" };
}

function resolveGuidedReviewActivity(
	checks: readonly PullRequestCheck[],
	reviewDecision: PullRequestReviewDecision,
	reviewers: readonly PullRequestReviewer[],
): readonly PullRequestActivity[] {
	const passed = checks.filter((check) => check.status === "passed").length;
	const checkActivityTemplate = GUIDED_REVIEW_ACTIVITY.find(
		(activity): activity is Extract<PullRequestActivity, { kind: "checks-completed" }> => (
			activity.kind === "checks-completed"
		),
	);
	if (!checkActivityTemplate) return GUIDED_REVIEW_ACTIVITY;
	const checkActivity: PullRequestActivity = {
		...checkActivityTemplate,
		passed,
		total: checks.length,
	};
	const openedActivity = GUIDED_REVIEW_ACTIVITY[0];
	const initialPushActivity = GUIDED_REVIEW_ACTIVITY[1];
	const fixPushActivity = GUIDED_REVIEW_ACTIVITY.find(
		(activity) => activity.id === "fix-commits-pushed",
	);
	const reviewSummaryActivity = GUIDED_REVIEW_ACTIVITY.find(
		(activity) => activity.id === "github-actions-review",
	);
	const reviewThreadActivities = GUIDED_REVIEW_ACTIVITY.filter(
		(activity): activity is Extract<PullRequestActivity, { kind: "review-comment" }> => (
			activity.kind === "review-comment"
			&& activity.parentActivityId === "github-actions-review"
		),
	);
	const baseActivity = [openedActivity, initialPushActivity].filter(
		(activity): activity is PullRequestActivity => Boolean(activity),
	);
	const reviewActivity = [reviewSummaryActivity, ...reviewThreadActivities].filter(
		(activity): activity is PullRequestActivity => Boolean(activity),
	);
	const fixedReviewThreads: PullRequestActivity[] = reviewThreadActivities.map((reviewThread) => ({
		...reviewThread,
		resolved: true,
		replies: reviewThread.id === "delivery-address-review-thread"
			? [{
					id: "delivery-address-fix-reply",
					actor: VENN,
					timestamp: "12 minutes ago",
					body: "Fixed in 8b4e6fa. I narrowed deliveryAddress before order creation and pushed the repair.",
				}]
			: [{
					id: "checkout-draft-fix-reply",
					actor: VENN,
					timestamp: "12 minutes ago",
					body: "Fixed in 8b4e6fa. I preserved the safe delivery draft for recoverable validation retries.",
				}],
	}));
	const fixedReviewActivity = [reviewSummaryActivity, ...fixedReviewThreads].filter(
		(activity): activity is PullRequestActivity => Boolean(activity),
	);

	if (checks.some((check) => check.status === "failed")) {
		return [
			...baseActivity,
			...reviewActivity,
			{
				...checkActivity,
				occurredAtMs: Date.UTC(2026, 7, 10, 1, 46),
				timestamp: "14 minutes ago",
			},
		];
	}
	if (checks.some((check) => check.status === "running" || check.status === "queued")) {
		const isFixRerun = checks.some((check) => /rerunning after/iu.test(check.details));
		return isFixRerun && fixPushActivity
			? [...baseActivity, ...fixedReviewActivity, fixPushActivity]
			: baseActivity;
	}

	const fixedActivity = fixPushActivity
		? [...baseActivity, ...fixedReviewActivity, fixPushActivity, checkActivity]
		: [...baseActivity, ...fixedReviewActivity, checkActivity];
	const approvalActivity = GUIDED_REVIEW_ACTIVITY.filter((activity) => (
		(activity.id === "priya-review"
			&& reviewers.some((reviewer) => reviewer.id === "priya-narayanan" && reviewer.status === "approved"))
		|| (activity.id === "jordan-review"
			&& reviewers.some((reviewer) => reviewer.id === "jordan-lee" && reviewer.status === "approved"))
		|| (activity.kind === "ready-to-merge" && reviewDecision === "approved")
	));
	return [...fixedActivity, ...approvalActivity];
}

/**
 * Whether the CI checks section title should show an indeterminate Spinner.
 * A blocked merge can be fully settled on a failed check, so only non-terminal
 * check rows count as progress.
 */
export function arePullRequestChecksInProgress(
	checks: readonly PullRequestCheck[],
): boolean {
	return checks.some((check) => check.status === "running" || check.status === "queued");
}

/** Keep merge status aligned with the rail CI checklist when SCM omits mergeState. */
function resolveMergeState(
	status: "Open" | "Merged",
	explicit: PullRequestMergeState | undefined,
	checks: readonly PullRequestCheck[],
	reviewDecision: PullRequestReviewDecision,
	isGuidedReview: boolean,
): PullRequestMergeState {
	if (status === "Merged") return "merged";
	if (explicit === "conflicts") return "conflicts";
	if (checks.some((check) => check.status !== "passed")) return "blocked";
	if (reviewDecision === "changes-requested" || reviewDecision === "review-required") {
		return "blocked";
	}
	if (explicit) return explicit;
	return isGuidedReview ? "ready" : "blocked";
}

export function resolvePullRequestDetailData(
	entry: Readonly<JiraActivityEventEntry>,
): PullRequestDetailData | null {
	const pullRequest = entry.pullRequest;
	if (!pullRequest) return null;

	const identity = getPullRequestIdentity(pullRequest);
	const repository = pullRequest.repository ?? "Repository unavailable";
	const repositoryIdentity = pullRequest.repository
		? `${pullRequest.repository}#${pullRequest.number}`
		: `#${pullRequest.number}`;
	const isGuidedReview = identity === GUIDED_REVIEW_PULL_REQUEST_IDENTITY
		|| repositoryIdentity === GUIDED_REVIEW_PULL_REQUEST_IDENTITY;
	const url = pullRequest.url ?? fallbackPullRequestUrl(pullRequest.repository ?? "", pullRequest.number);
	const commits = pullRequest.commits ?? (isGuidedReview ? GUIDED_REVIEW_COMMITS : []);
	const checks = pullRequest.checks ?? (isGuidedReview ? GUIDED_REVIEW_CHECKS : []);
	const guidedReview = isGuidedReview ? resolveGuidedReview(checks) : null;
	const reviewDecision = pullRequest.reviewDecision ?? (isGuidedReview ? "review-required" : "not-required");
	const reviewers = isGuidedReview
		? (pullRequest.reviewers ?? resolveGuidedReviewReviewers(checks, reviewDecision))
		: [];
	const mergeState = resolveMergeState(
		pullRequest.status,
		pullRequest.mergeState,
		checks,
		reviewDecision,
		isGuidedReview,
	);
	return {
		identity,
		number: pullRequest.number,
		title: pullRequest.title,
		description: guidedReview?.description ?? "",
		repository,
		status: pullRequest.status,
		authorName: isGuidedReview ? VENN.name : (pullRequest.authorName ?? "Unknown author"),
		authorAvatarSrc: isGuidedReview
			? (VENN.avatarSrc ?? undefined)
			: pullRequest.authorAvatarSrc,
		authorKind: isGuidedReview ? VENN.kind : "person",
		baseBranch: guidedReview ? "main" : null,
		headBranch: guidedReview ? "feature/shop-4821-guest-checkout" : null,
		additions: pullRequest.additions,
		deletions: pullRequest.deletions,
		provider: resolvePullRequestProvider(url),
		reviewers,
		labels: isGuidedReview ? GUIDED_REVIEW_LABELS : [],
		commits,
		checks,
		createdTime: isGuidedReview ? "25 minutes ago" : entry.timestamp,
		updatedTime: entry.timestamp,
		reviewDecision,
		mergeState,
		activity: isGuidedReview ? resolveGuidedReviewActivity(checks, reviewDecision, reviewers) : [],
		url,
		guidedReview,
	};
}
