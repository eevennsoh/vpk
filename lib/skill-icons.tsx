"use client";

import type { ComponentProps, ComponentType, ReactNode } from "react";

// Skill-tag icons mapping. Skill tags appear in the Studio bento tiles
// (`HOME_STARTER_VIEWS`) and the agent-template directory cards
// (`SKILL_LABELS` / `defaultSkills`). Both data sources reference this map so a
// given skill label always renders the same suitable ADS icon.
//
// Icons are sourced from the Atlassian Design System (`@atlaskit/icon` core and
// `@atlaskit/icon-lab`). Labels that share a concept intentionally share an
// icon. Unmapped labels fall back to the generic Skill icon via
// `getSkillIcon`.

import SkillIcon from "@atlaskit/icon-lab/core/skill";

// core
import AccessibilityIcon from "@atlaskit/icon/core/accessibility";
import AiSparkleIcon from "@atlaskit/icon/core/ai-sparkle";
import AiGenerativeTextSummaryIcon from "@atlaskit/icon/core/ai-generative-text-summary";
import BranchIcon from "@atlaskit/icon/core/branch";
import BugIcon from "@atlaskit/icon/core/bug";
import CalendarPlusIcon from "@atlaskit/icon/core/calendar-plus";
import ChangesIcon from "@atlaskit/icon/core/changes";
import ChartBarIcon from "@atlaskit/icon/core/chart-bar";
import ChartPieIcon from "@atlaskit/icon/core/chart-pie";
import ChartTrendDownIcon from "@atlaskit/icon/core/chart-trend-down";
import CheckCircleIcon from "@atlaskit/icon/core/check-circle";
import ClockIcon from "@atlaskit/icon/core/clock";
import CommentIcon from "@atlaskit/icon/core/comment";
import DecisionIcon from "@atlaskit/icon/core/decision";
import EditIcon from "@atlaskit/icon/core/edit";
import EditBulkIcon from "@atlaskit/icon/core/edit-bulk";
import EpicIcon from "@atlaskit/icon/core/epic";
import ExclamationSquareIcon from "@atlaskit/icon/core/exclamation-square";
import FeedbackIcon from "@atlaskit/icon/core/feedback";
import FieldIcon from "@atlaskit/icon/core/field";
import FileIcon from "@atlaskit/icon/core/file";
import FilterIcon from "@atlaskit/icon/core/filter";
import FlagFilledIcon from "@atlaskit/icon/core/flag-filled";
import FlaskIcon from "@atlaskit/icon/core/flask";
import GlassesIcon from "@atlaskit/icon/core/glasses";
import IncidentIcon from "@atlaskit/icon/core/incident";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import MegaphoneIcon from "@atlaskit/icon/core/megaphone";
import OnCallIcon from "@atlaskit/icon/core/on-call";
import PeopleGroupIcon from "@atlaskit/icon/core/people-group";
import PersonIcon from "@atlaskit/icon/core/person";
import PriorityLowIcon from "@atlaskit/icon/core/priority-low";
import QuotationMarkIcon from "@atlaskit/icon/core/quotation-mark";
import ReleaseIcon from "@atlaskit/icon/core/release";
import ScalesIcon from "@atlaskit/icon/core/scales";
import SendIcon from "@atlaskit/icon/core/send";
import ShieldIcon from "@atlaskit/icon/core/shield";
import SprintIcon from "@atlaskit/icon/core/sprint";
import StatusErrorIcon from "@atlaskit/icon/core/status-error";
import SupportIcon from "@atlaskit/icon/core/support";
import TagIcon from "@atlaskit/icon/core/tag";
import TargetIcon from "@atlaskit/icon/core/target";
import TaskIcon from "@atlaskit/icon/core/task";
import TaskToDoIcon from "@atlaskit/icon/core/task-to-do";
import ThemeIcon from "@atlaskit/icon/core/theme";
import TranslateIcon from "@atlaskit/icon/core/translate";
import WarningIcon from "@atlaskit/icon/core/warning";

// icon-lab
import AiGenerativeCleanupIcon from "@atlaskit/icon-lab/core/ai-generative-cleanup";
import AiSearchIcon from "@atlaskit/icon-lab/core/ai-search";
import AskIcon from "@atlaskit/icon-lab/core/ask";
import BookOpenIcon from "@atlaskit/icon-lab/core/book-open";
import CapabilityIcon from "@atlaskit/icon-lab/core/capability";
import ChartFunnelIcon from "@atlaskit/icon-lab/core/chart-funnel";
import CompareIcon from "@atlaskit/icon-lab/core/compare";
import DataVisualizationMetricIcon from "@atlaskit/icon-lab/core/data-visualization-metric";
import GroupIcon from "@atlaskit/icon-lab/core/group";
import JourneysIcon from "@atlaskit/icon-lab/core/journeys";
import MilestoneMultipleIcon from "@atlaskit/icon-lab/core/milestone-multiple";
import PersonAssigneeIcon from "@atlaskit/icon-lab/core/person-assignee";
import RoadmapsServiceIcon from "@atlaskit/icon-lab/core/roadmaps-service";
import StatusWorkflowInReviewIcon from "@atlaskit/icon-lab/core/status-workflow-in-review";
import StatusWorkflowScheduledIcon from "@atlaskit/icon-lab/core/status-workflow-scheduled";
import TextAudioTranscriptIcon from "@atlaskit/icon-lab/core/text-audio-transcript";
import WorkflowControlsIcon from "@atlaskit/icon-lab/core/workflow-controls";

type AtlaskitIcon = ComponentType<ComponentProps<typeof SkillIcon>>;

