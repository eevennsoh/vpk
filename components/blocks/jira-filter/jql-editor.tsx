"use client";

import { Fragment, useId, useRef } from "react";
import GrowDiagonalIcon from "@atlaskit/icon/core/grow-diagonal";
import QuestionCircleIcon from "@atlaskit/icon/core/question-circle";
import SearchIcon from "@atlaskit/icon/core/search";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { JiraFilterField } from "./model";

const TOKEN_PATTERN = /("(?:\\.|[^"\\])*"|\b(?:AND|NOT|IN)\b|!=|=|\b[A-Za-z][\w]*\b)/gi;
const TEXT_CLASSES = "m-0 whitespace-pre-wrap break-words font-mono text-sm leading-5 [overflow-wrap:anywhere] [tab-size:2]";

function JqlSyntax({ fields, value }: Readonly<{ fields: readonly JiraFilterField[]; value: string }>) {
	return value.split(TOKEN_PATTERN).map((part, index) => {
		const color = part.startsWith('"') ? "text-text-accent-green" : /^(AND|NOT|IN|!=|=)$/i.test(part) ? "text-text-accent-purple" : fields.some((field) => field.id.toLowerCase() === part.toLowerCase()) ? "text-text-accent-blue" : undefined;
		return <Fragment key={index}><span className={color}>{part}</span></Fragment>;
	});
}

export function JqlEditor({ fields, value, error, onValueChange, onApply, onClear, onExpand, canClear, expanded = false }: Readonly<{
	fields: readonly JiraFilterField[];
	value: string;
	error: string | null;
	onValueChange: (next: string) => void;
	onApply: () => void;
	onClear: () => void;
	canClear: boolean;
	onExpand?: () => void;
	expanded?: boolean;
}>) {
	const errorId = useId();
	const codeRef = useRef<HTMLPreElement>(null);
	return (
		<div className="flex min-h-0 flex-col">
			<div className={expanded ? undefined : "px-3 pt-3"}>
				<div className={cn("relative overflow-hidden rounded-md border border-border bg-bg-input focus-within:border-border-focused focus-within:ring-1 focus-within:ring-border-focused", expanded ? "h-80" : "h-44")}>
					<pre aria-hidden="true" ref={codeRef} className={cn("pointer-events-none absolute inset-0 overflow-hidden p-3 pr-26 text-text forced-colors:hidden", TEXT_CLASSES)}>{<JqlSyntax fields={fields} value={value} />}{"\n"}</pre>
					<Textarea aria-label="JQL query" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} spellCheck={false} isMonospaced variant="none" value={value} onChange={(event) => onValueChange(event.currentTarget.value)} onScroll={(event) => { if (codeRef.current) { codeRef.current.scrollTop = event.currentTarget.scrollTop; codeRef.current.scrollLeft = event.currentTarget.scrollLeft; } }} onKeyDown={(event) => { if (event.key === "Enter" && event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); onApply(); } }} className={cn("absolute inset-0 h-full min-h-0 w-full resize-none overflow-auto rounded-none border-0 bg-transparent p-3 pr-26 text-transparent caret-text focus-visible:ring-0 aria-invalid:ring-0 [field-sizing:fixed] [-webkit-text-fill-color:transparent] forced-colors:[-webkit-text-fill-color:CanvasText]", TEXT_CLASSES)} />
					<div className="absolute right-3 top-3 flex items-center gap-0.5">
						{onExpand ? <Button aria-label="Expand JQL editor" onClick={onExpand} size="icon-compact" variant="ghost"><GrowDiagonalIcon label="" size="small" /></Button> : null}
						<Popover><PopoverTrigger render={<Button aria-label="JQL syntax help" size="icon-compact" variant="ghost" />}><QuestionCircleIcon label="" size="small" /></PopoverTrigger><PopoverContent align="end" positionerClassName="z-[800]" className="w-72"><p>Use field names with =, !=, IN, or NOT IN. Combine conditions with AND.</p><code className="text-xs">status = &quot;done&quot;</code></PopoverContent></Popover>
						<Button aria-label="Apply" onClick={onApply} size="icon-compact" variant="outline"><SearchIcon label="" size="small" /></Button>
					</div>
				</div>
				{error ? <p id={errorId} role="alert" className="pt-2 text-sm text-text-danger">{error}</p> : null}
			</div>
			<div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1", expanded ? "-ms-1.5 pt-1.5" : "ps-1.5 pe-3 py-1.5")}>
				<Button className="px-2 font-normal text-text" size="default" variant="ghost" disabled={!canClear} onClick={onClear}>Clear</Button>
				<div data-slot="jql-shortcut-hints" className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-text-subtlest"><span className="inline-flex items-center gap-1 whitespace-nowrap"><KbdGroup aria-label="Shift+Enter"><Kbd>Shift</Kbd><Kbd>Enter</Kbd></KbdGroup> to apply</span><span className="inline-flex items-center gap-1 whitespace-nowrap"><Kbd aria-label="Enter">Enter</Kbd> for a new line</span></div>
			</div>
		</div>
	);
}
