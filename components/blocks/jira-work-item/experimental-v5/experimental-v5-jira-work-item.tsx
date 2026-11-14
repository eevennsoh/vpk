/**
 * This experimental variant renders the experimental v3 implementation under
 * its own variant name. Its tree was a full copy of v3 that differed only by
 * the version token, so it now shares v3's code; the variant, its demos and its
 * catalog entries stay selectable. The comment names no sibling version, so the
 * Jira variant scaffolder can copy this file without ambiguous rewrites.
 */
export {
	ExperimentalV3JiraWorkItem as ExperimentalV5JiraWorkItem,
	ExperimentalV3JiraWorkItem as default,
	type ExperimentalV3JiraWorkItemProps as ExperimentalV5JiraWorkItemProps,
} from "@/components/blocks/jira-work-item/experimental-v3/experimental-v3-jira-work-item";
