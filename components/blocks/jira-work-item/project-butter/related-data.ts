// Source: atlassian/prototyping wiv-v2/main @ 3a53253a, mocks/data/workItems.js VITA-1 and referenced work items.
import type { ProjectButterRelatedItem, ProjectButterRelatedSearchItem } from "@/components/blocks/jira-work-item/project-butter/related-model";

const CHILD_SOURCE: readonly ProjectButterRelatedItem[] = [
	{"id":"child-VITA-4","dueDate":"2026-08-27","estimate":"2","key":"VITA-4","summary":"Write copy for welcome screen","priority":"Medium","assignee":"Sia Vale","status":"In progress","createdAt":"2026-03-10"},
	{"id":"child-VITA-5","dueDate":"2026-09-03","estimate":"5","key":"VITA-5","summary":"Design progress indicator component","priority":"High","assignee":"Amara Okafor","status":"Done","createdAt":"2026-03-10"},
	{"id":"child-VITA-6","dueDate":"2026-09-18","estimate":"1","key":"VITA-6","summary":"Implement step validation logic","priority":"Low","assignee":"Unassigned","status":"Done","createdAt":"2026-03-11"},
];

export const PROJECT_BUTTER_CHILD_ITEMS: readonly ProjectButterRelatedItem[] = Array.from({ length: 15 }, (_, index) => {
	const item = CHILD_SOURCE[index % CHILD_SOURCE.length];
	return { ...item, id: `${item.id}-${index + 1}` };
});

export const PROJECT_BUTTER_LINKED_ITEMS: readonly ProjectButterRelatedItem[] = [
	{"id":"linked-VITA-9","key":"VITA-9","summary":"Customer interview video editing and distribution","priority":"Low","assignee":"Zoe Loft","status":"To do","relationship":"Blocks","createdAt":"2026-03-18"},
	{"id":"linked-VITA-10","key":"VITA-10","summary":"Finalize brand guidelines for 2026 launch","priority":"High","assignee":"Marcus Aurelius","status":"To do","relationship":"Relates to","createdAt":"2026-03-20"},
	{"id":"linked-VITA-13","key":"VITA-13","summary":"Set up feature flag for onboarding rollout","priority":"High","assignee":"Liam Wilson","status":"To do","relationship":"Blocked by","createdAt":"2026-03-22"},
	{"id":"linked-VITA-14","key":"VITA-14","summary":"Migrate legacy user profile pages to new design system","priority":"Medium","assignee":"Sia Vale","status":"To do","relationship":"Relates to","createdAt":"2026-03-24"},
	{"id":"linked-VITA-15","key":"VITA-15","summary":"Redesign onboarding flow for returning users","priority":"Low","assignee":"Amara Okafor","status":"To do","relationship":"Clones","createdAt":"2026-03-26"},
	{"id":"linked-VITA-19","key":"VITA-19","summary":"Audit accessibility of new onboarding screens","priority":"Medium","assignee":"Marcus Aurelius","status":"To do","relationship":"Relates to","createdAt":"2026-03-28"},
	{"id":"linked-VITA-20","key":"VITA-20","summary":"Fix back navigation losing state in onboarding wizard","priority":"High","assignee":"Oliver Knight","status":"To do","relationship":"Blocked by","createdAt":"2026-03-30"},
	{"id":"linked-VITA-21","key":"VITA-21","summary":"Document onboarding flow architecture decisions","priority":"Low","assignee":"Sia Vale","status":"To do","relationship":"Relates to","createdAt":"2026-04-01"},
];


