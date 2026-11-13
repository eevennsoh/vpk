"use client";

/* eslint-disable react-hooks/exhaustive-deps -- These callbacks/effects intentionally read stable refs that bridge external animation, drag, preview, and editor state. */

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.

import { useState, useCallback, useRef, useMemo, useEffect, type CSSProperties, type FormEvent } from "react";
import { cn } from "@/lib/utils";
import { useRovoChat } from "@/app/contexts";
import { isRenderableRovoUIMessage, getMessageText, getAllDataParts, type RovoUIMessage } from "@/lib/rovo-ui-messages";
import type { RovoSuggestion } from "@/lib/rovo-suggestions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditIcon from "@atlaskit/icon/core/edit";
import AccessibilityIcon from "@atlaskit/icon/core/accessibility";
import ListChecklistIcon from "@atlaskit/icon/core/list-checklist";
import MegaphoneIcon from "@atlaskit/icon/core/megaphone";
import TextIcon from "@atlaskit/icon/core/text";
import TimelineIcon from "@atlaskit/icon/core/timeline";
import TranslateIcon from "@atlaskit/icon/core/translate";
import ChatPanel from "@/components/projects/sidebar-chat/page";
import { Terminal, TerminalHeader, TerminalContent } from "@/components/ui-custom/terminal";
import { useLazyRef } from "@/lib/use-lazy-ref";

type ViewMode = "chat" | "terminal";

// ---------------------------------------------------------------------------
// Textual Dark theme palette (from rovo TUI)
// Source: https://github.com/Textualize/textual — textual-dark theme
// TCSS: rovo_tui/style.tcss
// ---------------------------------------------------------------------------
const TD = {
	primary: "#0178D4",
	secondary: "#004578",
	accent: "#ffa62b",
	error: "#ba3c5b",
	success: "#4EBF71",
	fg: "#e0e0e0",
	dim: "#6e6e6e",
	bg: "#1e1e1e",
	surface: "#252525",
	panel: "#2d2d2d",
} as const;

// ---------------------------------------------------------------------------
// Brand colors from Rovo TUI constants
// ---------------------------------------------------------------------------
// Brand color from Rovo TUI constants: BRAND_COLOR = "#50FA7B"

// ---------------------------------------------------------------------------
// ANSI helpers using 24-bit true color
// ---------------------------------------------------------------------------
function fg(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `\x1b[38;2;${r};${g};${b}m`;
}

const A = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	primary: fg(TD.primary),
	secondary: fg(TD.secondary),
	accent: fg(TD.accent),
	error: fg(TD.error),
	success: fg(TD.success),
	text: fg(TD.fg),
	dim: fg(TD.dim),
} as const;

const B = { thick: "┃" } as const;

const ARTIFACT_UPDATE_CONTEXT = [
	"[Artifact Update Context]",
	"The user is iterating on an existing artifact in the Make surface.",
	"Treat each request as a targeted update to that artifact (content, structure, tone, or quality).",
	"When useful, propose concrete revisions and short before/after examples.",
	"[End Artifact Update Context]",
].join("\n");

const TERMINAL_SWITCH_GREETING_SUGGESTIONS: ReadonlyArray<RovoSuggestion> = [
	{
		id: "artifact-summary-refresh",
		label: "Refresh this artifact summary",
		prompt: "Refresh this artifact summary with clearer outcomes and next steps",
		icon: TimelineIcon,
		contextDescription: ARTIFACT_UPDATE_CONTEXT,
		type: "skill",
	},
	{
		id: "artifact-copy-rewrite",
		label: "Rewrite copy for clarity",
		prompt: "Rewrite this artifact copy for clarity and concise tone",
		icon: TextIcon,
		contextDescription: ARTIFACT_UPDATE_CONTEXT,
		type: "skill",
	},
	{
		id: "artifact-structure-tighten",
		label: "Tighten structure and flow",
		prompt: "Tighten the artifact structure and flow so it is easier to scan",
		icon: ListChecklistIcon,
		contextDescription: ARTIFACT_UPDATE_CONTEXT,
		type: "skill",
	},
	{
		id: "artifact-translate-audience",
		label: "Translate for another audience",
		prompt: "Translate this artifact for another audience while preserving intent",
		icon: TranslateIcon,
		contextDescription: ARTIFACT_UPDATE_CONTEXT,
		type: "skill",
	},
	{
		id: "artifact-accessibility-pass",
		label: "Add accessibility improvements",
		prompt: "Review this artifact and apply accessibility and usability improvements",
		icon: AccessibilityIcon,
		contextDescription: ARTIFACT_UPDATE_CONTEXT,
		type: "skill",
	},
	{
		id: "artifact-stakeholder-update",
		label: "Draft stakeholder update",
		prompt: "Draft a concise stakeholder update based on the current artifact state",
		icon: MegaphoneIcon,
		contextDescription: ARTIFACT_UPDATE_CONTEXT,
		type: "skill",
	},
];

