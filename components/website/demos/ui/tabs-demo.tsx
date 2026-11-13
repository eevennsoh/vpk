"use client";

import { AppWindowIcon, CodeIcon, HomeIcon, MoreHorizontalIcon, SearchIcon, SettingsIcon } from "@/components/ui/vpk-icons";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TabsDemo() {
	return (
		<Tabs defaultValue="tab1">
			<TabsList>
				<TabsTrigger value="tab1">Account</TabsTrigger>
				<TabsTrigger value="tab2">Settings</TabsTrigger>
				<TabsTrigger value="tab3">Billing</TabsTrigger>
			</TabsList>
			<TabsContent value="tab1">
				<p className="text-xs text-muted-foreground pt-2">Manage your account</p>
			</TabsContent>
			<TabsContent value="tab2">
				<p className="text-xs text-muted-foreground pt-2">Configure settings</p>
			</TabsContent>
			<TabsContent value="tab3">
				<p className="text-xs text-muted-foreground pt-2">View billing info</p>
			</TabsContent>
		</Tabs>
	);
}

export function TabsDemoBasic() {
	return (
		<Tabs defaultValue="home">
			<TabsList>
				<TabsTrigger value="home">Home</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoDefault() {
	return (
		<Tabs defaultValue="account">
			<TabsList>
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="password">Password</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
			<TabsContent value="account">
				Manage your account settings and preferences.
			</TabsContent>
			<TabsContent value="password">
				Change your password and security settings.
			</TabsContent>
			<TabsContent value="settings">
				Configure your application settings.
			</TabsContent>
		</Tabs>
	);
}

export function TabsDemoCompact() {
	return (
		<Tabs defaultValue="account">
			<TabsList size="compact">
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="password">Password</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoDisabled() {
	return (
		<Tabs defaultValue="home">
			<TabsList>
				<TabsTrigger value="home">Home</TabsTrigger>
				<TabsTrigger value="settings" disabled>
					Disabled
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoIconOnly() {
	return (
		<Tabs defaultValue="home">
			<TabsList>
				<TabsTrigger value="home">
					<HomeIcon
					/>
				</TabsTrigger>
				<TabsTrigger value="search">
					<SearchIcon
					/>
				</TabsTrigger>
				<TabsTrigger value="settings">
					<SettingsIcon
					/>
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoLineDisabled() {
	return (
		<Tabs defaultValue="overview">
			<TabsList variant="line">
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="analytics">Analytics</TabsTrigger>
				<TabsTrigger value="reports" disabled>
					Reports
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoLineWithContent() {
	return (
		<Tabs defaultValue="account">
			<TabsList variant="line">
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="password">Password</TabsTrigger>
				<TabsTrigger value="notifications">Notifications</TabsTrigger>
			</TabsList>
			<div className="style-nova:p-4 style-vega:p-6 style-maia:p-6 style-mira:p-4 style-lyra:p-4 style-nova:rounded-lg style-vega:rounded-lg style-maia:rounded-xl style-mira:rounded-md style-lyra:rounded-none border">
				<TabsContent value="account">
					Manage your account preferences and profile information.
				</TabsContent>
				<TabsContent value="password">
					Update your password to keep your account secure.
				</TabsContent>
				<TabsContent value="notifications">
					Configure how you receive notifications and alerts.
				</TabsContent>
			</div>
		</Tabs>
	);
}

export function TabsDemoLine() {
	return (
		<Tabs defaultValue="overview">
			<TabsList animateIndicator variant="line">
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="analytics">Analytics</TabsTrigger>
				<TabsTrigger value="reports">Reports</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoLineFullWidth() {
	return (
		<Tabs className="w-full" defaultValue="overview">
			<TabsList fullWidth variant="line">
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="analytics">Analytics</TabsTrigger>
				<TabsTrigger value="reports">Reports</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoMultiple() {
	return (
		<Tabs defaultValue="overview">
			<TabsList>
				<TabsTrigger value="overview">Overview</TabsTrigger>
				<TabsTrigger value="analytics">Analytics</TabsTrigger>
				<TabsTrigger value="reports">Reports</TabsTrigger>
				<TabsTrigger value="settings">Settings</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoVariantsAlignment() {
	return (
		<div className="flex gap-4">
			<Tabs defaultValue="overview">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
				</TabsList>
			</Tabs>
			<Tabs defaultValue="overview">
				<TabsList variant="line">
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}

export function TabsDemoVertical() {
	return (
		<Tabs defaultValue="account" orientation="vertical">
			<TabsList>
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="password">Password</TabsTrigger>
				<TabsTrigger value="notifications">Notifications</TabsTrigger>
			</TabsList>
			<div className="style-nova:p-4 style-vega:p-6 style-maia:p-6 style-mira:p-4 style-lyra:p-4 style-nova:rounded-lg style-vega:rounded-lg style-maia:rounded-xl style-mira:rounded-md style-lyra:rounded-none border">
				<TabsContent value="account">
					Manage your account preferences and profile information.
				</TabsContent>
				<TabsContent value="password">
					Update your password to keep your account secure. Use a strong
					password with a mix of letters, numbers, and symbols.
				</TabsContent>
				<TabsContent value="notifications">
					Configure how you receive notifications and alerts. Choose which
					types of notifications you want to receive and how you want to
					receive them.
				</TabsContent>
			</div>
		</Tabs>
	);
}

export function TabsDemoWithContent() {
	return (
		<Tabs defaultValue="account">
			<TabsList>
				<TabsTrigger value="account">Account</TabsTrigger>
				<TabsTrigger value="password">Password</TabsTrigger>
				<TabsTrigger value="notifications">Notifications</TabsTrigger>
			</TabsList>
			<div className="style-nova:p-4 style-vega:p-6 style-maia:p-6 style-mira:p-4 style-lyra:p-4 style-nova:rounded-lg style-vega:rounded-lg style-maia:rounded-xl style-mira:rounded-md style-lyra:rounded-none border">
				<TabsContent value="account">
					Manage your account preferences and profile information.
				</TabsContent>
				<TabsContent value="password">
					Update your password to keep your account secure.
				</TabsContent>
				<TabsContent value="notifications">
					Configure how you receive notifications and alerts.
				</TabsContent>
			</div>
		</Tabs>
	);
}

export function TabsDemoWithDropdown() {
	return (
		<Tabs defaultValue="overview">
			<div className="flex items-center justify-between">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
					<TabsTrigger value="reports">Reports</TabsTrigger>
				</TabsList>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={<Button variant="ghost" size="icon" className="size-8" />}
					>
						<MoreHorizontalIcon
						/>
						<span className="sr-only">More options</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem>Settings</DropdownMenuItem>
						<DropdownMenuItem>Export</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem>Archive</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<div className="style-nova:p-4 style-vega:p-6 style-maia:p-6 style-mira:p-4 style-lyra:p-4 style-nova:rounded-lg style-vega:rounded-lg style-maia:rounded-xl style-mira:rounded-md style-lyra:rounded-none border">
				<TabsContent value="overview">
					View your dashboard metrics and key performance indicators.
				</TabsContent>
				<TabsContent value="analytics">
					Detailed analytics and insights about your data.
				</TabsContent>
				<TabsContent value="reports">
					Generate and view custom reports.
				</TabsContent>
			</div>
		</Tabs>
	);
}

export function TabsDemoWithIcons() {
	return (
		<Tabs defaultValue="preview">
			<TabsList>
				<TabsTrigger value="preview">
					<AppWindowIcon
					/>
					Preview
				</TabsTrigger>
				<TabsTrigger value="code">
					<CodeIcon
					/>
					Code
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export function TabsDemoWithInputAndButton() {
	return (
		<Tabs defaultValue="overview" className="mx-auto w-full max-w-lg">
			<div className="flex items-center gap-4">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="analytics">Analytics</TabsTrigger>
				</TabsList>
				<div className="ml-auto flex items-center gap-2">
					<Input placeholder="Search..." className="w-44" />
					<Button>Action</Button>
				</div>
			</div>
			<div className="style-nova:p-4 style-vega:p-6 style-maia:p-6 style-mira:p-4 style-lyra:p-4 style-nova:rounded-lg style-vega:rounded-lg style-maia:rounded-xl style-mira:rounded-md style-lyra:rounded-none border">
				<TabsContent value="overview">
					View your dashboard metrics and key performance indicators.
				</TabsContent>
				<TabsContent value="analytics">
					Detailed analytics and insights about your data.
				</TabsContent>
				<TabsContent value="reports">
					Generate and view custom reports.
				</TabsContent>
			</div>
		</Tabs>
	);
}