export const PROJECT_BUTTER_RELATED_SEARCH_ITEMS: readonly ProjectButterRelatedSearchItem[] = [
	{"id":"search-VITA-22","key":"VITA-22","workType":"Epic","summary":"User Experience Overhaul","priority":"High","assignee":"Unassigned","status":"To do","createdAt":"2026-01-10"},
	{"id":"search-VITA-23","key":"VITA-23","workType":"Epic","summary":"Platform Performance","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-01-15"},
	{"id":"search-VITA-2","key":"VITA-2","workType":"Task","summary":"Update CSS variables for theming system","priority":"Medium","assignee":"Elena Rodriguez","status":"To do","createdAt":"2026-03-05"},
	{"id":"search-VITA-3","key":"VITA-3","workType":"Bug","summary":"Fix header alignment across all screen sizes","priority":"Highest","assignee":"David Chen","status":"To do","createdAt":"2026-03-08"},
	{"id":"search-VITA-4","key":"VITA-4","workType":"Subtask","summary":"Write copy for welcome screen","priority":"Medium","assignee":"Sia Vale","status":"To do","createdAt":"2026-03-10"},
	{"id":"search-VITA-5","key":"VITA-5","workType":"Subtask","summary":"Design progress indicator component","priority":"High","assignee":"Amara Okafor","status":"To do","createdAt":"2026-03-10"},
	{"id":"search-VITA-6","key":"VITA-6","workType":"Subtask","summary":"Implement step validation logic","priority":"Low","assignee":"Unassigned","status":"To do","createdAt":"2026-03-11"},
	{"id":"search-VITA-7","key":"VITA-7","workType":"Subtask","summary":"Audit existing token usage across components","priority":"Low","assignee":"Hiroshi Tanaka","status":"To do","createdAt":"2026-03-12"},
	{"id":"search-VITA-8","key":"VITA-8","workType":"Task","summary":"Create unit tests for resizing logic","priority":"Medium","assignee":"Liam Wilson","status":"To do","createdAt":"2026-03-15"},
	{"id":"search-VITA-9","key":"VITA-9","workType":"Story","summary":"Customer interview video editing and distribution","priority":"Low","assignee":"Zoe Loft","status":"To do","createdAt":"2026-03-18"},
	{"id":"search-VITA-10","key":"VITA-10","workType":"Task","summary":"Finalize brand guidelines for 2026 launch","priority":"High","assignee":"Marcus Aurelius","status":"To do","createdAt":"2026-03-20"},
	{"id":"search-VITA-11","key":"VITA-11","workType":"Subtask","summary":"Integrate onboarding flow with auth system","priority":"High","assignee":"Elena Rodriguez","status":"To do","createdAt":"2026-03-12"},
	{"id":"search-VITA-12","key":"VITA-12","workType":"Subtask","summary":"Add analytics events for onboarding steps","priority":"Medium","assignee":"Hiroshi Tanaka","status":"To do","createdAt":"2026-03-13"},
	{"id":"search-VITA-13","key":"VITA-13","workType":"Task","summary":"Set up feature flag for onboarding rollout","priority":"High","assignee":"Liam Wilson","status":"To do","createdAt":"2026-03-22"},
	{"id":"search-VITA-14","key":"VITA-14","workType":"Story","summary":"Migrate legacy user profile pages to new design system","priority":"Medium","assignee":"Sia Vale","status":"To do","createdAt":"2026-03-24"},
	{"id":"search-VITA-15","key":"VITA-15","workType":"Story","summary":"Redesign onboarding flow for returning users","priority":"Low","assignee":"Amara Okafor","status":"To do","createdAt":"2026-03-26"},
	{"id":"search-VITA-16","key":"VITA-16","workType":"Subtask","summary":"Write end-to-end tests for onboarding flow","priority":"Medium","assignee":"David Chen","status":"To do","createdAt":"2026-03-14"},
	{"id":"search-VITA-17","key":"VITA-17","workType":"Subtask","summary":"Add skippable steps to onboarding wizard","priority":"Low","assignee":"Zoe Loft","status":"To do","createdAt":"2026-03-15"},
	{"id":"search-VITA-18","key":"VITA-18","workType":"Subtask","summary":"Localise onboarding copy for EU markets","priority":"Low","assignee":"Unassigned","status":"To do","createdAt":"2026-03-16"},
	{"id":"search-VITA-19","key":"VITA-19","workType":"Task","summary":"Audit accessibility of new onboarding screens","priority":"Medium","assignee":"Marcus Aurelius","status":"To do","createdAt":"2026-03-28"},
	{"id":"search-VITA-20","key":"VITA-20","workType":"Bug","summary":"Fix back navigation losing state in onboarding wizard","priority":"High","assignee":"Oliver Knight","status":"To do","createdAt":"2026-03-30"},
	{"id":"search-VITA-21","key":"VITA-21","workType":"Task","summary":"Document onboarding flow architecture decisions","priority":"Low","assignee":"Sia Vale","status":"To do","createdAt":"2026-04-01"},
	{"id":"search-VITA-24","key":"VITA-24","workType":"Task","summary":"API authentication module refactor","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-01"},
	{"id":"search-VITA-25","key":"VITA-25","workType":"Subtask","summary":"Set up error boundary for onboarding wizard","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-03"},
	{"id":"search-VITA-26","key":"VITA-26","workType":"Subtask","summary":"Add loading skeleton to profile page","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-05"},
	{"id":"search-VITA-27","key":"VITA-27","workType":"Subtask","summary":"Refactor form validation to use shared util","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-07"},
	{"id":"search-VITA-28","key":"VITA-28","workType":"Subtask","summary":"Write unit tests for step validation logic","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-09"},
	{"id":"search-VITA-29","key":"VITA-29","workType":"Subtask","summary":"Implement dark mode toggle in settings panel","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-11"},
	{"id":"search-VITA-30","key":"VITA-30","workType":"Subtask","summary":"Extract shared button styles into design token","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-13"},
	{"id":"search-VITA-31","key":"VITA-31","workType":"Subtask","summary":"Add keyboard navigation support to dropdown menus","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-15"},
	{"id":"search-VITA-32","key":"VITA-32","workType":"Story","summary":"Build notification preferences centre","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-17"},
	{"id":"search-VITA-33","key":"VITA-33","workType":"Story","summary":"Implement SSO login via SAML 2.0","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-19"},
	{"id":"search-VITA-34","key":"VITA-34","workType":"Task","summary":"Upgrade React to v19 and resolve breaking changes","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-21"},
	{"id":"search-VITA-35","key":"VITA-35","workType":"Task","summary":"Set up end-to-end testing pipeline with Playwright","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-23"},
	{"id":"search-VITA-36","key":"VITA-36","workType":"Bug","summary":"Fix tooltip position overflow on small screens","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-25"},
	{"id":"search-VITA-37","key":"VITA-37","workType":"Bug","summary":"Fix incorrect date format in activity feed timestamps","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-27"},
	{"id":"search-VITA-38","key":"VITA-38","workType":"Subtask","summary":"Migrate icon imports to use new icon-lab package","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-04-29"},
	{"id":"search-VITA-39","key":"VITA-39","workType":"Subtask","summary":"Add focus trap to modal dialogs","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-05-01"},
	{"id":"search-VITA-40","key":"VITA-40","workType":"Subtask","summary":"Clean up unused CSS variables in global stylesheet","priority":"Medium","assignee":"Unassigned","status":"To do","createdAt":"2026-05-03"},
	{"id":"search-VITA-44","key":"VITA-44","workType":"Bug","summary":"Fix null pointer exception in payment processing service","priority":"Highest","assignee":"Elena Rodriguez","status":"In progress","createdAt":"2026-05-20"},
];
