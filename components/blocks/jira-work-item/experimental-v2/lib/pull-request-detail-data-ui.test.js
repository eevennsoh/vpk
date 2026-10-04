const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

// UI/source-contract checks split from pull-request-detail-data.test.js
// so the parent file stays inside the default file-size budget.

test("detail UI exposes stable integration selectors and guided-review controls", () => {
	const contextPanelSource = readFileSync(
		join(__dirname, "../components/context-panel.tsx"),
		"utf8",
	);
	const detailViewSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-detail-view.tsx"),
		"utf8",
	);
	const headerSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-detail-header.tsx"),
		"utf8",
	);
	const guideSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-guide.tsx"),
		"utf8",
	);
	const timelineSource = readFileSync(
		join(__dirname, "../../../chat-timeline/chat-timeline-navigator.tsx"),
		"utf8",
	);
	const filesSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-files.tsx"),
		"utf8",
	);
	const railSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-details-rail.tsx"),
		"utf8",
	);
	const contextRailSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-context-rail.tsx"),
		"utf8",
	);
	const metadataRailSource = readFileSync(
		join(__dirname, "../components/metadata-rail.tsx"),
		"utf8",
	);
	const metadataRailContextSource = readFileSync(
		join(__dirname, "../context-metadata-rail.tsx"),
		"utf8",
	);
	const overviewSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-overview.tsx"),
		"utf8",
	);
	const layoutSource = readFileSync(
		join(__dirname, "../components/experimental-work-item-layout.tsx"),
		"utf8",
	);
	const workItemSource = readFileSync(
		join(__dirname, "../experimental-v2-jira-work-item.tsx"),
		"utf8",
	);
	const activityComposerSource = readFileSync(
		join(__dirname, "../components/activity-composer.tsx"),
		"utf8",
	);
	const contextPillsSource = readFileSync(
		join(__dirname, "../components/activity-composer-context-pills.tsx"),
		"utf8",
	);
	const composerMotionSource = readFileSync(
		join(__dirname, "../components/jira-work-item-composer-motion.tsx"),
		"utf8",
	);

	assert.match(detailViewSource, /data-jira-work-item-pull-request-detail/u);
	assert.match(
		detailViewSource,
		/className="flex min-h-0 min-w-0 flex-1 flex-col"/u,
	);
	assert.doesNotMatch(
		detailViewSource,
		/sticky top-0 z-10 shrink-0 bg-surface/u,
	);
	assert.match(
		detailViewSource,
		/const tabNavigation = review \? \([\s\S]*<TabsList[\s\S]*<PullRequestDetailHeader[\s\S]*tabNavigation=\{tabNavigation\}/u,
	);
	assert.doesNotMatch(detailViewSource, /sticky top-0 z-10[^"\n]*gap-4/u);
	assert.doesNotMatch(detailViewSource, /shrink-0 px-4 sm:px-6/u);
	assert.match(detailViewSource, /min-h-0 flex-1 pb-6/u);
	assert.doesNotMatch(detailViewSource, /min-h-0 flex-1 py-6/u);
	assert.match(detailViewSource, /<TabsContent className="pt-6" value="code">/u);
	assert.doesNotMatch(detailViewSource, /<TabsContent className="pt-6" value="details">/u);
	assert.match(
		detailViewSource,
		/<PullRequestStickyHeaderShell scrollContainerRef=\{scrollContainerRef\}>/u,
	);
	assert.doesNotMatch(detailViewSource, /overflow-hidden|overflow-y-auto|useRef<HTMLDivElement/u);
	const stickyHeaderShellSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-sticky-header-shell.tsx"),
		"utf8",
	);
	assert.match(
		stickyHeaderShellSource,
		/className="sticky top-0 z-10 shrink-0 bg-surface"/u,
	);
	assert.doesNotMatch(stickyHeaderShellSource, /pb-6/u);
	assert.match(
		stickyHeaderShellSource,
		/--pull-request-detail-header-height[\s\S]*--pull-request-detail-scrollport-height[\s\S]*ResizeObserver/u,
	);
	assert.match(
		layoutSource,
		/context: \(scrollContainerRef: RefObject<HTMLDivElement \| null>\) => ReactNode[\s\S]*scrollRef=\{setLeftScrollContainerRef\}[\s\S]*context\(leftScrollContainerRef\)/u,
	);
	assert.doesNotMatch(
		layoutSource,
		/COLUMN_CHROME_HEIGHT_VAR|jira-work-item-column-chrome-height/u,
	);
	assert.doesNotMatch(workItemSource, /pinColumnChrome/u);
	assert.doesNotMatch(layoutSource, /pinColumnChrome/u);
	assert.match(
		workItemSource,
		/context=\{\(scrollContainerRef\) => \([\s\S]*<ContextPanel[\s\S]*scrollContainerRef=\{scrollContainerRef\}[\s\S]*submitReviewAction=\{pullRequestSubmitReviewAction\}/u,
	);
	assert.match(
		contextPanelSource,
		/<PullRequestDetailView[\s\S]*approvalState=\{pullRequestApprovalState\}[\s\S]*onChapterReviewedChange=\{onPullRequestChapterReviewedChange\}[\s\S]*onInlineCommentsChange=\{onPullRequestInlineCommentsChange\}[\s\S]*reviewedChapterIds=\{pullRequestReviewedChapterIds\}[\s\S]*scrollContainerRef=\{scrollContainerRef\}[\s\S]*submitReviewAction=\{submitReviewAction\}/u,
	);
	assert.match(
		detailViewSource,
		/<PullRequestDetailHeader[\s\S]*scrollContainerRef=\{scrollContainerRef\}[\s\S]*submitReviewAction=\{submitReviewAction\}/u,
	);
	assert.doesNotMatch(detailViewSource, /ref=\{scrollContainerRef\}/u);
	assert.doesNotMatch(detailViewSource, /overflow-y-auto px-4 py-5 sm:px-6/u);
	assert.match(
		detailViewSource,
		/Overview[\s\S]*Guide[\s\S]*\{review\.files\.length\} Files[\s\S]*text-text-success[\s\S]*\+\{data\.additions\}[\s\S]*text-text-danger[\s\S]*-\{data\.deletions\}/u,
	);
	assert.match(
		detailViewSource,
		/<PullRequestGuide[\s\S]*onChapterReviewedChange=\{handleChapterReviewedChange\}[\s\S]*reviewedChapterIds=\{effectiveReviewedChapterIds\}[\s\S]*scrollContainerRef=\{scrollContainerRef\}/u,
	);
	assert.doesNotMatch(detailViewSource, /showFinishAction|onFinish/u);
	assert.doesNotMatch(detailViewSource, /useEffect|onReviewProgressChange/u);
	assert.match(
		detailViewSource,
		/const effectiveReviewedChapterIds = reviewedChapterIds \?\? localReviewedChapterIds/u,
	);
	assert.match(
		headerSource,
		/import \{ PullRequestHeader \} from "@\/components\/blocks\/pull-request-header"/u,
	);
	assert.match(headerSource, /data-jira-work-item-pull-request-detail-header/u);
	assert.match(
		headerSource,
		/scrollContainerRef: RefObject<HTMLElement \| null>/u,
	);
	assert.match(
		headerSource,
		/scrollContainerRef=\{scrollContainerRef\}/u,
	);
	assert.match(
		headerSource,
		/<PullRequestHeader[\s\S]*number=\{data\.number\}[\s\S]*title=\{data\.title\}[\s\S]*status=\{data\.status\}/u,
	);
	assert.match(headerSource, /tabNavigation=\{tabNavigation\}/u);
	assert.match(
		headerSource,
		/submitReviewAction=\{isOpen \? submitReviewAction : undefined\}/u,
	);
	assert.doesNotMatch(headerSource, /px-4 py-4 sm:px-6/u);
	assert.match(overviewSource, /rounded-lg border border-border p-4/u);
	assert.match(
		overviewSource,
		/import \{ ContextDescriptionEditor \} from "@\/components\/blocks\/jira-work-item\/experimental-v2\/components\/context-description-editor"/u,
	);
	assert.match(
		overviewSource,
		/<ContextDescriptionEditor[\s\S]*aria-label="Pull request description"[\s\S]*value=\{description\}[\s\S]*onMarkdownChange=\{setDescription\}/u,
	);
	assert.doesNotMatch(overviewSource, /list-disc|Summary<\/h2>/u);
	assert.doesNotMatch(
		overviewSource,
		/pull-request-description-heading|Description<\/h2>|aria-labelledby="pull-request-description-heading"/u,
	);
	assert.match(overviewSource, /<section aria-label="Description">/u);
	assert.doesNotMatch(overviewSource, /max-w-3xl|mx-auto|space-y-8/u);
	assert.doesNotMatch(overviewSource, /pull-request-checks-heading|testGroups|groups passed/u);
	assert.doesNotMatch(overviewSource, /bg-surface-raised|bg-bg-neutral/u);
	assert.doesNotMatch(headerSource, /Back to description|onBack|ArrowLeftIcon/u);
	assert.match(headerSource, /mergeState=\{mapPullRequestHeaderMergeState\(data\)\}/u);
	assert.match(
		headerSource,
		/function mapPullRequestHeaderMergeState[\s\S]*case "conflicts":[\s\S]*return "merge-conflicts"[\s\S]*case "blocked":[\s\S]*checks\.some[\s\S]*"failed"[\s\S]*return "checks-failed"[\s\S]*"running"[\s\S]*"queued"[\s\S]*return "checks-running"[\s\S]*reviewDecision === "review-required"[\s\S]*return "review-required"[\s\S]*return "ready"/u,
	);
	assert.match(headerSource, /const \[autoMerge, setAutoMerge\] = useState\(true\)/u);
	assert.match(headerSource, /const isOpen = data\.status === "Open"/u);
	assert.match(headerSource, /const mergeReady = isOpen && data\.mergeState === "ready"/u);
	assert.match(
		headerSource,
		/requestExpandPullRequestSection|useMetadataRail/u,
	);
	assert.match(
		headerSource,
		/const openChecks = \(\) => \{[\s\S]*setPanelView\("details"\)[\s\S]*requestExpandPullRequestSection\(data\.identity, PULL_REQUEST_CHECKS_SECTION_ID\)[\s\S]*onChecksFailedClick=\{openChecks\}[\s\S]*onChecksRunningClick=\{openChecks\}[\s\S]*onMergeConflictsClick=\{openChecks\}/u,
	);
	assert.match(
		headerSource,
		/onChecksFailedClick=\{openChecks\}[\s\S]*onChecksRunningClick=\{openChecks\}[\s\S]*onMergeConflictsClick=\{openChecks\}[\s\S]*onReviewRequiredClick=\{onGuideOpen\}/u,
	);
	assert.match(
		headerSource,
		/autoMerge=\{isOpen \? autoMerge : false\}[\s\S]*onAutoMergeChange=\{isOpen \? setAutoMerge : undefined\}[\s\S]*onMergeClick=\{mergeReady \? DEMO_MERGE : undefined\}/u,
	);
	assert.match(
		headerSource,
		/url=\{data\.url\}[\s\S]*scmProviderName=\{data\.provider\.name\}/u,
	);
	assert.match(
		headerSource,
		/baseBranch=\{data\.baseBranch\}[\s\S]*headBranch=\{data\.headBranch\}[\s\S]*repository=\{data\.repository\}/u,
	);
	assert.doesNotMatch(headerSource, /authorName=\{data\.authorName\}/u);
	assert.doesNotMatch(headerSource, /additions=\{data\.additions\}/u);
	assert.doesNotMatch(headerSource, /onMoreActionsClick/u);
	assert.match(
		headerSource,
		/className=\{tabNavigation[\s\S]*\? "rounded-xl border bg-surface"[\s\S]*: "rounded-xl border bg-surface p-4"\}/u,
	);
	assert.doesNotMatch(headerSource, /style=\{\{ borderRadius: 12 \}\}/u);
	assert.doesNotMatch(headerSource, /border-b border-border pb-4/u);
	assert.match(guideSource, /data-jira-work-item-pull-request-guide/u);
	assert.match(guideSource, /data-jira-work-item-pull-request-guide-current-step/u);
	assert.match(guideSource, /data-jira-work-item-pull-request-guide-summary/u);
	assert.match(
		guideSource,
		/<h2 className="p-0 text-xs font-semibold leading-4 text-text-subtlest">Summary<\/h2>/u,
	);
	assert.doesNotMatch(guideSource, /rich-text-command-menu-heading/u);
	assert.doesNotMatch(guideSource, /text-base font-semibold text-text-subtlest/u);
	assert.match(guideSource, /ChatTimelineNavigator/u);
	assert.match(
		guideSource,
		/group\/review-guide relative flex min-w-0 flex-col gap-12 px-2[\s\S]*data-jira-work-item-pull-request-guide/u,
	);
	assert.doesNotMatch(guideSource, /group\/review-chapters/u);
	assert.match(
		guideSource,
		/data-jira-work-item-pull-request-guide-current-step[\s\S]*absolute inset-y-0 -left-6[\s\S]*ChatTimelineNavigator[\s\S]*aria-label="Guided review summary"/u,
	);
	assert.match(
		guideSource,
		/group-hover\/review-guide:opacity-100[\s\S]*group-has-\[:focus-visible\]\/review-guide:opacity-100/u,
	);
	assert.match(guideSource, /review\.summary\.join\(" "\)/u);
	assert.doesNotMatch(guideSource, /font: token\("font\.heading\.large"\)/u);
	assert.match(guideSource, /mt-2 text-pretty text-sm leading-6 text-text"/u);
	assert.doesNotMatch(guideSource, /font: token\("font\.heading\.small"\)/u);
	assert.doesNotMatch(guideSource, /font: token\("font\.heading\.medium"\)/u);
	assert.doesNotMatch(guideSource, /<h3[\s\S]*item\.title/u);
	assert.match(
		guideSource,
		/<p className="mt-2 min-w-0 text-base font-medium text-text"[\s\S]*\{item\.title\}/u,
	);
	assert.match(
		guideSource,
		/<p className="mt-1 text-sm leading-6 text-text-subtle">\{item\.description\}<\/p>/u,
	);
	assert.doesNotMatch(
		guideSource,
		/<p className="mt-2 text-sm leading-6 text-text-subtle">\{item\.description\}<\/p>/u,
	);
	assert.doesNotMatch(guideSource, /fontSize: "1\.25rem"/u);
	assert.doesNotMatch(guideSource, /fontWeight: token\("font\.weight\.medium"\)/u);
	assert.match(
		guideSource,
		/mt-3 flex w-full max-w-\[120px\] items-center gap-1/u,
	);
	assert.doesNotMatch(
		guideSource,
		/mt-2 flex w-full max-w-\[120px\] items-center gap-1/u,
	);
	assert.match(guideSource, /"h-1 min-w-px flex-1"/u);
	assert.doesNotMatch(guideSource, /h-1 min-w-px flex-1 rounded-sm/u);
	assert.match(guideSource, /mt-6 grid grid-cols-4 gap-4/u);
	assert.doesNotMatch(guideSource, /mt-2 grid grid-cols-4 gap-4/u);
	assert.doesNotMatch(guideSource, /mt-4 grid grid-cols-4 gap-4/u);
	assert.match(guideSource, /group\/metric flex min-w-0 cursor-pointer flex-col/u);
	assert.doesNotMatch(guideSource, /min-h-28/u);
	assert.doesNotMatch(guideSource, /min-h-12/u);
	assert.doesNotMatch(guideSource, /group\/metric[\s\S]*?\bjustify-between\b/u);
	assert.match(guideSource, /rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focused/u);
	assert.doesNotMatch(guideSource, /bg-surface-sunken/u);
	assert.doesNotMatch(guideSource, /group\/metric[\s\S]*?\bp-3\b/u);
	// Both swap states share one grid cell, reserving the full description
	// height before hover/focus without clipping or reflowing the chapters.
	assert.match(guideSource, /className="mt-3 grid"/u);
	assert.doesNotMatch(guideSource, /h-10 overflow-hidden|line-clamp-2/u);
	assert.match(guideSource, /font-mono text-xl leading-6 font-normal text-text/u);
	assert.match(
		guideSource,
		/invisible col-start-1 row-start-1 text-xs leading-4 font-normal text-text-subtle group-hover\/metric:visible group-focus-within\/metric:visible/u,
	);
	assert.match(guideSource, /group\/metric/u);
	assert.match(
		guideSource,
		/col-start-1 row-start-1 group-hover\/metric:invisible group-focus-within\/metric:invisible/u,
	);
	assert.match(
		guideSource,
		/group-hover\/metric:invisible[\s\S]*metric\.label[\s\S]*max-w-\[120px\][\s\S]*group-hover\/metric:visible[\s\S]*metric\.description/u,
	);
	assert.match(guideSource, /metric\.description/u);
	assert.match(guideSource, /metricBarFillClass/u);
	assert.match(guideSource, /bg-chart-danger/u);
	assert.match(guideSource, /bg-chart-warning/u);
	assert.match(guideSource, /bg-chart-success/u);
	assert.match(guideSource, /bg-bg-accent-gray-subtler/u);
	assert.doesNotMatch(guideSource, /bg-icon-discovery/u);
	assert.doesNotMatch(guideSource, /bg-icon-accent-lime/u);
	assert.doesNotMatch(guideSource, /bg-icon-accent-red/u);
	assert.doesNotMatch(guideSource, /bg-icon-accent-yellow/u);
	assert.doesNotMatch(guideSource, /bg-icon-accent-orange/u);
	assert.doesNotMatch(guideSource, /bg-icon-accent-green/u);
	assert.doesNotMatch(guideSource, /bg-chart-4/u);
	assert.match(guideSource, /polarity: "lowerIsBetter"/u);
	assert.match(guideSource, /polarity: "higherIsBetter"/u);
	assert.match(
		guideSource,
		/if \(polarity === "lowerIsBetter"\) \{[\s\S]*if \(filled <= 1\) return "bg-chart-success";[\s\S]*if \(filled <= 3\) return "bg-chart-warning";[\s\S]*return "bg-chart-danger";/u,
	);
	assert.match(
		guideSource,
		/if \(filled <= 1\) return "bg-chart-danger";[\s\S]*if \(filled <= 3\) return "bg-chart-warning";[\s\S]*return "bg-chart-success";/u,
	);
	assert.match(guideSource, /metricBarFillClass\(metric\.filled, metric\.polarity\)/u);
	assert.match(guideSource, /className="absolute inset-y-0 -left-6 z-10 flex w-8 justify-center overflow-visible"/u);
	assert.match(
		guideSource,
		/className="pointer-events-none sticky top-1\/2 h-fit -translate-y-1\/2 self-start/u,
	);
	// The expanded inset must stay inside the hover target. A margin moves the
	// target away from the pointer and makes the navigator open/close in a loop.
	assert.match(guideSource, /expandedOffsetClassName="pl-4"/u);
	assert.doesNotMatch(guideSource, /expandedOffsetClassName="ml-4"/u);
	assert.match(guideSource, /flyoutSide="right"/u);
	assert.match(timelineSource, /className=\{cn\("relative", className\)\}/u);
	assert.doesNotMatch(
		timelineSource,
		/className=\{cn\(className, isNavigatorOpen \? expandedOffsetClassName/u,
	);
	assert.match(
		timelineSource,
		/aria-hidden=\{!isNavigatorOpen\}[\s\S]*expandedOffsetClassName[\s\S]*inert=\{!isNavigatorOpen \? true : undefined\}/u,
	);
	assert.match(
		timelineSource,
		/isNavigatorOpen[\s\S]*\? "pointer-events-auto opacity-100 duration-normal ease-out-practical"[\s\S]*: "pointer-events-none opacity-0 duration-fast ease-in"/u,
	);
	assert.match(
		timelineSource,
		/transition-transform motion-reduce:translate-x-0 motion-reduce:transition-none[\s\S]*isNavigatorOpen[\s\S]*\? "translate-x-0 duration-normal ease-out-practical"[\s\S]*flyoutSide === "right" \? "-translate-x-2" : "translate-x-2"[\s\S]*"duration-fast ease-in"/u,
	);
	assert.match(timelineSource, /transition-opacity motion-reduce:transition-none/u);
	assert.doesNotMatch(timelineSource, /transition:\s*["`][^"`]*(?:width|height)/u);
	assert.doesNotMatch(guideSource, /lg:grid-cols-\[15rem_minmax\(0,1fr\)\]/u);
	assert.match(
		guideSource,
		/review\.metrics\.risk[\s\S]*review\.metrics\.impact[\s\S]*review\.metrics\.reviewDepth[\s\S]*review\.metrics\.mergeConfidence/u,
	);
	assert.match(guideSource, /<Checkbox[\s\S]*checked=\{reviewed\}[\s\S]*onCheckedChange=\{\(checked\) => onChapterReviewedChange\(item\.id, checked === true\)\}/u);
	assert.match(guideSource, />\s*Reviewed\s*<\/label>/u);
	assert.match(
		guideSource,
		/className="cursor-pointer text-xs font-semibold leading-4 text-text-subtlest"/u,
	);
	assert.doesNotMatch(guideSource, /cursor-pointer text-sm text-text-subtle/u);
	assert.match(
		guideSource,
		/className="flex items-center gap-1\.5"[\s\S]*className="text-xs font-semibold leading-4 text-text-subtlest"[\s\S]*\{index \+ 1\} \/ \{review\.chapters\.length\}[\s\S]*className="text-xs font-semibold leading-4 text-text-subtlest"[\s\S]*>\s*·\s*<\/span>[\s\S]*>\s*Reviewed\s*<\/label>[\s\S]*<Checkbox/u,
	);
	assert.doesNotMatch(guideSource, /padStart\(2,\s*"0"\)/u);
	assert.doesNotMatch(guideSource, /\{index \+ 1\}\/\{review\.chapters\.length\}/u);
	assert.match(guideSource, /resolveActiveChapterId/u);
	assert.match(guideSource, /if \(lockedChapterIdRef\.current != null\) return;/u);
	assert.match(guideSource, /lockedChapterIdRef/u);
	assert.doesNotMatch(guideSource, /IntersectionObserver/u);
	// Regression: scroll spy / chapter jump must not auto-mark Reviewed — checkbox only.
	assert.match(
		guideSource,
		/const syncActiveChapterFromScroll = \(\) => \{[\s\S]*?setActiveChapterId\(\(current\) => \(current === nextActiveId \? current : nextActiveId\)\);/u,
	);
	assert.match(
		guideSource,
		/const selectChapter = \(chapterId: string\) => \{[\s\S]*?lockedChapterIdRef\.current = chapterId;[\s\S]*?setActiveChapterId\(chapterId\);[\s\S]*?scrollContainer\.scrollTo\(/u,
	);
	const reviewedChangeCalls = [...guideSource.matchAll(/onChapterReviewedChange\(/gu)];
	assert.equal(
		reviewedChangeCalls.length,
		1,
		"reviewed state must change only via the checkbox, not scroll or chapter jump",
	);
	assert.match(
		guideSource,
		/onCheckedChange=\{\(checked\) => onChapterReviewedChange\(item\.id, checked === true\)\}/u,
	);
	assert.match(guideSource, /itemOrder="chronological"/u);
	assert.match(
		guideSource,
		/scrollContainer\.scrollTo\(\{[\s\S]*top: buildChapterJumpTarget\(scrollContainer, chapterElement\),[\s\S]*behavior: shouldReduceMotion \? "auto" : "smooth"/u,
	);
	assert.match(
		guideSource,
		/from "@\/components\/blocks\/jira-work-item\/experimental-v2\/lib\/pull-request-guide-active-chapter"/u,
	);
	assert.match(
		guideSource,
		/CHAPTER_SCROLL_LOCK_MS|scrollend/u,
	);
	assert.doesNotMatch(guideSource, /scrollIntoView/u);
	assert.doesNotMatch(guideSource, /Back<\/Button>|Next<\/Button>|Finish<\/Button>/u);
	assert.doesNotMatch(guideSource, /showFinishAction|onFinish|flex justify-end/u);
	assert.doesNotMatch(guideSource, /from "@\/components\/ui\/button"/u);
	assert.doesNotMatch(guideSource, /<nav aria-label="Guided review chapters">/u);
	assert.doesNotMatch(guideSource, /Approve pull request|onApprove|allChaptersVisited/u);
	assert.match(
		workItemSource,
		/label: "Submit review"/u,
	);
	assert.doesNotMatch(workItemSource, /Review submitted/u);
	assert.match(
		workItemSource,
		/const checkedCount = reviewedChapterIds\.size \+ inlineComments\.length/u,
	);
	assert.match(
		workItemSource,
		/badge: checkedCount > 0 \? String\(checkedCount\) : undefined/u,
	);
	assert.doesNotMatch(workItemSource, /badge: badgeCount/u);
	assert.doesNotMatch(
		workItemSource,
		/icon: <Icon aria-hidden render=\{<CommentIcon label="" size="small" \/>\} \/>/u,
	);
	assert.doesNotMatch(workItemSource, /import CommentIcon from "@atlaskit\/icon\/core\/comment"/u);
	assert.match(
		workItemSource,
		/disabled: !onPullRequestApprove,/u,
	);
	assert.match(
		workItemSource,
		/selectedPullRequestApprovalState === "available"[\s\S]*reviewedChapterIds\.size === pullRequestReviewState\.total/u,
	);
	assert.match(
		workItemSource,
		/!selectedPullRequestIdentity[\s\S]*selectedPullRequestEntry\?\.pullRequest\?\.status !== "Open"[\s\S]*pullRequestReviewState\?\.identity !== selectedPullRequestIdentity[\s\S]*pullRequestReviewState\.total === 0/u,
	);
	assert.doesNotMatch(
		workItemSource,
		/!selectedPullRequestIdentity[\s\S]*!selectedPullRequestApprovalState[\s\S]*pullRequestReviewState/u,
	);
	assert.match(
		workItemSource,
		/const guidedReview = detail\?\.guidedReview;[\s\S]*if \(!guidedReview\) return;[\s\S]*setPullRequestReviewByIdentity\(\(current\) => \{[\s\S]*if \(current\[identity\]\) return current;[\s\S]*inlineComments: \[\],[\s\S]*reviewedChapterIds: resolveInitialReviewedChapterIds\([\s\S]*pullRequestApprovalStates\?\.\[identity\]/u,
	);
	assert.match(
		workItemSource,
		/handlePullRequestChapterReviewedChange[\s\S]*const existing = current\[identity\];[\s\S]*reviewedChapterIds\.add\(chapterId\)[\s\S]*reviewedChapterIds\.delete\(chapterId\)/u,
	);
	assert.match(
		workItemSource,
		/handlePullRequestInlineCommentsChange[\s\S]*const existing = current\[identity\];[\s\S]*inlineComments: comments/u,
	);
	assert.match(workItemSource, /submitReviewAction=\{pullRequestSubmitReviewAction\}/u);
	assert.doesNotMatch(workItemSource, /primaryAction=\{pullRequestReviewAction\}/u);
	assert.doesNotMatch(activityComposerSource, /primaryAction=\{primaryAction\}/u);
	assert.match(
		workItemSource,
		/onClick: \(\) => \{[\s\S]*setReviewComposerIdentity\(selectedPullRequestIdentity\)/u,
	);
	assert.match(
		workItemSource,
		/const activePullRequestReview[\s\S]*commentCount: pullRequestReviewState\.inlineComments\.length,[\s\S]*reviewedCount: pullRequestReviewState\.reviewedChapterIds\.size,[\s\S]*reviewedTotal: pullRequestReviewState\.total/u,
	);
	assert.match(
		workItemSource,
		/<ActivityComposer[\s\S]*autoFocus=\{restoreActivityComposerFocus\}[\s\S]*pullRequestFix=\{activePullRequestFix\}[\s\S]*pullRequestReview=\{activePullRequestReview\}/u,
	);
	assert.match(
		activityComposerSource,
		/<AnimatePresence initial=\{false\} mode="popLayout">[\s\S]*<PullRequestReview[\s\S]*commentCount=\{pullRequestReview\.commentCount\}[\s\S]*defaultVerdict="approve"[\s\S]*variant="expanded"/u,
	);
	assert.match(
		activityComposerSource,
		/<PullRequestFix[\s\S]*checkName=\{pullRequestFix\.checkName\}[\s\S]*defaultValue=\{pullRequestFix\.defaultValue\}[\s\S]*variant="expanded"/u,
	);
	assert.match(
		activityComposerSource,
		/submitDisabled=\{pullRequestReview\.submitDisabled\}/u,
	);
	assert.match(
		activityComposerSource,
		/<JiraWorkItemComposerMotion[\s\S]*layout[\s\S]*layoutDependency=\{hasExpandedPullRequestComposer\}/u,
	);
	assert.match(
		workItemSource,
		/const activePullRequestFix[\s\S]*checkName: fixComposer\.checkName,[\s\S]*defaultValue: fixComposer\.defaultValue,[\s\S]*onSubmit: handlePullRequestFixSubmit/u,
	);
	assert.match(
		workItemSource,
		/onPullRequestFix\?\.\(selectedPullRequestIdentity, submission\.agentId\)/u,
	);
	assert.match(
		workItemSource,
		/handlePullRequestFixOpen[\s\S]*buildPullRequestFixComposerPrompt[\s\S]*setFixComposer\(\{\s*checkName: resolvePullRequestFixCheckName\(checks\),\s*defaultValue,\s*\}\)/u,
	);
	assert.match(
		activityComposerSource,
		/exit=\{shouldReduceMotion \? undefined : "hidden"\}[\s\S]*initial=\{shouldReduceMotion \? false : "hidden"\}/u,
	);
	assert.match(
		composerMotionSource,
		/layout=\{metadataLayoutAnimating \? false : layout\}[\s\S]*layoutDependency=\{layoutDependency \?\? placement\}/u,
	);
	assert.doesNotMatch(contextPillsSource, /primaryAction/u);
	assert.doesNotMatch(contextPillsSource, /from "@\/components\/ui\/badge"/u);
	assert.match(
		contextPillsSource,
		/\{workingSessions\.length > 0 && onOpenAgentChat \? \([\s\S]*summaryLabel/u,
	);
	assert.match(
		workItemSource,
		/pullRequestApprovalStates\?: Readonly<Record<string, "available" \| "approved">>/u,
	);
	assert.match(workItemSource, /onPullRequestApprove\?: \(identity: string\) => void/u);
	assert.match(
		workItemSource,
		/pullRequestApprovalStates\?\.\[identity\] === "approved"[\s\S]*reviewDecision: "approved" as const,[\s\S]*mergeState: "ready" as const/u,
	);
	assert.match(
		workItemSource,
		/pullRequestReviewerStatuses\[identity\] === "changes-requested"[\s\S]*reviewDecision: "changes-requested" as const,[\s\S]*mergeState: "blocked" as const/u,
	);
	assert.match(
		workItemSource,
		/const handlePullRequestReviewSubmit = useCallback\(\(submission: PullRequestReviewSubmission\) => \{[\s\S]*if \(!reviewComposerIdentity\) return false;[\s\S]*if \(submission\.verdict === "approve" && !pullRequestReviewSubmissionAvailable\) \{[\s\S]*return false;[\s\S]*mapReviewVerdictToReviewerStatus\(submission\.verdict\)[\s\S]*setPullRequestReviewerStatuses[\s\S]*if \(submission\.verdict === "approve"\) \{[\s\S]*onPullRequestApprove\?\.\(reviewComposerIdentity\);[\s\S]*setReviewComposerIdentity\(null\)[\s\S]*showPullRequestReviewToast\(submission\.verdict\)[\s\S]*return true;/u,
	);
	assert.match(
		workItemSource,
		/<Toaster id=\{PULL_REQUEST_REVIEW_TOASTER_ID\} position="bottom-left" \/>/u,
	);
	assert.match(
		workItemSource,
		/currentReviewerStatus=\{selectedPullRequestReviewerStatus\}/u,
	);
	assert.match(guideSource, /import \{ CodeList \} from "@\/components\/ui-custom\/code-list"/u);
	assert.match(
		guideSource,
		/<CodeList[\s\S]*hideSummary[\s\S]*items=\{chapterDiffs\}/u,
	);
	assert.doesNotMatch(guideSource, /defaultExpandedIds/u);
	assert.doesNotMatch(guideSource, /CodeReviewFileBrowser|CodeReview/u);
	assert.match(filesSource, /import \{ CodeReview \} from "@\/components\/blocks\/code-review"/u);
	assert.match(
		filesSource,
		/<CodeReview[\s\S]*commits=\{commits\}[\s\S]*embedded[\s\S]*expandContent[\s\S]*explorerRootLabel="Guest checkout"[\s\S]*files=\{review\.files\}[\s\S]*onInlineCommentsChange=\{onInlineCommentsChange\}/u,
	);
	assert.match(
		detailViewSource,
		/<PullRequestFiles[\s\S]*commits=\{data\.commits\}[\s\S]*review=\{review\}/u,
	);
	assert.doesNotMatch(filesSource, /CodeList|CodeReviewFileBrowser|readOnly|showSearch=\{false\}/u);
	assert.match(
		railSource,
		/id: "pull-request-details"[\s\S]*id: PULL_REQUEST_CHECKS_SECTION_ID[\s\S]*id: "pull-request-commits"/u,
	);
	assert.match(
		railSource,
		/PULL_REQUEST_CHECKS_SECTION_ID = "pull-request-checks"/u,
	);
	assert.match(
		railSource,
		/pullRequestSectionExpandRequest\.pullRequestIdentity !== data\.identity[\s\S]*consumePullRequestSectionExpandRequest\(nonce\)[\s\S]*onOpenSectionIdsChange=\{setOpenSectionIds\}[\s\S]*openSectionIds=\{openSectionIds\}/u,
	);
	assert.match(
		railSource,
		/useState<ReadonlySet<string>>\(\s*\(\) => new Set\(\[PULL_REQUEST_CHECKS_SECTION_ID\]\),\s*\)/u,
	);
	assert.match(
		railSource,
		/id: PULL_REQUEST_CHECKS_SECTION_ID,\s*defaultOpen: true,/u,
	);
	assert.match(
		metadataRailContextSource,
		/requestExpandPullRequestSection: \(pullRequestIdentity: string, sectionId: string\)[\s\S]*consumePullRequestSectionExpandRequest: \(nonce: number\)/u,
	);
	assert.match(
		metadataRailContextSource,
		/current\?\.nonce === nonce \? null : current/u,
	);
	assert.match(railSource, /title: "Details"[\s\S]*ChecksSectionTitle[\s\S]*title: "Commits"/u);
	assert.doesNotMatch(railSource, /id: "pull-request-reviewers"/u);
	assert.match(
		railSource,
		/data-jira-work-item-pull-request-details[\s\S]*?label="Approvers"[\s\S]*?<ApproversValue reviewers=\{data\.reviewers\} \/>/u,
	);
	assert.match(
		railSource,
		/className="flex items-center gap-1"[\s\S]*data-jira-work-item-pull-request-reviewers[\s\S]*role="group"[\s\S]*AvatarStatusIndicator/u,
	);
	assert.match(
		railSource,
		/function ApproversValue[\s\S]*const isAgent = reviewer\.kind === "agent"[\s\S]*shape=\{isAgent \? "hexagon" : "circle"\}[\s\S]*size="default"[\s\S]*AvatarStatusIndicator status=\{avatarStatus\}/u,
	);
	assert.match(
		railSource,
		/function reviewerAvatarStatus[\s\S]*case "approved":\s*return "approved"[\s\S]*case "changes-requested":\s*return "declined"/u,
	);
	assert.match(
		contextRailSource,
		/applyCurrentReviewerStatus\(resolved\.reviewers, currentReviewerStatus\)/u,
	);
	assert.match(
		metadataRailSource,
		/currentReviewerStatus=\{currentReviewerStatus\}/u,
	);
	assert.doesNotMatch(
		railSource,
		/function ApproversValue[\s\S]*size="sm"[\s\S]*AvatarStatusIndicator/u,
	);
	assert.doesNotMatch(railSource, /AvatarGroup|<AvatarGroup/u);
	assert.doesNotMatch(railSource, /-space-x-/u);
	assert.doesNotMatch(railSource, /flex flex-col gap-2" data-jira-work-item-pull-request-reviewers/u);
	assert.doesNotMatch(railSource, /label="Review decision"|REVIEW_DECISION|Review required/u);
	assert.match(
		railSource,
		/data-jira-work-item-pull-request-commits[\s\S]*group -mx-2 flex w-\[calc\(100%\+1rem\)\] min-w-0 flex-col rounded-md px-2 py-2 transition-colors duration-xxshort ease-out-practical hover:bg-bg-neutral-subtle-hovered motion-reduce:transition-none[\s\S]*commitUrl \? "cursor-pointer"/u,
	);
	const commitsValueSource = railSource.match(
		/function CommitsValue[\s\S]*?(?=function ChecksSectionTitle)/u,
	)?.[0] ?? "";
	assert.ok(commitsValueSource.length > 0);
	assert.match(
		commitsValueSource,
		/rounded-md[\s\S]*hover:bg-bg-neutral-subtle-hovered/u,
	);
	assert.match(
		commitsValueSource,
		/role=\{commitUrl \? "link" : undefined\}[\s\S]*tabIndex=\{commitUrl \? 0 : undefined\}[\s\S]*openScmUrl\(commitUrl\)[\s\S]*handleScmLinkKeyDown\(event, commitUrl\)/u,
	);
	assert.match(
		commitsValueSource,
		/<code className="cursor-pointer font-mono text-text-subtlest hover:underline">[\s\S]*\{commit\.shortSha\}[\s\S]*<\/code>/u,
	);
	assert.doesNotMatch(
		commitsValueSource,
		/href=\{commit\.url\}|<a[\s\S]*commit\.shortSha/u,
	);
	assert.doesNotMatch(
		commitsValueSource,
		/text-link|text-\[var\(--color-link\)\]|color-link/u,
	);
	assert.match(
		commitsValueSource,
		/copyCommitSha\(event, commit\.shortSha\)/u,
	);
	assert.match(
		railSource,
		/function copyCommitSha[\s\S]*stopPropagation[\s\S]*clipboard\.writeText/u,
	);
	assert.match(
		railSource,
		/function openScmUrl[\s\S]*window\.open\(url, "_blank", "noopener,noreferrer"\)/u,
	);
	assert.match(
		railSource,
		/function handleScmLinkKeyDown[\s\S]*event\.key === "Enter" \|\| event\.key === " "[\s\S]*openScmUrl/u,
	);
	assert.match(
		commitsValueSource,
		/pointer-events-none opacity-0[\s\S]*group-hover:pointer-events-auto group-hover:opacity-100[\s\S]*focus-visible:pointer-events-auto focus-visible:opacity-100/u,
	);
	assert.match(
		commitsValueSource,
		/className="size-3"[\s\S]*CopyIcon label="" size="small"/u,
	);
	assert.match(
		commitsValueSource,
		/aria-label=\{`Copy commit \$\{commit\.shortSha\}`\}/u,
	);
	assert.match(
		railSource,
		/flex min-w-0 items-center gap-2[\s\S]*inline-flex shrink-0 items-center gap-1 text-xs tabular-nums[\s\S]*text-text-success[\s\S]*text-text-danger/u,
	);
	assert.match(
		railSource,
		/shape=\{isAgent \? "hexagon" : "circle"\}/u,
	);
	assert.match(
		railSource,
		/flex min-w-0 items-center gap-1\.5[\s\S]*PersonAvatar person=\{commit\.author\}[\s\S]*commit\.author\.name/u,
	);
	assert.match(
		commitsValueSource,
		/commit\.timestamp[\s\S]*<span aria-hidden>·<\/span>[\s\S]*commit\.shortSha/u,
	);
	assert.doesNotMatch(railSource, /flex min-w-0 items-start gap-2/u);
	assert.match(railSource, /data-jira-work-item-pull-request-commits/u);
	assert.doesNotMatch(railSource, /data-jira-work-item-pull-request-commits[\s\S]*divide-y|divide-y divide-border/u);
	assert.match(
		railSource,
		/arePullRequestChecksInProgress/u,
	);
	assert.match(railSource, /from "@\/components\/ui\/spinner"/u);
	// The CI title reserves the compact action height before Fix all appears,
	// so running -> failed does not grow the disclosure header by 4px.
	assert.match(
		railSource,
		/function ChecksSectionTitle[\s\S]*<span className="flex min-h-6 items-center gap-1\.5">[\s\S]*CI checks/u,
	);
	assert.match(
		railSource,
		/function ChecksSectionTitle[\s\S]*inProgress \? \([\s\S]*<Spinner size="xs" \/>[\s\S]*\) : \([\s\S]*<ProgressCircle[\s\S]*aria-hidden[\s\S]*animated=\{false\}[\s\S]*size="xs"[\s\S]*value=\{total > 0 \? Math\.round\(\(passed \/ total\) \* 100\) : 0\}[\s\S]*variant="outline"/u,
	);
	assert.doesNotMatch(railSource, /trackClassName=\{failed > 0 \? "text-icon-danger" : undefined\}/u);
	assert.doesNotMatch(railSource, /checksToProgressSegments|segmented/u);
	assert.match(
		railSource,
		/const checksInProgress = arePullRequestChecksInProgress\(data\.checks\);/u,
	);
	assert.match(
		railSource,
		/ChecksSectionTitle[\s\S]*inProgress=\{checksInProgress\}[\s\S]*passed=\{passedChecks\}[\s\S]*total=\{data\.checks\.length\}/u,
	);
	// Labeled collapsed count; ArtifactPane spaces it from the title with gap-1.5 (no ·).
	// Failures are appended when present (e.g. "2/3 passed 1 failed").
	// Visible/accessible trigger text is "CI checks" + count, never a middle-dot.
	assert.match(
		railSource,
		/const checksCollapsedCount =\s*failedChecks > 0\s*\?\s*`\$\{passedChecks\}\/\$\{data\.checks\.length\} passed \$\{failedChecks\} failed`\s*:\s*`\$\{passedChecks\}\/\$\{data\.checks\.length\} passed`;/u,
	);
	assert.match(railSource, /count: checksCollapsedCount,/u);
	assert.doesNotMatch(railSource, /checksCollapsedCount =[\s\S]*·/u);
	assert.match(railSource, /title: "Commits",\s*count: data\.commits\.length,/u);
	assert.match(railSource, /data-jira-work-item-pull-request-checks/u);
	assert.match(
		railSource,
		/function ChecksValue[\s\S]*group\/check-row[\s\S]*<IconTile[\s\S]*status\.renderIcon\(\)[\s\S]*size="small"[\s\S]*variant="transparent"[\s\S]*check\.name[\s\S]*<CheckDetails check=\{check\} \/>/u,
	);
	assert.match(
		railSource,
		/function RunningCheckDetails[\s\S]*ElapsedTime prefix="Running for " startedAtMs=\{startedAtMs\}/u,
	);
	assert.match(
		railSource,
		/function CheckDetails[\s\S]*check\.status !== "running"[\s\S]*parseRunningCheckElapsedSeconds\(check\.details\)[\s\S]*initialSeconds === null[\s\S]*<RunningCheckDetails initialSeconds=\{initialSeconds\} \/>/u,
	);
	assert.match(railSource, /from "@\/components\/ui\/elapsed-time"/u);
	assert.match(
		railSource,
		/from "@\/components\/blocks\/jira-work-item\/experimental-v2\/lib\/pull-request-check-elapsed"/u,
	);
	assert.match(
		railSource,
		/function ChecksValue[\s\S]*group\/check-row[\s\S]*-mx-2[\s\S]*w-\[calc\(100%\+1rem\)\][\s\S]*cursor-pointer[\s\S]*gap-3[\s\S]*rounded-md[\s\S]*px-2 py-2[\s\S]*hover:bg-bg-neutral-subtle-hovered[\s\S]*motion-reduce:transition-none/u,
	);
	assert.match(
		railSource,
		/function ChecksValue[\s\S]*role=\{checkUrl \? "link" : undefined\}[\s\S]*tabIndex=\{checkUrl \? 0 : undefined\}[\s\S]*openScmUrl\(checkUrl\)[\s\S]*handleScmLinkKeyDown\(event, checkUrl\)/u,
	);
	assert.match(
		railSource,
		/function ChecksValue[\s\S]*truncate text-sm text-text[\s\S]*truncate text-xs text-text-subtlest/u,
	);
	// A running check spins in place of a settled status glyph (subtle spinner color, not information blue).
	assert.match(
		railSource,
		/running: \{[\s\S]*iconClassName: "text-icon-subtle"[\s\S]*renderIcon: \(\) => <Spinner label="" size="sm" \/>/u,
	);
	assert.doesNotMatch(
		railSource,
		/running: \{[\s\S]*text-icon-information/u,
	);
	assert.match(
		railSource,
		/queued: \{[\s\S]*iconClassName: "text-icon-disabled"[\s\S]*TaskToDoIcon/u,
	);
	assert.doesNotMatch(railSource, /CheckCircleUncheckedIcon/u);
	// Failed rows: Fix is the only nested control (stopPropagation); decorative
	// external icon expands on row hover. The check `<li>` is the url hit target.
	const checksValueSource = railSource.slice(
		railSource.indexOf("function FailedCheckActions"),
		railSource.indexOf("export function PullRequestDetailsRail"),
	);
	assert.match(checksValueSource, /function FailedCheckActions/u);
	assert.match(
		checksValueSource,
		/data-jira-work-item-failed-check-actions[\s\S]*aria-label=\{`Fix \$\{check\.name\}`\}[\s\S]*event\.stopPropagation\(\)[\s\S]*onFix\?\.\(check\)[\s\S]*Fix\s*<\/Button>/u,
	);
	assert.match(
		checksValueSource,
		/grid-cols-\[0fr\][\s\S]*group-hover\/check-row:grid-cols-\[1fr\][\s\S]*group-focus-within\/check-row:grid-cols-\[1fr\]/u,
	);
	assert.match(
		checksValueSource,
		/isFailed \? \(\s*<FailedCheckActions[\s\S]*onFix=\{\(failedCheck\) => onFixCheck\?\.\(\[failedCheck\]\)\}/u,
	);
	// Fix all mirrors per-row Fix: visible for any failed check, even when the
	// host has not wired onFixCheck yet (e.g. Review chapter before Fix).
	assert.match(
		railSource,
		/failedChecks > 0[\s\S]*headerAction: \{[\s\S]*appearance: "label"[\s\S]*label: "Fix all"[\s\S]*onClick: \(\) => onFixCheck\?\.\(failedCheckItems\)[\s\S]*reveal: "open"/u,
	);
	assert.doesNotMatch(
		railSource,
		/onFixCheck && failedChecks > 0[\s\S]*headerAction: \{[\s\S]*label: "Fix all"/u,
	);
	assert.match(
		checksValueSource,
		/aria-label=\{`Fix \$\{check\.name\}`\}[\s\S]*size="compact"[\s\S]*variant="outline"[\s\S]*Fix/u,
	);
	// No separate interactive external-link button on failed rows.
	assert.doesNotMatch(
		checksValueSource,
		/aria-label=\{openLabel\}|Open \$\{check\.name\} check details/u,
	);
	assert.doesNotMatch(
		checksValueSource,
		/function FailedCheckActions[\s\S]*size="icon-compact"[\s\S]*LinkExternalIcon/u,
	);
	assert.match(
		checksValueSource,
		/function FailedCheckActions[\s\S]*aria-hidden[\s\S]*IconTile[\s\S]*LinkExternalIcon[\s\S]*iconSize="small"/u,
	);
	// Passing/running/queued rows still use the non-interactive hover IconTile.
	assert.match(
		checksValueSource,
		/<IconTile[\s\S]*shrink-0 text-icon-subtle[\s\S]*opacity-0[\s\S]*group-hover\/check-row:opacity-100[\s\S]*LinkExternalIcon[\s\S]*iconSize="small"[\s\S]*size="small"[\s\S]*variant="transparent"/u,
	);
	assert.doesNotMatch(
		railSource,
		/function ChecksValue[\s\S]*Lozenge|function ChecksValue[\s\S]*status\.tone/u,
	);
	assert.doesNotMatch(railSource, /from "@\/components\/ui\/lozenge"/u);
	assert.match(railSource, /<ArtifactPane[\s\S]*showSeparators=\{false\}/u);
	assert.doesNotMatch(railSource, /label="Merge status"|MERGE_STATE|MergeSuccessIcon/u);
	assert.match(
		railSource,
		/data-jira-work-item-pull-request-details[\s\S]*?label="Approvers"[\s\S]*?label="Created"[\s\S]*?flex min-w-0 items-center gap-2[\s\S]*?PersonAvatar person=\{author\}[\s\S]*?label="Updated"[\s\S]*?label="Labels"[\s\S]*?<\/div>\s*\),\s*\},/u,
	);
	assert.doesNotMatch(railSource, /GlobeIcon|label="Provider"/u);
	assert.doesNotMatch(railSource, /Participants/u);
});

test("PR Activity menu offers Comments filter with review-thread reply and resolve", () => {
	const activityPanelSource = readFileSync(
		join(__dirname, "../components/pull-request-detail/pull-request-activity-panel.tsx"),
		"utf8",
	);

	assert.match(activityPanelSource, /filterMode: "pull-request"/u);
	assert.match(activityPanelSource, /useState<JiraActivityFilter>\("all"\)/u);
	assert.match(activityPanelSource, /onFilterChange: setFilter/u);
	assert.match(activityPanelSource, /filter=\{filter\}/u);
	assert.match(activityPanelSource, /onResolveComment=/u);
	assert.match(activityPanelSource, /type: "toggle-resolved"/u);
	assert.match(activityPanelSource, /onSubmitReply=/u);
	assert.match(activityPanelSource, /GUIDED_REVIEW_CURRENT_REVIEWER/u);
	assert.match(activityPanelSource, /useActivityChatComments/u);
	assert.match(activityPanelSource, /jiraActivitySegmentsToPlainText\(entry\.body\)/u);
	assert.match(activityPanelSource, /onAddCommentToChat=/u);
	assert.match(activityPanelSource, /onAddReplyToChat=/u);
	assert.match(activityPanelSource, /addActivityChatComment\(/u);
});
