/**
 * Experimental v5 renders the experimental v3 implementation under its own
 * variant name. The v4 and v5 trees were full copies of v3 that differed only
 * by the version token, so they now share v3's code; the variant, its demos
 * and its catalog entries stay selectable.
 */
export {
	ExperimentalV3JiraWorkItem as ExperimentalV5JiraWorkItem,
	ExperimentalV3JiraWorkItem as default,
	type ExperimentalV3JiraWorkItemProps as ExperimentalV5JiraWorkItemProps,
} from "@/components/blocks/jira-work-item/experimental-v3/experimental-v3-jira-work-item";
