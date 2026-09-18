const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

function readProjectFile(relativePath) {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PAGE_SOURCE = readProjectFile("components/projects/jira-golden-journeys-v4/page.tsx");
const EXPERIMENTAL_PAGE_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/page.tsx"),
	readProjectFile("components/blocks/jira-kanban/experimental/experimental-page-types.ts"),
].join("\n");
const EXPERIMENTAL_BOARD_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/experimental-jira-kanban.tsx"),
	readProjectFile("components/blocks/jira-kanban/experimental/components/board-column-card-list.tsx"),
].join("\n");
const ARRIVAL_HOOK_SOURCE = readProjectFile(
	"components/blocks/jira-kanban/experimental/hooks/use-created-card-arrival.ts",
);
const ARRIVAL_MOTION_SOURCE = [
	readProjectFile("components/blocks/jira-kanban/experimental/lib/card-motion.ts"),
	readProjectFile("components/blocks/jira-kanban/experimental/components/created-card-arrival-motion.tsx"),
].join("\n");

test("board session creation is route-owned and reveals the created cards once", () => {
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/onBoardAgentSessionCreate\?: \(\s*session: AgentSessionItem,\s*columnTitle: string,[\s\S]*?insertAtIndex\?: number,[\s\S]*?issueType\?: JiraKanbanCardData\["issueType"\],\s*\) => string \| undefined;/u,
	);
	assert.match(
		PAGE_SOURCE,
		/const handleBoardAgentSessionCreate = useCallback\([\s\S]*consumeDetachedAgentSession\(session\)[\s\S]*createBoardFromAgentSession\(\{\s*activity,\s*columnTitle,\s*insertAtIndex,\s*issueType,\s*session,\s*\}\)/u,
	);
	assert.match(PAGE_SOURCE, /onBoardAgentSessionCreate=\{handleBoardAgentSessionCreate\}/u);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/useBoardCreatedCardArrival\(\{\s*captureSession: agentSessionHandlers\.onCreateWorkItem,\s*onCreate: onBoardAgentSessionCreate,\s*\}\)/u,
	);
	assert.match(
		ARRIVAL_HOOK_SOURCE,
		/createdCardArrivalIdRef\.current \+= 1;[\s\S]*setCreatedCardArrival\(\(current\) => \([\s\S]*cardCodes: \[\.\.\.current\.cardCodes, cardCode\][\s\S]*cardCodes: \[cardCode\]/u,
	);
	assert.match(
		EXPERIMENTAL_PAGE_SOURCE,
		/<ExperimentalJiraKanban[\s\S]*createdCardArrival=\{createdCardArrival \?\? undefined\}[\s\S]*onCreatedCardArrivalComplete=\{handleCreatedCardArrivalComplete\}/u,
	);
	assert.match(
		ARRIVAL_HOOK_SOURCE,
		/setCreatedCardArrival\(\(current\) => current\?\.id === arrivalId \? null : current\)/u,
	);
});

test("the created-card arrival scrolls its column to the last card's bottom and leaves the landing to the create entrance", () => {
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/useCreatedCardArrivalScroll\(\{[\s\S]*arrival: createdCardArrival,[\s\S]*cardCount: count,[\s\S]*onCardListRef: setOverflowRef,[\s\S]*title: columnTitle,/u,
	);
	assert.match(
		ARRIVAL_HOOK_SOURCE,
		/useLayoutEffect\(\(\) => \{[\s\S]*arrivedCards\.length < arrival\.cardCodes\.length[\s\S]*subscribeCreatedCardBottomReveal\(cardList, arrivedCards\)/u,
	);
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/<CreatedCardArrivalMotion[\s\S]*arrival=\{presentedCardArrival\?\.columnTitle === column\.title[\s\S]*cardCode=\{card\.code\}/u,
	);
	// Arrivals no longer slide: the create entrance owns the whole landing, so
	// the wrapper must not re-add a y-offset or a competing arrive transition.
	assert.doesNotMatch(ARRIVAL_MOTION_SOURCE, /\{ opacity: 0, y: 8 \}/u);
	assert.doesNotMatch(ARRIVAL_MOTION_SOURCE, /JIRA_KANBAN_CARD_ARRIVE/u);
});

test("every created card — create well or mid-column gap drop — enters through the jira-creating entrance", () => {
	assert.match(
		ARRIVAL_MOTION_SOURCE,
		/import \{ JiraCreateEntrance \} from "@\/components\/blocks\/jira-creating\/components\/jira-creating-entrance"/u,
	);
	assert.match(
		ARRIVAL_MOTION_SOURCE,
		/import \{ getJiraCreateArrivalDelayS \} from "@\/components\/blocks\/jira-creating\/lib\/jira-creating-motion"/u,
	);
	assert.match(
		ARRIVAL_MOTION_SOURCE,
		/import \{ resolveBoardCardArrival \} from "\.\.\/lib\/board-card-arrival"/u,
	);
	// The entrance is gated on `active`, which resolveBoardCardArrival sets for
	// any arriving card — `appended` no longer picks an entrance.
	assert.match(
		ARRIVAL_MOTION_SOURCE,
		/<JiraCreateEntrance\s*active=\{cardArrival\.entering\}\s*deferred=\{waiting\}\s*enterDelayS=\{enterDelayS\}\s*onAnimationComplete=\{handleArrivalComplete\}/u,
	);
	// The wrapper must stay mounted at rest; swapping it for a fragment would
	// remount the card and wipe state opened during its entrance.
	assert.doesNotMatch(ARRIVAL_MOTION_SOURCE, /cardArrival\.entering \? \(/u);
	assert.match(ARRIVAL_MOTION_SOURCE, /data-jira-creating-arrival=\{cardArrival\.entering \|\| undefined\}/u);
});

test("created card arrivals never add a blue agent backdrop or completion hold", () => {
	assert.doesNotMatch(ARRIVAL_MOTION_SOURCE, /data-created-card-backdrop/u);
	assert.doesNotMatch(ARRIVAL_MOTION_SOURCE, /jira-issue-agent-backdrop/u);
	assert.doesNotMatch(ARRIVAL_MOTION_SOURCE, /bg-bg-accent-blue-subtlest/u);
	assert.doesNotMatch(ARRIVAL_HOOK_SOURCE, /BACKDROP_HOLD|holdMs|setTimeout/u);
	assert.match(
		ARRIVAL_HOOK_SOURCE,
		/completedIdsRef\.current\.add\(arrivalId\);\s*onComplete\?\.\(arrivalId\);/u,
	);
	assert.match(
		EXPERIMENTAL_BOARD_SOURCE,
		/useCreatedCardArrivalCompletion\(\s*onCreatedCardArrivalComplete,\s*\)/u,
	);
});