// Maps every known skill label to an ADS icon component. Labels with a shared
// concept share an icon; anything not listed falls back to `SkillIcon`.
const SKILL_LABEL_ICONS: Readonly<Record<string, AtlaskitIcon>> = {
	// brainstorm / planning
	"decision-framing": DecisionIcon,
	planning: ListChecklistIcon,
	"rubric-building": ScalesIcon,
	"rubric-building-alt": ScalesIcon,
	"option-mapping": GroupIcon,
	"assumption-check": WarningIcon,
	"tradeoff-analysis": ScalesIcon,
	"hypothesis-shaping": FlaskIcon,
	"research-scan": AiSearchIcon,
	"idea-ranking": PriorityLowIcon,
	"constraint-mapping": GroupIcon,
	"opportunity-sizing": TargetIcon,
	"confidence-scoring": ScalesIcon,
	"concept-briefing": LightbulbIcon,
	facilitation: PeopleGroupIcon,
	"next-step-planning": CalendarPlusIcon,
	"evidence-gap-check": WarningIcon,
	"risk-spotting": WarningIcon,
	"stakeholder-input": PeopleGroupIcon,
	"experiment-shaping": FlaskIcon,
	"goal-alignment": TargetIcon,

	// analyze / insights
	"signal-detection": ChartTrendDownIcon,
	synthesis: AiSparkleIcon,
	briefing: FileIcon,
	"feedback-clustering": FeedbackIcon,
	"sentiment-mapping": FeedbackIcon,
	"theme-mining": ThemeIcon,
	"transcript-review": TextAudioTranscriptIcon,
	"funnel-diagnosis": ChartFunnelIcon,
	"research-synthesis": AiSearchIcon,
	"trend-analysis": ChartTrendDownIcon,
	"evidence-linking": CompareIcon,
	"insight-prioritization": PriorityLowIcon,
	"quote-selection": QuotationMarkIcon,
	"anomaly-scan": WarningIcon,
	"source-tracing": AiSearchIcon,
	"impact-mapping": ChartBarIcon,
	"segment-compare": ChartPieIcon,
	"need-finding": AiSearchIcon,
	"metric-context": DataVisualizationMetricIcon,
	"decision-brief": DecisionIcon,

	// review / operations
	triage: FilterIcon,
	handoff: SendIcon,
	"risk-review": ShieldIcon,
	"incident-routing": IncidentIcon,
	"queue-health": StatusErrorIcon,
	"escalation-drafting": MegaphoneIcon,
	"sla-check": ClockIcon,
	"owner-mapping": PersonIcon,
	"policy-lookup": ShieldIcon,
	"process-review": StatusWorkflowInReviewIcon,
	"service-summary": RoadmapsServiceIcon,
	"on-call-briefing": OnCallIcon,
	"postmortem-scan": IncidentIcon,
	"dependency-check": BranchIcon,
	"readiness-review": StatusWorkflowInReviewIcon,
	"support-reply": SupportIcon,
	"status-update": ChangesIcon,
	"runbook-match": BookOpenIcon,
	"compliance-note": ShieldIcon,
	"knowledge-gap": AskIcon,

	// summarize / writing
	drafting: EditIcon,
	editing: EditIcon,
	"audience-fit": PeopleGroupIcon,
	"release-note-grouping": ReleaseIcon,
	"executive-summary": AiGenerativeTextSummaryIcon,
	"tone-matching": GlassesIcon,
	"translation-review": TranslateIcon,
	"social-adaptation": MegaphoneIcon,
	"prd-outline": ListChecklistIcon,
	"message-polish": CommentIcon,
	"changelog-writing": ChangesIcon,
	"content-briefing": FileIcon,
	"decision-summary": DecisionIcon,
	"meeting-recap": TextAudioTranscriptIcon,
	"stakeholder-update": PeopleGroupIcon,
	"brand-review": GlassesIcon,
	"accessibility-copy": AccessibilityIcon,
	"clarity-pass": GlassesIcon,
	"narrative-structure": FileIcon,
	"action-extraction": ListChecklistIcon,

	// create / work management
	"work-breakdown": TaskIcon,
	sequencing: WorkflowControlsIcon,
	readiness: CheckCircleIcon,
	"sprint-scope": SprintIcon,
	"blocker-scan": ExclamationSquareIcon,
	"bug-reporting": BugIcon,
	"epic-shaping": EpicIcon,
	"owner-routing": PersonAssigneeIcon,
	"queue-cleanup": AiGenerativeCleanupIcon,
	"progress-summary": ChartBarIcon,
	"dependency-map": BranchIcon,
	"acceptance-criteria": CheckCircleIcon,
	"task-slicing": TaskToDoIcon,
	"milestone-planning": MilestoneMultipleIcon,
	"risk-log": WarningIcon,
	"handoff-plan": SendIcon,
	"capacity-check": ScalesIcon,
	"workflow-design": WorkflowControlsIcon,
	prioritization: PriorityLowIcon,
	"status-drafting": ChangesIcon,

	// misc shared concepts
	"readiness-check": CheckCircleIcon,
	scheduling: StatusWorkflowScheduledIcon,
	capability: CapabilityIcon,
	journey: JourneysIcon,
	field: FieldIcon,
	tag: TagIcon,
	edit: EditBulkIcon,
	flag: FlagFilledIcon,
};

/**
 * Returns a small ADS icon node for a skill label, falling back to a generic
 * Skill icon for unmapped labels. Lookup is case-insensitive.
 */
export function getSkillIcon(label: string): ReactNode {
	const Icon = SKILL_LABEL_ICONS[label] ?? SKILL_LABEL_ICONS[label.toLowerCase()] ?? SkillIcon;
	return <Icon label="" size="small" />;
}
