"use client"

import { CommandIcon } from "@/components/ui/vpk-icons"
import { NavDocuments } from "./components/nav-documents"
import { NavMain } from "./components/nav-main"
import { NavSecondary } from "./components/nav-secondary"
import { NavUser } from "./components/nav-user"
import {
	USER_DATA,
	NAV_MAIN_ITEMS,
	NAV_SECONDARY_ITEMS,
	DOCUMENT_ITEMS,
} from "./data/sidebar-data"
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export function AppSidebar({
	...props
}: Readonly<React.ComponentProps<typeof Sidebar>>) {
	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							className="data-[slot=sidebar-menu-button]:p-1.5!"
							render={<a aria-label="Acme Inc." href="#" />}
						>
							<CommandIcon className="size-5!" />
							<span className="text-base font-semibold">Acme Inc.</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={NAV_MAIN_ITEMS} />
				<NavDocuments items={DOCUMENT_ITEMS} />
				<NavSecondary items={NAV_SECONDARY_ITEMS} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={USER_DATA} />
			</SidebarFooter>
		</Sidebar>
	)
}

export default function Page() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<header className="flex sticky top-0 bg-background h-16 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4 data-vertical:self-center" />
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem className="hidden md:block">
								<BreadcrumbLink href="#">Application</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator className="hidden md:block" />
							<BreadcrumbItem>
								<BreadcrumbPage>Dashboard</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</header>
				<div className="flex flex-1 flex-col gap-4 p-4">
					{Array.from({ length: 24 }).map((_, index) => (
						<div
							key={index}
							className="aspect-video h-12 w-full rounded-lg bg-muted/50"
						/>
					))}
				</div>
			</SidebarInset>
		</SidebarProvider>
	)
}
