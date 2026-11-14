const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const DETAILS_SOURCE = fs.readFileSync(path.join(__dirname, "rfp-agent-chat-details.tsx"), "utf8");

test("RFP agent chat details render trigger editor and merged activity timeline with Rovo thread links", () => {
	// Trigger editor UI
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Triggers">/u);
	assert.match(DETAILS_SOURCE, /function TriggerAddRow/u);
	assert.match(DETAILS_SOURCE, /const addTriggerControl = <TriggerAddRow \/>;/u);
	assert.match(DETAILS_SOURCE, /grid h-8 w-full grid-cols-\[2rem_minmax\(0,1fr\)\] items-center gap-x-3 rounded-lg px-2/u);
	assert.match(DETAILS_SOURCE, /hover:bg-bg-neutral-subtle-hovered/u);
	assert.match(DETAILS_SOURCE, /flex size-6 shrink-0 items-center justify-center justify-self-center text-icon-subtle/u);
	assert.match(DETAILS_SOURCE, /import \{ IconTile \} from "@\/components\/ui\/icon-tile";/u);
	assert.match(DETAILS_SOURCE, /import GenerativeIndicatorIcon from "@atlaskit\/icon-lab\/core\/generative-indicator";/u);
	assert.doesNotMatch(DETAILS_SOURCE, /@atlaskit\/icon\/core\/ai-sparkle/u);
	assert.match(DETAILS_SOURCE, /SelectTrigger[\s\S]*SelectValue/u);
	assert.match(DETAILS_SOURCE, /<IconTile[\s\S]*icon=\{<AutomationIcon label="" size="small" \/>\}[\s\S]*size="small"[\s\S]*variant="blue"/u);
	assert.doesNotMatch(DETAILS_SOURCE, /variant="none"/u);
	assert.match(DETAILS_SOURCE, /className="!h-6 gap-0 rounded-md !py-0 !pr-0 !pl-2 text-sm font-medium text-text-subtle \[&_\[data-slot=icon\]\]:size-6"/u);
	assert.doesNotMatch(DETAILS_SOURCE, /inline-flex h-6 items-center rounded-md bg-bg-neutral/u);
	assert.match(DETAILS_SOURCE, /group\/trigger-row grid grid-cols-\[2rem_minmax\(0,1fr\)\] gap-x-3 rounded-lg px-2 py-2 transition-colors duration-normal hover:bg-bg-neutral-subtle-hovered/u);
	assert.match(DETAILS_SOURCE, /const triggerPrompt = trigger\?\.prompt\?\.trim\(\) \|\| RFP_DRAFTING_TRIGGER_PROMPT;/u);
	assert.match(DETAILS_SOURCE, /Status changed to/u);
	assert.match(DETAILS_SOURCE, /<TriggerDropdown value=\{RFP_DRAFTING_COLUMN_NAME\} \/>/u);
	assert.match(DETAILS_SOURCE, /<TriggerDropdown showProjectAvatar value=\{RFP_DRAFTING_BOARD_NAME\} \/>/u);
	assert.match(DETAILS_SOURCE, /src="\/avatar-project\/rocket\.svg"[\s\S]*width=\{12\}[\s\S]*height=\{12\}/u);
	assert.match(DETAILS_SOURCE, /className="size-3 shrink-0 rounded-xs"/u);
	assert.match(DETAILS_SOURCE, /<div className="flex flex-col items-center" aria-hidden=\{true\}>/u);
	assert.match(DETAILS_SOURCE, /<div className="my-2 h-7 w-px bg-border" \/>/u);
	assert.match(DETAILS_SOURCE, /<GenerativeIndicatorIcon label="" size="small" \/>/u);
	assert.doesNotMatch(DETAILS_SOURCE, /text-\[10px\] font-semibold leading-none/u);
	assert.match(DETAILS_SOURCE, /<div className="grid min-w-0 gap-4">/u);
	assert.match(DETAILS_SOURCE, /className="self-start opacity-0 transition-opacity duration-normal group-hover\/trigger-row:opacity-100 focus-visible:opacity-100"/u);
	assert.match(DETAILS_SOURCE, /<p className="min-w-0 flex-1 text-sm leading-5 text-text">\{triggerPrompt\}<\/p>/u);
	assert.match(DETAILS_SOURCE, /aria-label="Delete trigger"/u);
	assert.match(DETAILS_SOURCE, /group-hover\/trigger-row:opacity-100/u);
	assert.match(DETAILS_SOURCE, /<span className="text-sm font-medium">\{label\}<\/span>/u);
	assert.match(DETAILS_SOURCE, /gap-1 text-sm text-text/u);
	assert.doesNotMatch(DETAILS_SOURCE, /Search triggers\.\.\./u);
	assert.doesNotMatch(DETAILS_SOURCE, /Ticket enters column/u);
	assert.doesNotMatch(DETAILS_SOURCE, /aria-label="Add trigger condition"/u);
	assert.doesNotMatch(DETAILS_SOURCE, /onClick=\{\(\) => setIsPickerOpen/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Agent Instructions">/u);
	assert.doesNotMatch(DETAILS_SOURCE, /PromptInput/u);
	assert.doesNotMatch(DETAILS_SOURCE, /Trigger natural language prompt/u);
	assert.doesNotMatch(DETAILS_SOURCE, /GPT-5\.5 Medium/u);
	assert.doesNotMatch(DETAILS_SOURCE, />\s*Save\s*<\/Button>/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Tasks">/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Skills">/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Tools">/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Knowledge">/u);
	assert.doesNotMatch(DETAILS_SOURCE, /Jira work item reader/u);
	assert.doesNotMatch(DETAILS_SOURCE, /RFP-101 approved report/u);
	assert.doesNotMatch(DETAILS_SOURCE, /Rerun policy: Completed tickets with draft output are skipped; failed tickets retry\./u);

	// Merged activity timeline (ProgressTracker)
	assert.match(DETAILS_SOURCE, /import \{ ProgressTracker, type ProgressTrackerStep \} from "@\/components\/ui\/progress-tracker";/u);
	assert.match(DETAILS_SOURCE, /import \{ Tag \} from "@\/components\/ui\/tag";/u);
	assert.match(DETAILS_SOURCE, /function getActivityTimelineSteps\(state: AgentsRfpDemoState\): ProgressTrackerStep\[\]/u);
	assert.match(DETAILS_SOURCE, /label: run\.summary/u);
	assert.match(DETAILS_SOURCE, /byline: <RunTimelineByline run=\{run\} \/>/u);
	assert.match(DETAILS_SOURCE, /state: getRunTrackerState\(run\.status\)/u);
	assert.match(DETAILS_SOURCE, /state: getActivityTrackerState\(activity\)/u);
	assert.match(DETAILS_SOURCE, /function parseRunIdTimestamp\(id: string\): number \| null/u);
	assert.match(DETAILS_SOURCE, /return parseTimelineTimestamp\(run\.finishedAt \?\? run\.startedAt\);/u);
	assert.match(DETAILS_SOURCE, /tieBreakMs: parseRunIdTimestamp\(run\.id\) \?\? Number\.NEGATIVE_INFINITY/u);
	assert.match(DETAILS_SOURCE, /sortMs: getRunTimelineSortMs\(run\)/u);
	assert.match(DETAILS_SOURCE, /compareActivityTimelineEntries/u);
	assert.match(DETAILS_SOURCE, /labelClassName="text-sm leading-5"/u);
	assert.match(DETAILS_SOURCE, /bylineClassName="text-xs leading-4"/u);
	assert.match(DETAILS_SOURCE, /className="\[&_\[data-slot=progress-tracker-content\]\]:gap-0"/u);
	assert.match(DETAILS_SOURCE, /data-run-timeline-timestamp/u);
	assert.match(DETAILS_SOURCE, /data-run-timeline-metadata/u);
	assert.match(DETAILS_SOURCE, /<span className="grid gap-1">/u);

	// Thread links rendered as Tag pills (not "X thread" text)
	assert.match(DETAILS_SOURCE, /href=\{`\/rovo\/\$\{encodeURIComponent\(link\.threadId\)\}`\}/u);
	assert.match(DETAILS_SOURCE, /<Tag[\s\S]*color="blue"[\s\S]*\{link\.ticketCode\}[\s\S]*<\/Tag>/u);
	assert.doesNotMatch(DETAILS_SOURCE, /\{link\.ticketCode\} thread/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<span className="flex flex-wrap items-center gap-x-1\.5 gap-y-1">\s*\{timestampLabel \?/u);
	assert.doesNotMatch(DETAILS_SOURCE, /run\.triggerLabel,[\s\S]*run\.source,[\s\S]*timestampLabel/u);

	// Removed sections
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Run log">/u);
	assert.doesNotMatch(DETAILS_SOURCE, /<DetailsSection title="Activity">/u);
	assert.doesNotMatch(DETAILS_SOURCE, /RfpAgentDetailsSheet/u);
	assert.doesNotMatch(DETAILS_SOURCE, /SheetContent/u);
	assert.doesNotMatch(DETAILS_SOURCE, /Weekdays at 9:00 AM/u);
	assert.doesNotMatch(DETAILS_SOURCE, /Approval required/u);
});