// ---------------------------------------------------------------------------
// Exact ROVO_DEV_LOGO from chat_container.py
// ---------------------------------------------------------------------------
const ROVO_LOGO_LINES = [
	"        ⣀ ⣶⣿⣿⣿⣿⣶⣤⣀",
	"   ⣀⣤⣶⣿⣿⣿ ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣤⣀",
	"⢀⣴⣿⣿⣿⣿⣿⣿⣿ ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡀",
	"⣿⣿⣿⣿⣿⣿⣿⣿⣿   ⠉⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣿⣿⣿⣿      ⠙⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣿⣿⣿⣿       ⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣿⣿⣿⣿        ⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀       ⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣄      ⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣀   ⣿⣿⣿⣿⣿⣿⣿⣿⣿",
	"⠈⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ ⣿⣿⣿⣿⣿⣿⣿⠟⠁",
	"   ⠉⠛⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿ ⣿⣿⣿⠿⠛⠉",
	"        ⠉⠛⠿⣿⣿⣿⣿⠿ ⠉",
];

const LOGO_WIDTH = Math.max(...ROVO_LOGO_LINES.map((l) => l.length));
const LOGO_HEIGHT = ROVO_LOGO_LINES.length;

// Braille Unicode range: U+2800 - U+28FF
const BRAILLE_BASE = 0x2800;
function isBraille(char: string): boolean {
	const code = char.codePointAt(0) ?? 0;
	return code >= BRAILLE_BASE && code <= BRAILLE_BASE + 255;
}

// ---------------------------------------------------------------------------
// Undulation grid — port of _get_undulate_intensity from chat_container.py
// Smoothed random field with bilinear interpolation, updated at 10 FPS
// ---------------------------------------------------------------------------
const GRID_SIZE = 4;

function createRandomGrid(): number[][] {
	return Array.from({ length: GRID_SIZE + 1 }, () => Array.from({ length: GRID_SIZE + 1 }, () => Math.random()));
}

function getUndulateIntensity(cx: number, cy: number, grid: number[][]): number {
	// Map normalized coords (-1..1) to grid coords (0..GRID_SIZE)
	let gx = ((cx + 1.0) / 2.0) * GRID_SIZE;
	let gy = ((cy + 1.0) / 2.0) * GRID_SIZE;
	gx = Math.max(0, Math.min(GRID_SIZE - 0.001, gx));
	gy = Math.max(0, Math.min(GRID_SIZE - 0.001, gy));

	const x0 = Math.floor(gx);
	const y0 = Math.floor(gy);
	const wx = gx - x0;
	const wy = gy - y0;

	const v00 = grid[y0][x0];
	const v10 = grid[y0][x0 + 1];
	const v01 = grid[y0 + 1][x0];
	const v11 = grid[y0 + 1][x0 + 1];

	const v0 = v00 * (1 - wx) + v10 * wx;
	const v1 = v01 * (1 - wx) + v11 * wx;
	const intensity = v0 * (1 - wy) + v1 * wy;

	return 0.1 + intensity * 0.9; // Bias upward (from Python source)
}

