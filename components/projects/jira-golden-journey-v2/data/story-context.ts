import type { WorkItemData } from "@/app/contexts/context-work-item-modal";
import type { JiraWorkItemState } from "@/components/blocks/jira-work-item/data/session-state";

import type { JiraAgentsBuildStep, JiraAgentsStoryChapter } from "./hotfix-story";

export const RAW_STORY_DESCRIPTION = [
	"Checkout-funnel research shows that mandatory account creation is a major source of abandonment for first-time shoppers.",
	"",
	"#### User outcome",
	"As a first-time shopper, I want to complete a purchase without creating an account so that I can place my order quickly.",
	"",
	"#### What we know",
	"- The guest path must work on desktop and mobile web.",
	"- Existing pricing, inventory, payment, and duplicate-order safeguards must remain in place.",
	"- Account creation should be optional after a successful purchase.",
	"",
	"#### Initial acceptance criteria",
	"1. An eligible shopper can choose to continue without signing in.",
	"2. A guest can provide delivery and payment details and place one order.",
	"3. Recoverable checkout errors do not force the shopper to start again.",
].join("\n");

interface StoryIssueReference {
	key: string;
	summary: string;
	/** Why the improved description points at this issue. */
	note: string;
}

/**
 * Single source of truth for the delivery breakdown the Improve description
 * skill introduces. Both the improved description's reference lines and the
 * metadata rail's subtask/linked rows read `key` and `summary` from here, so a
 * rename cannot leave the narrative pointing at an issue the rail never shows.
 */
const STORY_SUBTASK_REFERENCES = [
	{
		key: "SHOP-4824",
		summary: "Define guest checkout requirements and success metrics",
		note: "scopes the guest steps, recoverable errors, and conversion targets.",
	},
	{
		key: "SHOP-4822",
		summary: "Build guest checkout and order-creation API",
		note: "owns server-authoritative pricing, inventory, and idempotent order creation.",
	},
	{
		key: "SHOP-4823",
		summary: "Build and integrate the storefront checkout flow",
		note: "delivers the Continue as guest path from cart through confirmation.",
	},
] as const satisfies readonly StoryIssueReference[];

const STORY_LINKED_REFERENCES = [
	{
		key: "SHOP-4760",
		summary: "Research checkout abandonment and guest conversion",
		note: "the completed research this scope is derived from.",
	},
] as const satisfies readonly StoryIssueReference[];

const [REQUIREMENTS_SUBTASK, CHECKOUT_API_SUBTASK, STOREFRONT_SUBTASK] = STORY_SUBTASK_REFERENCES;
const [RESEARCH_LINKED_ITEM] = STORY_LINKED_REFERENCES;

/**
 * Renders one issue as a text-link reference line.
 *
	 * The key + summary become a markdown link so the work item description and
	 * chat suggestion both show them as text links. Hash hrefs match the metadata
	 * rail's `#shop-…` targets and avoid leaking a full Atlassian browse URL when
	 * a surface fails to resolve markdown.
 */
function storyIssueReferenceLine(reference: StoryIssueReference): string {
	const label = `${reference.key} ${reference.summary}`;
	const href = `#${reference.key.toLowerCase()}`;
	return `- [${label}](${href}) — ${reference.note}`;
}

export const IMPROVED_STORY_DESCRIPTION = [
	"Checkout-funnel research shows that mandatory account creation is the largest avoidable source of abandonment for first-time shoppers. We need to remove that barrier without weakening pricing, inventory, payment, or order-creation controls.",
	"",
	"#### User outcome",
	"As a first-time shopper, I can complete a purchase without registering so that I can place my order quickly and decide whether to create an account afterward.",
	"",
	"#### Scope",
	"- Offer Continue as guest from the cart and sign-in step on desktop and mobile web.",
	"- Collect email, delivery address, shipping method, and tokenized payment details.",
	"- Recalculate prices, discounts, taxes, shipping, and inventory on the server before payment.",
	"",
	"#### Guest checkout flow",
	"```mermaid",
	"flowchart TD",
	'\tcart["Cart / sign-in"] --> guest{"Continue as guest?"}',
	'\tguest -->|yes| details["Email, address, shipping"]',
	'\tguest -->|no| account["Sign in or create account"]',
	'\tdetails --> payment["Tokenized payment"]',
	'\tpayment --> validate{"Server validation"}',
	'\tvalidate -->|ok| order["Create order"]',
	'\tvalidate -->|recoverable error| details',
	'\torder --> confirm["Confirmation"]',
	"```",
	"",
	"#### Acceptance criteria",
	"1. An eligible shopper can purchase without signing in or creating an account.",
	"2. Server validation rejects stale pricing, unavailable inventory, invalid addresses, and unusable payment tokens before order creation.",
	"3. Declined payments and recoverable validation errors do not clear safe customer input.",
	"",
	"#### Delivery breakdown",
	...STORY_SUBTASK_REFERENCES.map(storyIssueReferenceLine),
	"",
	"#### Related work",
	...STORY_LINKED_REFERENCES.map(storyIssueReferenceLine),
].join("\n");

