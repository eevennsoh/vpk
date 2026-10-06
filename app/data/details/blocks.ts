import type { ComponentDetail } from "@/app/data/component-detail-types";

import { AGENT_DETAIL } from "./blocks/agent";
import { SKILL_CONFIG_DETAIL } from "./blocks/skill-config";
import { TRIGGER_CONFIG_DETAIL } from "./blocks/trigger-config";
import { AGENT_BENTO_DETAIL } from "./blocks/agent-bento";
import { EDITOR_PALETTE_DETAIL } from "./blocks/editor-palette";
import { EDITOR_TOOLBAR_DETAIL } from "./blocks/editor-toolbar";
import { AGENT_CARD_DETAIL } from "./blocks/agent-card";
import { TWG_AGENT_CARD_DETAIL } from "./blocks/twg-agent-card";
import { AGENT_PROFILE_CARD_DETAIL } from "./blocks/agent-profile-card";
import { AGENT_STATES_DETAIL } from "./blocks/agent-states";
import { AGENT_DIRECTORY_DETAIL } from "./blocks/agent-directory";
import { AGENT_TEMPLATES_DETAIL } from "./blocks/agent-templates";
import { ARTIFACT_DETAIL } from "./blocks/artifact";
import { ARTIFACT_PANE_DETAIL } from "./blocks/artifact-pane";
import { APPS_DIRECTORY_DETAIL } from "./blocks/apps-directory";
import { TOOLS_DIRECTORY_DETAIL } from "./blocks/tools-directory";
import { SKILLS_DIRECTORY_DETAIL } from "./blocks/skills-directory";
import { KNOWLEDGE_DIRECTORY_DETAIL } from "./blocks/knowledge-directory";
import { AGENT_USERS_DETAIL } from "./blocks/agent-users";
import { CONVERSATION_STARTERS_DETAIL } from "./blocks/conversation-starters";
import { AGENT_ACCESS_DETAIL } from "./blocks/agent-access";
import { AGENT_EVALUATION_DETAIL } from "./blocks/agent-evaluation";
import { AGENT_INSIGHTS_DETAIL } from "./blocks/agent-insights";
import { AGENT_LANYARD_DETAIL } from "./blocks/agent-lanyard";
import { LANYARD_3D_DETAIL } from "./blocks/3d-lanyard";
import { AGENT_TEST_DETAIL } from "./blocks/agent-test";
import { AGENT_SURFACES_DETAIL } from "./blocks/agent-surfaces";
import { MERMAID_DIAGRAM_DETAIL } from "./blocks/mermaid-diagram";
import { VIDEO_DETAIL } from "./blocks/video";
import { CURSOR_DETAIL } from "./blocks/cursor";
import { AGENT_PROGRESS_DETAIL } from "./blocks/agent-progress";
import { AGENT_ASSIGNMENT_DETAIL } from "./blocks/agent-assignment";
import { AGENT_SELECTOR_DETAIL } from "./blocks/agent-selector";
import { SKILL_SELECTOR_DETAIL } from "./blocks/skill-selector";
import { JIRA_WORK_ITEM_DETAIL } from "./blocks/jira-work-item";
import { AGENT_SESSION_DETAIL } from "./blocks/agent-session";
import { AGENT_SESSION_COLUMN_DETAIL } from "./blocks/agent-session-column";
import { AGENT_SESSION_FLYOUT_DETAIL } from "./blocks/agent-session-flyout";
import { OMNIBAR_DETAIL } from "./blocks/omnibar";
import { SCRUBBER_DETAIL } from "./blocks/scrubber";
import { TASK_PROGRESS_DETAIL } from "./blocks/task-progress";
import { TRIGGERS_DETAIL } from "./blocks/triggers";
import { APP_SIDEBAR_DETAIL } from "./blocks/app-sidebar";
import { ANSWER_CARD_DETAIL } from "./blocks/answer-card";
import { SPOTLIGHT_DETAIL } from "./blocks/spotlight";
import { SMART_LINK_DETAIL } from "./blocks/smart-link";
import { PULL_REQUEST_DETAIL } from "./blocks/pull-request";
import { PULL_REQUEST_HEADER_DETAIL } from "./blocks/pull-request-header";
import { PULL_REQUEST_REVIEW_DETAIL } from "./blocks/pull-request-review";
import { PULL_REQUEST_FIX_DETAIL } from "./blocks/pull-request-fix";
import { EMOJI_PICKER_DETAIL } from "./blocks/emoji-picker";
import { ROVO_CANVAS_DETAIL } from "./blocks/rovo-canvas";
import { DASHBOARD_DETAIL } from "./blocks/dashboard";
import { SIDEBAR_01_DETAIL } from "./blocks/sidebar-01";
import { SIDEBAR_02_DETAIL } from "./blocks/sidebar-02";
import { SIDEBAR_03_DETAIL } from "./blocks/sidebar-03";
import { SIDEBAR_04_DETAIL } from "./blocks/sidebar-04";
import { SIDEBAR_05_DETAIL } from "./blocks/sidebar-05";
import { SIDEBAR_06_DETAIL } from "./blocks/sidebar-06";
import { SIDEBAR_07_DETAIL } from "./blocks/sidebar-07";
import { SIDEBAR_08_DETAIL } from "./blocks/sidebar-08";
import { SIDEBAR_09_DETAIL } from "./blocks/sidebar-09";
import { SIDEBAR_10_DETAIL } from "./blocks/sidebar-10";
import { SIDEBAR_11_DETAIL } from "./blocks/sidebar-11";
import { SIDEBAR_12_DETAIL } from "./blocks/sidebar-12";
import { SIDEBAR_13_DETAIL } from "./blocks/sidebar-13";
import { SIDEBAR_14_DETAIL } from "./blocks/sidebar-14";
import { SIDEBAR_15_DETAIL } from "./blocks/sidebar-15";
import { SIDEBAR_16_DETAIL } from "./blocks/sidebar-16";
import { LOGIN_01_DETAIL } from "./blocks/login-01";
import { LOGIN_02_DETAIL } from "./blocks/login-02";
import { LOGIN_03_DETAIL } from "./blocks/login-03";
import { LOGIN_04_DETAIL } from "./blocks/login-04";
import { LOGIN_05_DETAIL } from "./blocks/login-05";
import { CHATGPT_DETAIL } from "./blocks/chatgpt";
import { CHAT_CONFIGURATION_DETAIL } from "./blocks/chat-configuration";
import { CHAT_TIMELINE_DETAIL } from "./blocks/chat-timeline";
import { SUBAGENTS_DETAIL } from "./blocks/subagents";
import { TERMINAL_SWITCH_DETAIL } from "./blocks/terminal-switch";
import { DATA_TABLE_DETAIL } from "./blocks/data-table";
import { GENERATIVE_CARD_DETAIL } from "./blocks/generative-card";
import { TOP_NAVIGATION_DETAIL } from "./blocks/top-navigation";
import { CHAT_GALLERY_DETAIL } from "./blocks/chat-gallery";
import { CODE_REVIEW_DETAIL } from "./blocks/code-review";
import { PROMPT_GALLERY_DETAIL } from "./blocks/prompt-gallery";
import { SETTINGS_DIALOG_DETAIL } from "./blocks/settings-dialog";
import { MEMORY_DETAIL } from "./blocks/memory";
import { PRODUCT_SIDEBAR_DETAIL } from "./blocks/product-sidebar";
import { SIDEBAR_RAIL_DETAIL } from "./blocks/sidebar-rail";
import { SIGNUP_01_DETAIL } from "./blocks/signup-01";
import { SIGNUP_02_DETAIL } from "./blocks/signup-02";
import { SIGNUP_03_DETAIL } from "./blocks/signup-03";
import { SIGNUP_04_DETAIL } from "./blocks/signup-04";
import { SIGNUP_05_DETAIL } from "./blocks/signup-05";
import { VISUAL_WAVEFORM_DETAIL } from "./blocks/visual-waveform";
import { QUESTION_CARD_DETAIL } from "./blocks/question-card";
import { APPROVAL_CARD_DETAIL } from "./blocks/approval-card";
import { NEXT_BEST_ACTION_DETAIL } from "./blocks/next-best-action";
import { TOOL_APPROVAL_DETAIL } from "./blocks/tool-approval";
import { CHATBOT_DETAIL } from "./blocks/chatbot";
import { JIRA_EPIC_DETAIL } from "./blocks/jira-epic";
import { AGENT_LIST_DETAIL } from "./blocks/agent-list";
import { JIRA_ACTIVITY_DETAIL } from "./blocks/jira-activity";
import { JIRA_INSIGHTS_DETAIL } from "./blocks/jira-insights";
import { JIRA_ISSUE_DETAIL } from "./blocks/jira-issue";
import { JIRA_LINKING_DETAIL } from "./blocks/jira-linking";
import { JIRA_LIST_DETAIL } from "./blocks/jira-list";
import { JIRA_KANBAN_DETAIL } from "./blocks/jira-kanban";
import { JIRA_CREATE_DETAIL } from "./blocks/jira-creating";
import { JIRA_DRAGGING_DETAIL } from "./blocks/jira-dragging";
import { JIRA_DROPZONE_DETAIL } from "./blocks/jira-dropzone";
import { JIRA_TOOLBAR_DETAIL } from "./blocks/jira-toolbar";
import { GENERATIVE_DETAIL } from "./blocks/generative";
import { GALLERY_DETAIL } from "./blocks/gallery";
import { HTML_SELECTOR_DETAIL } from "./blocks/html-selector";
import { WORKFLOW_DETAIL } from "./blocks/workflow";

