import AiChatIcon from "@atlaskit/icon/core/ai-chat";
import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import BookWithBookmarkIcon from "@atlaskit/icon/core/book-with-bookmark";
import CalendarIcon from "@atlaskit/icon/core/calendar";
import ChartBarIcon from "@atlaskit/icon/core/chart-bar";
import CommentIcon from "@atlaskit/icon/core/comment";
import EditBulkIcon from "@atlaskit/icon/core/edit-bulk";
import EmailIcon from "@atlaskit/icon/core/email";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import ListBulletedIcon from "@atlaskit/icon/core/list-bulleted";
import PageIcon from "@atlaskit/icon/core/page";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import SearchIcon from "@atlaskit/icon/core/search";
import TaskIcon from "@atlaskit/icon/core/task";

/**
 * Atlaskit core icons all share the same call signature, so we reuse one icon's
 * type as the registry component type. A hand-written signature would be too
 * loose (the real `color`/`size` props are restricted token unions).
 */
export type StarterIconComponent = typeof AiChatIcon;

/** Stable keys persisted on each starter so the chosen icon survives reorders. */
export type StarterIconKey =
	| "ai-chat"
	| "ai-sparkle"
	| "comment"
	| "lightbulb"
	| "list-bulleted"
	| "chart-bar"
	| "calendar"
	| "email"
	| "task"
	| "question-circle"
	| "edit-bulk"
	| "book-with-bookmark"
	| "search"
	| "page"
	| "people-group";

export interface StarterIconOption {
	key: StarterIconKey;
	label: string;
	Icon: StarterIconComponent;
}

/** Icons offered in the per-starter picker popover. */
export const STARTER_ICON_OPTIONS: readonly StarterIconOption[] = [
	{ key: "ai-chat", label: "AI chat", Icon: AiChatIcon },
	{ key: "ai-sparkle", label: "AI sparkle", Icon: AiSparkleIcon },
	{ key: "comment", label: "Comment", Icon: CommentIcon },
	{ key: "lightbulb", label: "Idea", Icon: LightbulbIcon },
	{ key: "list-bulleted", label: "List", Icon: ListBulletedIcon },
	{ key: "chart-bar", label: "Chart", Icon: ChartBarIcon },
	{ key: "calendar", label: "Calendar", Icon: CalendarIcon },
	{ key: "email", label: "Email", Icon: EmailIcon },
	{ key: "task", label: "Task", Icon: TaskIcon },
	{ key: "question-circle", label: "Question", Icon: QuestionCircleIcon },
	{ key: "edit-bulk", label: "Draft", Icon: EditBulkIcon },
	{ key: "book-with-bookmark", label: "Docs", Icon: BookWithBookmarkIcon },
	{ key: "search", label: "Search", Icon: SearchIcon },
	{ key: "page", label: "Page", Icon: PageIcon },
	{ key: "people-group", label: "People", Icon: PeopleGroupIcon },
] as const;

export const DEFAULT_STARTER_ICON: StarterIconKey = "ai-chat";

const STARTER_ICON_BY_KEY: ReadonlyMap<StarterIconKey, StarterIconComponent> =
	new Map(STARTER_ICON_OPTIONS.map((option) => [option.key, option.Icon]));

/** Resolve an icon key to its component, falling back to the default glyph. */
export function getStarterIcon(key: StarterIconKey): StarterIconComponent {
	return STARTER_ICON_BY_KEY.get(key) ?? AiChatIcon;
}

/** A single editable conversation starter row. */
export interface ConversationStarter {
	id: string;
	text: string;
	icon: StarterIconKey;
}

/**
 * Suggestion pool used by the built-in "Generate for me" fallback when the
 * consumer does not supply an `onGenerate` handler.
 */
export const SAMPLE_CONVERSATION_STARTERS: readonly Omit<
	ConversationStarter,
	"id"
>[] = [
	{ text: "Summarize the latest Jira updates on this project", icon: "ai-sparkle" },
	{ text: "Draft a status update for stakeholders in Confluence", icon: "edit-bulk" },
	{ text: "What are the open risks and blockers in Jira?", icon: "question-circle" },
	{ text: "Break this goal down into actionable Jira work items", icon: "list-bulleted" },
	{ text: "Compare this quarter's Jira metrics to last quarter", icon: "chart-bar" },
	{ text: "Find related Confluence docs and decisions", icon: "book-with-bookmark" },
] as const;