// ---------------------------------------------------------------------------
// AnimatedRovoLogo — React component with undulate animation
// Renders when no messages; disappears when chat has content
// ---------------------------------------------------------------------------
function AnimatedRovoLogo() {
	const [mounted, setMounted] = useState(false);
	const [grid, setGrid] = useState(createRandomGrid);
	const gridRef = useRef(grid);
	const targetsRef = useLazyRef(() => createRandomGrid());

	useEffect(() => {
		const animationFrameId = window.requestAnimationFrame(() => {
			setMounted(true);
		});
		return () => window.cancelAnimationFrame(animationFrameId);
	}, []);

	useEffect(() => {
		// 24 FPS animation — slightly faster breathing
		const interval = setInterval(() => {
			const next = gridRef.current.map((row) => [...row]);
			const targets = targetsRef.current;
			for (let r = 0; r <= GRID_SIZE; r++) {
				for (let c = 0; c <= GRID_SIZE; c++) {
					const diff = targets[r][c] - next[r][c];
					// 20% lerp per frame — snappier movement
					next[r][c] += diff * 0.2;
					if (Math.abs(diff) < 0.1) {
						targets[r][c] = Math.random();
					}
				}
			}
			gridRef.current = next;
			setGrid(next);
		}, 42);
		return () => clearInterval(interval);
	}, []);

	const halfW = LOGO_WIDTH / 2;
	const halfH = LOGO_HEIGHT / 2;

	return (
		<div className="flex flex-1 items-center justify-center" style={{ backgroundColor: TD.bg }}>
			<div className="flex flex-col items-center gap-6">
				<div className="whitespace-pre font-mono text-sm leading-[1.2]">
					{ROVO_LOGO_LINES.map((line, y) => (
						<div key={y}>
							{[...line].map((char, x) => {
								if (isBraille(char)) {
									if (!mounted) {
										return (
											<span key={x} style={{ color: "#50FA7B", opacity: 0.5 }}>
												{char}
											</span>
										);
									}
									const cx = (x - halfW) / halfW;
									const cy = (y - halfH) / halfH;
									const intensity = getUndulateIntensity(cx, cy, grid);
									const opacity = 0.1 + intensity * 0.9;
									return (
										<span key={x} style={{ color: "#50FA7B", opacity }}>
											{char}
										</span>
									);
								}
								return (
									<span key={x} className="opacity-0">
										{char}
									</span>
								);
							})}
						</div>
					))}
				</div>
				<div className="flex flex-col items-center gap-1">
						<span className="font-mono text-sm" style={{ color: "#50FA7B" }}>
							What should we change?
						</span>
					<span className="font-mono text-xs" style={{ color: TD.dim }}>
						Rovo CLI v1.3.13-stable
					</span>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// ANSI terminal output for messages (used when conversation has messages)
// ---------------------------------------------------------------------------
function formatMessagesAsTerminalOutput(messages: ReadonlyArray<RovoUIMessage>): string {
	let output = "";

	const renderableMessages = messages.filter(isRenderableRovoUIMessage);

	for (const message of renderableMessages) {
		if (message.role === "user") {
			const displayLabel = message.metadata?.displayLabel;
			const text = displayLabel ?? getMessageText(message);
			if (text) {
				output += `\n${A.success}${A.bold}❯${A.reset} ${A.text}${text}${A.reset}\n`;
			}
			continue;
		}

		if (message.role === "assistant") {
			const thinkingParts = getAllDataParts(message, "data-thinking-status");
			for (const part of thinkingParts) {
				const label = part.data.label;
				if (label) {
					output += `${A.secondary}${B.thick}${A.reset} ${A.accent}⟳ ${label}${A.reset}\n`;
				}
			}

			const thinkingEvents = getAllDataParts(message, "data-thinking-event");
			const seenTools = new Set<string>();
			for (const event of thinkingEvents) {
				const toolName = event.data.toolName;
				const phase = event.data.phase;
				const key = `${toolName}:${event.data.toolCallId ?? event.data.eventId}`;

				if (phase === "start" && !seenTools.has(key)) {
					seenTools.add(key);
					output += `${A.secondary}${B.thick}${A.reset} ${A.primary}⚙ ${toolName}${A.reset}\n`;
				} else if (phase === "error" && event.data.errorText) {
					output += `${A.secondary}${B.thick}${A.reset} ${A.error}✗ ${toolName}: ${event.data.errorText}${A.reset}\n`;
				}
			}

			const text = getMessageText(message);
			if (text) {
				const lines = text.split("\n");
				for (const line of lines) {
					output += `${A.secondary}${B.thick}${A.reset} ${A.text}${line}${A.reset}\n`;
				}
			}

			output += "\n";
		}
	}

	return output;
}

// ---------------------------------------------------------------------------
// Terminal View — connected to useRovoChat, styled with Textual Dark
// ---------------------------------------------------------------------------
function TerminalView() {
	const { uiMessages, sendPrompt, isStreaming, hasInFlightTurn, resetChat } = useRovoChat();
	const [commandInput, setCommandInput] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const renderableMessages = useMemo(() => uiMessages.filter(isRenderableRovoUIMessage), [uiMessages]);
	const hasMessages = renderableMessages.length > 0;

	const terminalOutput = useMemo(() => (hasMessages ? formatMessagesAsTerminalOutput(uiMessages) : ""), [hasMessages, uiMessages]);

	const handleClear = useCallback(() => {
		resetChat();
	}, [resetChat]);

	const handleSubmit = useCallback(
		(e: FormEvent) => {
			e.preventDefault();
			const trimmed = commandInput.trim();
			if (!trimmed || hasInFlightTurn) return;
			void sendPrompt(trimmed);
			setCommandInput("");
		},
		[commandInput, hasInFlightTurn, sendPrompt],
	);

	return (
		<div className="flex h-full flex-col" style={{ backgroundColor: TD.bg }}>
			{/* Content: animated logo OR terminal messages */}
			{hasMessages ? (
				<Terminal output={terminalOutput} isStreaming={isStreaming} autoScroll onClear={handleClear} className="min-h-0 flex-1 rounded-none border-0" style={{ backgroundColor: TD.bg }}>
					<TerminalHeader className="hidden" />
					<TerminalContent className="max-h-none flex-1" style={{ backgroundColor: TD.bg }} />
				</Terminal>
			) : (
				<AnimatedRovoLogo />
			)}

			{/* ChatTextArea style: round $primary border */}
			<div className="mx-3 mb-2 overflow-hidden rounded-lg border" style={{ borderColor: TD.primary }}>
				<form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: "transparent" }}>
					<span className="font-mono text-sm font-bold" style={{ color: TD.success }}>
						❯
					</span>
						<input
							aria-label="Terminal command"
							ref={inputRef}
						type="text"
						value={commandInput}
						onChange={(e) => setCommandInput(e.target.value)}
						placeholder={hasInFlightTurn ? "Waiting for response..." : "Describe the artifact update..."}
						disabled={hasInFlightTurn}
						className="flex-1 bg-transparent font-mono text-sm outline-none"
						style={{
							color: TD.fg,
							caretColor: TD.primary,
						}}
						autoFocus
					/>
					{hasInFlightTurn ? (
						<span className="animate-spin font-mono text-xs" style={{ color: TD.accent }}>
							⟳
						</span>
					) : null}
				</form>
			</div>
			{/* ChatInputPromptFooter */}
			<div className="flex items-center justify-between px-4 pb-4 pt-0.5 font-mono text-xs" style={{ backgroundColor: TD.bg, color: TD.dim }}>
				<span>
					Type <span style={{ color: TD.accent }}>/</span> for commands, <span style={{ color: TD.accent }}>#</span> for files, <span style={{ color: TD.accent }}>!</span> for prompts, or{" "}
					<span style={{ color: TD.accent }}>$</span> for shell
				</span>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main Panel — mode switcher
// ---------------------------------------------------------------------------
interface TerminalSwitchPanelProps {
	onClose?: () => void;
	className?: string;
	chatPanelContainerStyle?: CSSProperties;
}

export default function TerminalSwitchPanel({
	onClose,
	className,
	chatPanelContainerStyle,
}: Readonly<TerminalSwitchPanelProps>): React.ReactElement {
	const [mode, setMode] = useState<ViewMode>("chat");
	const { resetChat } = useRovoChat();
	const isTerminal = mode === "terminal";
	const resolvedChatPanelContainerStyle: CSSProperties = {
		borderWidth: 0,
		borderRadius: 0,
		...chatPanelContainerStyle,
	};

	return (
		<div
			className={cn(
				"flex h-full w-full max-w-[400px] flex-col overflow-hidden rounded-[12px] border border-border bg-surface transition-colors duration-medium",
				className,
			)}
			{...(isTerminal ? {
				"data-subtree-theme": "",
				"data-color-mode": "dark",
				"data-theme": "dark:dark spacing:spacing typography:typography shape:shape",
			} : {})}
		>
			{/* Mode switcher unified header */}
			<div className="border-b border-border px-3 py-3 transition-colors duration-medium">
				<div className="flex items-center justify-between">
					<Tabs
						value={mode}
						onValueChange={(v) => setMode(v as ViewMode)}
					>
						<TabsList variant="default" className="h-8">
							<TabsTrigger value="chat" className="px-3">
								Chat
							</TabsTrigger>
							<TabsTrigger value="terminal" className="px-3">
								Terminal
							</TabsTrigger>
						</TabsList>
					</Tabs>
					<Button
						aria-label="New chat"
						size="icon"
						variant="ghost"
						className="size-8 text-icon-subtle"
						onClick={resetChat}
					>
						<EditIcon label="" />
					</Button>
				</div>
			</div>

			{/* Content area */}
			<div className="relative min-h-0 flex-1">
				<div className={cn("absolute inset-0 transition-opacity duration-medium", mode === "chat" ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}>
					<ChatPanel
						onClose={onClose ?? (() => {})}
						hideHeader
						containerStyle={resolvedChatPanelContainerStyle}
						sendPromptOptions={{ contextDescription: ARTIFACT_UPDATE_CONTEXT }}
						greeting={{
							heading: "What should we change?",
							illustrationSrc: "/illustration-ai/write/light.svg",
							illustrationDarkSrc: "/illustration-ai/write/dark.svg",
							suggestions: TERMINAL_SWITCH_GREETING_SUGGESTIONS,
						}}
					/>
				</div>
				<div className={cn("absolute inset-0 transition-opacity duration-medium", mode === "terminal" ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}>
					<TerminalView />
				</div>
			</div>
		</div>
	);
}
