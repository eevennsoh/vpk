"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog"
import { RovoColorIcon } from "@/components/ui/logo"
import { Lozenge } from "@/components/ui/lozenge"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { token } from "@/lib/tokens"

import { MEMORY_TOASTER_ID } from "../data/memory-data"
import { MemoriesTab } from "./memories-tab"
import { ObservationsTab } from "./observations-tab"

export interface MemoryProps {
	defaultOpen?: boolean
	open?: boolean
	onOpenChange?: (open: boolean) => void
	showTrigger?: boolean
}

/**
 * Rovo memory modal (prototype). Two tabs — Rovo's auto-generated observations,
 * and the memories the user has shared directly — over local-only state.
 */
export function Memory({
	defaultOpen = false,
	open,
	onOpenChange,
	showTrigger = true,
}: Readonly<MemoryProps>) {
	const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
	const isControlled = open !== undefined
	const resolvedOpen = isControlled ? open : internalOpen
	const handleOpenChange = React.useCallback((nextOpen: boolean) => {
		if (!isControlled) {
			setInternalOpen(nextOpen)
		}
		onOpenChange?.(nextOpen)
	}, [isControlled, onOpenChange])

	return (
		<Dialog onOpenChange={handleOpenChange} open={resolvedOpen}>
			{showTrigger ? (
				<DialogTrigger render={<Button size="default" />}>
					Open Rovo memory
				</DialogTrigger>
			) : null}
			<DialogContent className="max-h-[85vh] gap-4 overflow-y-auto" size="lg">
				<Toaster id={MEMORY_TOASTER_ID} position="bottom-left" />
				<DialogTitle className="sr-only">Rovo memory</DialogTitle>
				<DialogDescription className="sr-only">
					This summary is updated weekly based on your Teamwork Graph activity.
				</DialogDescription>

				<div className="flex items-center gap-3 rounded-lg bg-surface-sunken px-3 py-2">
					<Lozenge variant="discovery">Internal only</Lozenge>
					<p className="flex-1 text-sm text-text-subtle">
						Help us improve Rovo&apos;s memory management experience.
					</p>
					<Button size="compact" variant="ghost">
						Share feedback
					</Button>
				</div>

				<div className="flex items-start gap-3">
					<RovoColorIcon size="medium" />
					<div className="flex flex-col gap-0.5">
						<h2 className="text-text" style={{ font: token("font.heading.medium") }}>
							Rovo memory
						</h2>
						<p className="text-sm text-text-subtle">
							This summary is updated weekly based on your Teamwork Graph activity.
						</p>
					</div>
				</div>

				<Tabs defaultValue="observations">
					<TabsList className="w-full justify-start" variant="line">
						<TabsTrigger className="flex-none" value="observations">
							Rovo&apos;s observations about you
						</TabsTrigger>
						<TabsTrigger className="flex-none" value="memories">
							Information you&apos;ve shared directly
						</TabsTrigger>
					</TabsList>
					<TabsContent value="observations">
						<ObservationsTab />
					</TabsContent>
					<TabsContent value="memories">
						<MemoriesTab />
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	)
}
