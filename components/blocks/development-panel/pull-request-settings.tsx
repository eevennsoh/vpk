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

export function PullRequestSettings() {
	const [settings, setSettings] = useState({ autoFix: false, mergeWhenReady: false, autoArchive: false });
	return (
		<Popover>
			<PopoverTrigger render={<Button aria-label="Pull request settings" size="icon-compact" type="button" variant="ghost" />}>
				<PullRequestIcon label="" size="small" />
			</PopoverTrigger>
			<PopoverContent align="end" aria-label="Pull request settings" className="w-80 max-w-[calc(100vw-2rem)] gap-0 p-2">
				{OPTIONS.map(({ key, label }) => (
					<button aria-checked={settings[key]} className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-2 text-left text-sm text-text outline-none hover:bg-bg-neutral-subtle-hovered focus-visible:ring-2 focus-visible:ring-ring" key={key} onClick={() => setSettings((current) => ({ ...current, [key]: !current[key] }))} role="switch" type="button">
						<span className="min-w-0">{label}</span>
						<SwitchIndicator checked={settings[key]} size="sm" />
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}