export const BLOCK_DETAILS: Record<string, ComponentDetail> = {
	agent: AGENT_DETAIL,
	"skill-config": SKILL_CONFIG_DETAIL,
	"trigger-config": TRIGGER_CONFIG_DETAIL,
	"agent-bento": AGENT_BENTO_DETAIL,
	"editor-palette": EDITOR_PALETTE_DETAIL,
	"editor-toolbar": EDITOR_TOOLBAR_DETAIL,
	"agent-card": AGENT_CARD_DETAIL,
	"twg-agent-card": TWG_AGENT_CARD_DETAIL,
	"agent-profile-card": AGENT_PROFILE_CARD_DETAIL,
	"agent-states": AGENT_STATES_DETAIL,
	"agent-directory": AGENT_DIRECTORY_DETAIL,
	"agent-templates": AGENT_TEMPLATES_DETAIL,
	artifact: ARTIFACT_DETAIL,
	"artifact-pane": ARTIFACT_PANE_DETAIL,
	"apps-directory": APPS_DIRECTORY_DETAIL,
	"tools-directory": TOOLS_DIRECTORY_DETAIL,
	"skills-directory": SKILLS_DIRECTORY_DETAIL,
	"knowledge-directory": KNOWLEDGE_DIRECTORY_DETAIL,
	"agent-users": AGENT_USERS_DETAIL,
	"conversation-starters": CONVERSATION_STARTERS_DETAIL,
	"agent-access": AGENT_ACCESS_DETAIL,
	"agent-evaluation": AGENT_EVALUATION_DETAIL,
	"agent-insights": AGENT_INSIGHTS_DETAIL,
	"agent-lanyard": AGENT_LANYARD_DETAIL,
	"3d-lanyard": LANYARD_3D_DETAIL,
	"agent-test": AGENT_TEST_DETAIL,
	"agent-surfaces": AGENT_SURFACES_DETAIL,
	"mermaid-diagram": MERMAID_DIAGRAM_DETAIL,
	video: VIDEO_DETAIL,
	cursor: CURSOR_DETAIL,
	"agent-progress": AGENT_PROGRESS_DETAIL,
	"agent-assignment": AGENT_ASSIGNMENT_DETAIL,
	"agent-selector": AGENT_SELECTOR_DETAIL,
	"skill-selector": SKILL_SELECTOR_DETAIL,
	"jira-work-item": JIRA_WORK_ITEM_DETAIL,
	"agent-session": AGENT_SESSION_DETAIL,
	"agent-session-column": AGENT_SESSION_COLUMN_DETAIL,
	"agent-session-flyout": AGENT_SESSION_FLYOUT_DETAIL,
	omnibar: OMNIBAR_DETAIL,
	scrubber: SCRUBBER_DETAIL,
	"task-progress": TASK_PROGRESS_DETAIL,
	triggers: TRIGGERS_DETAIL,
	"app-sidebar": APP_SIDEBAR_DETAIL,
	"answer-card": ANSWER_CARD_DETAIL,
	spotlight: SPOTLIGHT_DETAIL,
	"smart-link": SMART_LINK_DETAIL,
	"pull-request": PULL_REQUEST_DETAIL,
	"pull-request-header": PULL_REQUEST_HEADER_DETAIL,
	"pull-request-review": PULL_REQUEST_REVIEW_DETAIL,
	"pull-request-fix": PULL_REQUEST_FIX_DETAIL,
	"emoji-picker": EMOJI_PICKER_DETAIL,
	"rovo-canvas": ROVO_CANVAS_DETAIL,
	dashboard: DASHBOARD_DETAIL,
	"sidebar-01": SIDEBAR_01_DETAIL,
	"sidebar-02": SIDEBAR_02_DETAIL,
	"sidebar-03": SIDEBAR_03_DETAIL,
	"sidebar-04": SIDEBAR_04_DETAIL,
	"sidebar-05": SIDEBAR_05_DETAIL,
	"sidebar-06": SIDEBAR_06_DETAIL,
	"sidebar-07": SIDEBAR_07_DETAIL,
	"sidebar-08": SIDEBAR_08_DETAIL,
	"sidebar-09": SIDEBAR_09_DETAIL,
	"sidebar-10": SIDEBAR_10_DETAIL,
	"sidebar-11": SIDEBAR_11_DETAIL,
	"sidebar-12": SIDEBAR_12_DETAIL,
	"sidebar-13": SIDEBAR_13_DETAIL,
	"sidebar-14": SIDEBAR_14_DETAIL,
	"sidebar-15": SIDEBAR_15_DETAIL,
	"sidebar-16": SIDEBAR_16_DETAIL,
	"login-01": LOGIN_01_DETAIL,
	"login-02": LOGIN_02_DETAIL,
	"login-03": LOGIN_03_DETAIL,
	"login-04": LOGIN_04_DETAIL,
	"login-05": LOGIN_05_DETAIL,
	chatgpt: CHATGPT_DETAIL,
	"chat-configuration": CHAT_CONFIGURATION_DETAIL,
	"chat-timeline": CHAT_TIMELINE_DETAIL,
	subagents: SUBAGENTS_DETAIL,
	"terminal-switch": TERMINAL_SWITCH_DETAIL,
	"data-table": DATA_TABLE_DETAIL,
	"generative-card": GENERATIVE_CARD_DETAIL,
	"top-navigation": TOP_NAVIGATION_DETAIL,
	"chat-gallery": CHAT_GALLERY_DETAIL,
	"code-review": CODE_REVIEW_DETAIL,
	"prompt-gallery": PROMPT_GALLERY_DETAIL,
	"settings-dialog": SETTINGS_DIALOG_DETAIL,
	memory: MEMORY_DETAIL,
	"product-sidebar": PRODUCT_SIDEBAR_DETAIL,
	"sidebar-rail": SIDEBAR_RAIL_DETAIL,
	"signup-01": SIGNUP_01_DETAIL,
	"signup-02": SIGNUP_02_DETAIL,
	"signup-03": SIGNUP_03_DETAIL,
	"signup-04": SIGNUP_04_DETAIL,
	"signup-05": SIGNUP_05_DETAIL,
	"visual-waveform": VISUAL_WAVEFORM_DETAIL,
	"question-card": QUESTION_CARD_DETAIL,
	"approval-card": APPROVAL_CARD_DETAIL,
	"next-best-action": NEXT_BEST_ACTION_DETAIL,
	"tool-approval": TOOL_APPROVAL_DETAIL,
	chatbot: CHATBOT_DETAIL,
	"jira-epic": JIRA_EPIC_DETAIL,
	"agent-list": AGENT_LIST_DETAIL,
	"jira-activity": JIRA_ACTIVITY_DETAIL,
	"jira-insights": JIRA_INSIGHTS_DETAIL,
	"jira-issue": JIRA_ISSUE_DETAIL,
	"jira-linking": JIRA_LINKING_DETAIL,
	"jira-list": JIRA_LIST_DETAIL,
	"jira-kanban": JIRA_KANBAN_DETAIL,
	"jira-creating": JIRA_CREATE_DETAIL,
	"jira-dragging": JIRA_DRAGGING_DETAIL,
	"jira-dropzone": JIRA_DROPZONE_DETAIL,
	"jira-toolbar": JIRA_TOOLBAR_DETAIL,
	generative: GENERATIVE_DETAIL,
	gallery: GALLERY_DETAIL,
	"html-selector": HTML_SELECTOR_DETAIL,
	workflow: WORKFLOW_DETAIL,
};
