"use client";

import { useState, type ReactNode } from "react";
import CustomizeIcon from "@atlaskit/icon/core/customize";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SwitchIndicator } from "@/components/ui/switch";

const OPTIONS = [
	{ key: "autoFix", label: "Auto-fix" },
	{ key: "mergeWhenReady", label: "Merge when ready" },
	{ key: "autoArchive", label: "Auto-archive on merge or close" },
] as const;

export interface DevelopmentSettingsOptions {
	autoFix?: boolean;
	mergeWhenReady?: boolean;
	onAutoFixChange?: (enabled: boolean) => void;
	onMergeWhenReadyChange?: (enabled: boolean) => void;
	disabled?: boolean;
}

export function DevelopmentSettings({ autoFix, connections, mergeWhenReady, onAutoFixChange, onMergeWhenReadyChange, disabled = false }: Readonly<DevelopmentSettingsOptions & { connections: ReactNode }>) {
	const [settings, setSettings] = useState({ autoFix: true, mergeWhenReady: true, autoArchive: false });
	const values = { ...settings, autoFix: autoFix ?? settings.autoFix, mergeWhenReady: mergeWhenReady ?? settings.mergeWhenReady };
	function change(key: keyof typeof settings) {
		const next = !values[key];
		if (key === "autoFix" && autoFix !== undefined) onAutoFixChange?.(next);
		else if (key === "mergeWhenReady" && mergeWhenReady !== undefined) onMergeWhenReadyChange?.(next);
		else setSettings((current) => ({ ...current, [key]: next }));
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button aria-label="Configure" size="icon-compact" type="button" variant="ghost" />}>
				<CustomizeIcon label="" size="small" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" aria-label="Configure" className="w-80 max-w-[calc(100vw-2rem)]">
				{OPTIONS.map(({ key, label }) => (
					<DropdownMenuItem aria-checked={values[key]} className="text-left" closeOnClick={false} disabled={disabled || (key === "autoFix" && autoFix !== undefined && !onAutoFixChange) || (key === "mergeWhenReady" && mergeWhenReady !== undefined && !onMergeWhenReadyChange)} elemAfter={<SwitchIndicator checked={values[key]} size="sm" />} key={key} nativeButton onSelect={() => change(key)} render={<button type="button" />} role="menuitemcheckbox">{label}</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuSub>
					<DropdownMenuSubTrigger aria-haspopup="dialog" aria-label="Connections">Connections</DropdownMenuSubTrigger>
					<DropdownMenuSubContent aria-label="Connections" className="max-h-[min(32rem,var(--available-height,32rem))] w-[350px] max-w-[calc(100vw-2rem)]" role="dialog">{connections}</DropdownMenuSubContent>
				</DropdownMenuSub>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
