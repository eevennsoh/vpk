import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import { IssueTypeGlyph } from "@/components/blocks/jira-list/jira-list-cells";
import type { JiraListIssueType } from "@/components/blocks/jira-list/jira-list-types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function JiraListHierarchyButton({ expanded, label, onClick, disabled }: Readonly<{
	disabled?: boolean;
	expanded: boolean;
	label: string;
	onClick: () => void;
}>) {
	return (
		<Button
			aria-expanded={expanded}
			aria-label={label}
			className="ms-2 size-5 shrink-0 rounded-sm px-0 hover:bg-transparent focus-visible:bg-bg-neutral-subtle-hovered"
			disabled={disabled}
			onClick={onClick}
			selectedAppearance="icon-only"
			size="icon-compact"
			variant="ghost"
		>
			<Icon className="text-icon-subtle" render={expanded ? <ChevronDownIcon label="" size="small" /> : <ChevronRightIcon label="" size="small" />} />
		</Button>
	);
}

export function JiraListIssueSelection({ checked, issueKey, issueType, onChange, showCheckbox }: Readonly<{
	checked: boolean;
	issueKey: string;
	issueType: JiraListIssueType;
	onChange?: (issueKey: string, checked: boolean) => void;
	showCheckbox: boolean;
}>) {
	return (
		<span className="group/issue-selection relative inline-flex size-4 shrink-0 items-center justify-center">
			<span className={cn("pointer-events-none inline-flex size-4 items-center justify-center group-hover/issue-selection:opacity-0 group-has-[:focus-visible]/issue-selection:opacity-0 [@media(hover:none)]:opacity-0", showCheckbox && "opacity-0")}>
				<IssueTypeGlyph issueType={issueType} large />
			</span>
			<Checkbox
				aria-label={`Select ${issueKey}`}
				checked={checked}
				className={cn("absolute inset-0 opacity-0 group-hover/issue-selection:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100", showCheckbox && "opacity-100")}
				onCheckedChange={(value) => onChange?.(issueKey, Boolean(value))}
			/>
		</span>
	);
}
