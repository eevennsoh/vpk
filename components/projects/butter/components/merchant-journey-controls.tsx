"use client";

import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FOCUS_RING_CLIP_GUTTER } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import type { MerchantJourneyPhase } from "../data/merchant-journey";

const STEPS = ["Prepare & invoke", "In progress", "Pull request", "Fix checks", "Done"] as const;

type Props = Readonly<{ phase: MerchantJourneyPhase; boardSeen: boolean; onSelectStep: (step: number) => void }>;

function currentStep({ phase, boardSeen }: Props) {
	return phase === "prepare" || phase === "invoke" ? 0 : phase === "working" ? (boardSeen ? 1 : 0) : phase === "pr" ? 2 : phase === "merged" ? 4 : 3;
}

export function MerchantJourneyControls(props: Props) {
	const active = currentStep(props);
	return <div className={cn("scrollbar-none max-w-[calc(100vw-12rem)] overflow-x-auto", FOCUS_RING_CLIP_GUTTER)}>
		<ButtonGroup aria-label="Merchant onboarding journey steps" className="w-max [&>[data-slot]~[data-slot]]:-ml-px [&>[data-slot]~[data-slot]]:border-l!" variant="connected">
			{STEPS.map((label, index) => <Button aria-pressed={active === index} className="aria-pressed:z-10" key={label} onClick={() => props.onSelectStep(index)} size="compact" type="button" variant="outline">{label}</Button>)}
		</ButtonGroup>
	</div>;
}

export function MerchantJourneyCompactControls(props: Props) {
	const active = currentStep(props);
	return <div className="flex items-center gap-2 text-sm text-text">
		<Button aria-label="Previous step" disabled={active === 0} onClick={() => props.onSelectStep(active - 1)} size="icon-compact" type="button" variant="outline"><ChevronLeftIcon label="" size="small" /></Button>
		<DropdownMenu>
			<DropdownMenuTrigger render={<button aria-label="Jump to step" className="flex items-center gap-1 rounded-sm px-1 py-0.5 text-text outline-none hover:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring/50" type="button" />}>
				<span>{STEPS[active]}</span><ChevronDownIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="center">
				{STEPS.map((label, index) => <DropdownMenuItem key={label} onSelect={() => props.onSelectStep(index)} selected={index === active}>{label}</DropdownMenuItem>)}
			</DropdownMenuContent>
		</DropdownMenu>
		<Button aria-label="Next step" disabled={active === STEPS.length - 1} onClick={() => props.onSelectStep(active + 1)} size="icon-compact" type="button" variant="outline"><ChevronRightIcon label="" size="small" /></Button>
	</div>;
}
