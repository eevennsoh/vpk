// Source: atlassian/prototyping wiv-v2/main @ 72a8dc5d, mocks/data/workItems.js VITA-1 and referenced work items.
import type { ProjectButterRelatedItem } from "@/components/blocks/jira-work-item/project-butter/related-model";

export const PROJECT_BUTTER_CHILD_ITEMS: readonly ProjectButterRelatedItem[] = [
	{"key":"VITA-4","summary":"Write copy for welcome screen","priority":"Medium","assignee":"Sia Vale","status":"To do"},
	{"key":"VITA-5","summary":"Design progress indicator component","priority":"High","assignee":"Amara Okafor","status":"Done"},
	{"key":"VITA-6","summary":"Implement step validation logic","priority":"Low","assignee":"Automatic","status":"Done"},
];

export const PROJECT_BUTTER_LINKED_ITEMS: readonly ProjectButterRelatedItem[] = [
	{"key":"VITA-9","summary":"Customer interview video editing and distribution","priority":"Low","assignee":"Zoe Loft","status":"To do","relationship":"Blocks"},
	{"key":"VITA-10","summary":"Finalize brand guidelines for 2026 launch","priority":"High","assignee":"Marcus Aurelius","status":"To do","relationship":"Relates to"},
	{"key":"VITA-13","summary":"Set up feature flag for onboarding rollout","priority":"High","assignee":"Liam Wilson","status":"To do","relationship":"Blocked by"},
	{"key":"VITA-14","summary":"Migrate legacy user profile pages to new design system","priority":"Medium","assignee":"Sia Vale","status":"To do","relationship":"Relates to"},
	{"key":"VITA-15","summary":"Redesign onboarding flow for returning users","priority":"Low","assignee":"Amara Okafor","status":"To do","relationship":"Clones"},
	{"key":"VITA-19","summary":"Audit accessibility of new onboarding screens","priority":"Medium","assignee":"Marcus Aurelius","status":"To do","relationship":"Relates to"},
	{"key":"VITA-20","summary":"Fix back navigation losing state in onboarding wizard","priority":"High","assignee":"Oliver Knight","status":"To do","relationship":"Blocked by"},
	{"key":"VITA-21","summary":"Document onboarding flow architecture decisions","priority":"Low","assignee":"Sia Vale","status":"To do","relationship":"Relates to"},
];
