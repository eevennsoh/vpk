"use client";

import { useState } from "react";
import PullRequestIcon from "@atlaskit/icon/core/pull-request";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SwitchIndicator } from "@/components/ui/switch";

const OPTIONS = [
	{ key: "autoFix", label: "Auto-fix" },
	{ key: "mergeWhenReady", label: "Merge when ready" },
	{ key: "autoArchive", label: "Auto-archive on merge or close" },
] as const;

export interface PullRequestSettingsProps {
	autoFix?: boolean;
	mergeWhenReady?: boolean;
	onAutoFixChange?: (enabled: boolean) => void;
	onMergeWhenReadyChange?: (enabled: boolean) => void;
	disabled?: boolean;
}

export function PullRequestSettings({ autoFix, mergeWhenReady, onAutoFixChange, onMergeWhenReadyChange, disabled = false }: Readonly<PullRequestSettingsProps> = {}) {
	const [settings, setSettings] = useState({ autoFix: false, mergeWhenReady: false, autoArchive: false });
	const values = { ...settings, autoFix: autoFix ?? settings.autoFix, mergeWhenReady: mergeWhenReady ?? settings.mergeWhenReady };
	function change(key: keyof typeof settings) {
		const next = !values[key];
		if (key === "autoFix" && autoFix !== undefined) onAutoFixChange?.(next);
		else if (key === "mergeWhenReady" && mergeWhenReady !== undefined) onMergeWhenReadyChange?.(next);
		else setSettings((current) => ({ ...current, [key]: next }));
	}
	return (
		<Popover>
			<PopoverTrigger render={<Button aria-label="Pull request settings" size="icon-compact" type="button" variant="ghost" />}>
				<PullRequestIcon label="" size="small" />
			</PopoverTrigger>
			<PopoverContent align="end" aria-label="Pull request settings" className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-1">
				{OPTIONS.map(({ key, label }) => (
					<button aria-checked={values[key]} className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-2 text-left text-sm text-text outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-50" disabled={disabled || (key === "autoFix" && autoFix !== undefined && !onAutoFixChange) || (key === "mergeWhenReady" && mergeWhenReady !== undefined && !onMergeWhenReadyChange)} key={key} onClick={() => change(key)} role="switch" type="button">
						<span className="min-w-0">{label}</span>
						<SwitchIndicator checked={values[key]} size="sm" />
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}
