"use client";

// oxlint-disable react-doctor/exhaustive-deps -- Effects in this file intentionally coordinate refs, external animation loops, timers, subscriptions, or measured DOM state; dependencies are constrained to avoid restarting those bridges.

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { useAdmin } from "@/components/blocks/product-sidebar/variants/admin-context";
import {
	AdminCard,
	AdminPageShell,
	AdminToggleRow,
	AdminViewHeader,
} from "./view-primitives";
import { AdminRovoPrototypeNotice } from "./rovo-admin-cluster-primitives";

export function RovoSettingsView() {
	const { rovoChatEnabled, setRovoChatEnabled } = useAdmin();
	const [isEnableModalOpen, setIsEnableModalOpen] = useState(false);
	const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [isAiEnabled, setIsAiEnabled] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current !== null) {
				clearTimeout(timerRef.current);
			}
		};
	}, []);

	const finishAiToggle = useCallback((enabled: boolean) => {
		setIsLoading(true);
		timerRef.current = setTimeout(() => {
			setIsLoading(false);
			setIsAiEnabled(enabled);
			setIsEnableModalOpen(false);
			setIsDisableModalOpen(false);
			timerRef.current = null;
		}, 700);
	}, []);

	return (
		<AdminPageShell>
			<AdminViewHeader
				title="Rovo settings"
				description="Manage settings for Rovo features and search preferences in your organization."
			/>

			<AdminRovoPrototypeNotice>
				Settings in this prototype are simulated. The Administration chat toggle is stored
				locally in this browser and does not update organization configuration.
			</AdminRovoPrototypeNotice>

			<Tabs defaultValue="rovo-chat" className="w-full">
				<TabsList variant="line">
					<TabsTrigger value="beta">Beta features</TabsTrigger>
					<TabsTrigger value="rovo-chat">Rovo Chat</TabsTrigger>
					<TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
				</TabsList>

				<TabsContent value="beta" className="pt-6">
					<div className="flex flex-col gap-4">
						<AdminCard>
							<AdminToggleRow
								label="Enable beta features"
								description="Allow your organization to access preview features before general availability."
								defaultChecked
							/>
						</AdminCard>
						<AdminCard>
							<AdminToggleRow
								label="AI and Rovo"
								description="Enable AI-powered features across your Atlassian products."
								checked={isAiEnabled}
								onCheckedChange={(checked) => {
									if (checked) {
										setIsEnableModalOpen(true);
									} else {
										setIsDisableModalOpen(true);
									}
								}}
							/>
						</AdminCard>
					</div>
				</TabsContent>

				<TabsContent value="rovo-chat" className="pt-6">
					<div className="flex flex-col gap-4">
						<p className="text-sm text-text-subtlest">
							Manage where you can use Rovo Chat and its knowledge sources.
						</p>
						<AdminCard>
							<AdminToggleRow
								label="Rovo Chat in Administration"
								description="Enable to use Rovo Chat in Atlassian Administration."
								checked={rovoChatEnabled}
								onCheckedChange={setRovoChatEnabled}
							/>
							<div className="border-t border-border" />
							<AdminToggleRow
								label="Web search"
								description="Enable to allow responses in Rovo Chat to use knowledge from the web."
							/>
						</AdminCard>
					</div>
				</TabsContent>

				<TabsContent value="bookmarks" className="pt-6">
					<AdminCard>
						<CardContent>
							<AdminToggleRow
								label="Bookmarks"
								description="Allow users to bookmark and save content across Atlassian products for quick access."
							/>
						</CardContent>
					</AdminCard>
				</TabsContent>
			</Tabs>

			<AiRovoDialog
				open={isEnableModalOpen}
				title="Enable AI and Rovo"
				description="Enabling AI and Rovo will activate AI-powered features across all Atlassian products in your organization, including Rovo chat, AI-assisted search, and intelligent suggestions."
				actionLabel="Enable"
				isLoading={isLoading}
				onOpenChange={setIsEnableModalOpen}
				onConfirm={() => finishAiToggle(true)}
			/>
			<AiRovoDialog
				open={isDisableModalOpen}
				title="Disable AI and Rovo"
				description="Disabling AI and Rovo will turn off AI-powered features across your organization. Users will no longer have access to Rovo chat, AI search, or intelligent suggestions. This action can be reversed."
				actionLabel="Disable"
				isLoading={isLoading}
				variant="warning"
				onOpenChange={setIsDisableModalOpen}
				onConfirm={() => finishAiToggle(false)}
			/>
		</AdminPageShell>
	);
}

function AiRovoDialog({
	open,
	title,
	description,
	actionLabel,
	isLoading,
	variant = "default",
	onOpenChange,
	onConfirm,
}: Readonly<{
	open: boolean;
	title: string;
	description: string;
	actionLabel: string;
	isLoading: boolean;
	variant?: "default" | "warning";
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
}>) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle variant={variant === "warning" ? "warning" : "default"}>
						{title}
					</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant={variant === "warning" ? "warning" : "default"} isLoading={isLoading} onClick={onConfirm}>
						{actionLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