export function createJiraAgentsStoryContextResources(
	chapter: JiraAgentsStoryChapter,
	workItem: WorkItemData,
	options: Readonly<{
		buildStep?: JiraAgentsBuildStep;
		descriptionImproved?: boolean;
	}> = {},
): JiraWorkItemState["contextResources"] {
	const buildStep = options.buildStep ?? "complete";
	// Build's complete step is the former Handoff end state (implementation done).
	// `ready` mirrors Plan end (Consult done, implementation not started yet).
	const implementationComplete = chapter !== "intake"
		&& chapter !== "plan"
		&& (chapter !== "build" || buildStep === "complete");
	const implementationInProgress = chapter === "build"
		&& (buildStep === "implementing" || buildStep === "verifying");
	// Applying the Improve description suggestion is what introduces the delivery
	// breakdown: the improved description links these issues, so the rail has to
	// show them from the same moment rather than waiting for the plan chapter.
	const planningArtifactsAvailable = chapter !== "intake" || options.descriptionImproved === true;
	return {
		title: workItem.title,
		description: workItem.description ?? "",
		tldr: [
			"Shoppers can complete a purchase without creating an account or signing in.",
			"The server owns pricing, inventory, payment-token validation, and idempotent order creation.",
			"Acceptance requires accessible delivery and payment forms, recoverable errors, one order per submission, confirmation, optional post-purchase registration, and a feature-flag rollout.",
		],
		nextSteps: [
			{ id: "story-next-plan", label: "Plan the checkout architecture", command: "Define secure guest order creation and publish the OpenAPI contract." },
			{ id: "story-next-implement", label: "Implement guest checkout", command: "Build the checkout service and storefront delivery, payment, and confirmation flows." },
			{ id: "story-next-verify", label: "Run acceptance coverage", command: "Verify successful checkout, validation failures, payment errors, and duplicate submissions." },
		],
		attachments: [
			{
				id: "story-attachment-product-brief",
				name: "guest-checkout-product-brief",
				displayName: "Guest checkout product brief",
				ext: "pdf",
				date: "5 Aug 2026, 11:04 AM",
				thumbnailKind: "document",
				sourceLabel: "Product brief",
			},
			{
				id: "story-attachment-wireframes",
				name: "guest-checkout-wireframes",
				displayName: "Guest checkout wireframes",
				ext: "fig",
				date: "5 Aug 2026, 11:12 AM",
				thumbnailKind: "file",
				sourceLabel: "Design spec",
			},
		],
		subtasks: planningArtifactsAvailable ? [
			{
				type: "Task",
				key: REQUIREMENTS_SUBTASK.key,
				summary: REQUIREMENTS_SUBTASK.summary,
				description: "Turn the checkout-abandonment research into a scoped requirement set: which steps a guest must complete, which validation errors are recoverable, and the conversion and error-rate targets the delivered flow has to hit.",
				priority: "medium",
				assignee: "Anthony Chen",
				assigneeAvatarUrl: "/avatar-human/anthony-chen.png",
				status: "done",
			},
			{
				type: "Task",
				key: CHECKOUT_API_SUBTASK.key,
				summary: CHECKOUT_API_SUBTASK.summary,
				description: "Create a guest checkout API that recalculates inventory, pricing, discounts, tax, and shipping before payment. Use tokenized payments and an idempotency key so retries cannot create duplicate orders, and return recoverable validation errors without requiring an account.",
				priority: "high",
				assignee: "Priya Hansra",
				assigneeAvatarUrl: "/avatar-human/priya-hansra.png",
				status: implementationComplete ? "done" : implementationInProgress ? "inprogress" : "todo",
			},
			{
				type: "Story",
				key: STOREFRONT_SUBTASK.key,
				summary: STOREFRONT_SUBTASK.summary,
				description: "Add a responsive Continue as guest path from cart and sign-in through delivery, shipping, payment, and confirmation. Preserve safe shopper input after recoverable errors, meet keyboard and screen-reader requirements, and offer account creation only after the order succeeds.",
				priority: "high",
				assignee: "Veronica Rodriguez",
				assigneeAvatarUrl: "/avatar-human/veronica-rodriguez.png",
				status: implementationComplete ? "done" : implementationInProgress ? "inprogress" : "todo",
			},
		] : [],
		linkedItems: planningArtifactsAvailable ? [
			{
				id: "story-link-research",
				key: RESEARCH_LINKED_ITEM.key,
				summary: RESEARCH_LINKED_ITEM.summary,
				description: "Combine checkout-funnel analytics, session replays, and support themes to identify why first-time shoppers leave before payment. The completed research recommends removing mandatory registration while keeping pricing, inventory, payment, and order validation server-authoritative.",
				type: "Task",
				relationship: "relates to",
				assignee: "Anthony Chen",
				assigneeAvatarUrl: "/avatar-human/anthony-chen.png",
				priority: "medium",
				status: "done",
			},
		] : [],
	};
}
