"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";

import { Icon } from "@/components/ui/icon";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
	AGENT_ROLE_OPTIONS,
	getRoleOption,
	type AgentUserRole,
} from "@/app/data/directory/people";

export interface RoleSelectProps {
	value: AgentUserRole;
	onValueChange: (value: AgentUserRole) => void;
	id?: string;
	className?: string;
}

/**
 * Role picker for the Add user flow. The trigger shows the selected role's
 * title and description stacked, so it needs a taller, multi-line trigger than
 * the standard `SelectTrigger` allows — hence the primitive trigger here. The
 * dropdown itself reuses the design-system `SelectContent`/`SelectItem`.
 */
export function RoleSelect({ value, onValueChange, id, className }: Readonly<RoleSelectProps>) {
	const selected = getRoleOption(value);

	return (
		<Select value={value} onValueChange={(next) => onValueChange(next as AgentUserRole)}>
			<SelectPrimitive.Trigger
				id={id}
				data-slot="role-select-trigger"
				className={cn(
					"border-input bg-bg-input hover:bg-bg-input-hovered active:bg-bg-input-pressed",
					"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
					"flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors",
					"disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-(--opacity-disabled)",
					className,
				)}
			>
				<span className="flex min-w-0 flex-col gap-0.5">
					<span className="text-sm font-medium text-text">{selected.label}</span>
					<span className="text-sm text-text-subtle">{selected.description}</span>
				</span>
				<SelectPrimitive.Icon
					render={
						<Icon
							render={<ChevronDownIcon label="" size="small" spacing="none" />}
							label=""
							className="shrink-0 self-center text-text-subtle"
						/>
					}
				/>
			</SelectPrimitive.Trigger>
			<SelectContent align="start" className="max-w-[var(--anchor-width)]">
				{AGENT_ROLE_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value} className="items-start py-2">
						<span className="flex flex-col gap-0.5">
							<span className="text-sm font-medium text-text">{option.label}</span>
							<span className="text-sm text-wrap text-text-subtle">{option.description}</span>
						</span>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
