"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import CrossIcon from "@atlaskit/icon/core/cross";
import MenuIcon from "@atlaskit/icon/core/menu";
import SearchIcon from "@atlaskit/icon/core/search";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export interface NavItem {
	name: string;
	href: string;
	children?: NavItem[];
	/** If true, the parent item is not clickable - only the chevron expands children */
	expandOnly?: boolean;
}

export interface NavSection {
	title: string;
	href?: string;
	items: NavItem[];
	defaultOpen?: boolean;
}

export interface WebsiteSidebarNavProps {
	/** Static pages shown at the top */
	staticPages?: NavItem[];
	/** Collapsible sections */
	sections?: NavSection[];
	/** Logo text */
	logoText?: string;
}

const RAIL_WIDTH = 48;
const PANEL_WIDTH = 256;
const VENN_SLACK_PROFILE_URL = "https://atlassian.enterprise.slack.com/user/@WEM1T2SLE";
const NAV_SECTION_TEXT_CLASSNAME = "text-[11px] font-medium tracking-wider text-text-subtle";
const NAV_SECTION_LINK_CLASSNAME =
	`flex flex-1 items-center rounded-md py-2 px-3 ${NAV_SECTION_TEXT_CLASSNAME} uppercase no-underline transition-colors data-[active=true]:bg-bg-neutral data-[active=true]:font-semibold data-[active=true]:text-text hover:text-text`;
const NAV_SECTION_LABEL_CLASSNAME =
	`flex flex-1 items-center rounded-md py-2 px-3 ${NAV_SECTION_TEXT_CLASSNAME} uppercase`;
const NAV_GROUP_LINK_CLASSNAME =
	"flex flex-1 items-center rounded-md py-2 px-3 text-sm text-text-subtle no-underline transition-colors data-[active=true]:bg-bg-neutral data-[active=true]:font-semibold data-[active=true]:text-text hover:text-text";
const NAV_GROUP_LABEL_CLASSNAME =
	"flex flex-1 items-center rounded-md py-2 px-3 text-sm text-text-subtle";

export function WebsiteSidebarNav({
	staticPages = [],
	sections = [],
	logoText = "Design System",
}: Readonly<WebsiteSidebarNavProps>) {
	const pathname = usePathname();
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		for (const section of sections) {
			const containsActive = section.items.some(
				(item) => item.href === pathname || item.children?.some((child) => child.href === pathname),
			);
			initial[section.title] = containsActive || (section.defaultOpen ?? false);
		}
		return initial;
	});
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		for (const page of staticPages) {
			if (page.children?.length) {
				initial[page.href] = page.children.some((child) => child.href === pathname);
			}
		}
		for (const section of sections) {
			for (const item of section.items) {
				if (item.children?.length) {
					initial[item.href] = item.children.some((child) => child.href === pathname);
				}
			}
		}
		return initial;
	});

	const isSearching = searchQuery.length > 0;

	const toggleGroup = useCallback((href: string) => {
		setOpenGroups((prev) => ({
			...prev,
			[href]: !prev[href],
		}));
	}, []);

	const filteredSections = useMemo(() => {
		let result = sections;

		// Apply search filter
		if (searchQuery.length > 0) {
			const query = searchQuery.toLowerCase();
			result = result
				.map((section) => ({
					...section,
					items: section.items
						.map((item) => {
							const parentMatches = item.name.toLowerCase().includes(query);
							if (!item.children?.length) {
								return parentMatches ? item : null;
							}
							if (parentMatches) return item;
							const matchingChildren = item.children.filter((child) =>
								child.name.toLowerCase().includes(query),
							);
							if (matchingChildren.length > 0) {
								return { ...item, children: matchingChildren };
							}
							return null;
						})
						.filter((item): item is NavItem => item != null),
				}))
				.filter((section) => section.items.length > 0);
		}

		return result;
	}, [sections, searchQuery]);

	const toggleSection = useCallback((title: string) => {
		setOpenSections((prev) => ({
			...prev,
			[title]: !prev[title],
		}));
	}, []);

	// Auto-open sections/groups when navigating to a new component via URL
	// Uses React's "store previous value in state" pattern to detect prop changes
	const [lastAutoOpenedPath, setLastAutoOpenedPath] = useState(pathname);
	if (lastAutoOpenedPath !== pathname) {
		setLastAutoOpenedPath(pathname);
		const groupUpdates: Record<string, boolean> = {};
		for (const page of staticPages) {
			if (page.children?.some((child) => child.href === pathname)) {
				groupUpdates[page.href] = true;
			}
		}
		const sectionUpdates: Record<string, boolean> = {};
		for (const section of sections) {
			for (const item of section.items) {
				if (item.href === pathname) {
					sectionUpdates[section.title] = true;
				}
				if (item.children?.some((child) => child.href === pathname)) {
					sectionUpdates[section.title] = true;
					groupUpdates[item.href] = true;
				}
			}
		}
		if (Object.keys(groupUpdates).length > 0) {
			setOpenGroups((prev) => ({ ...prev, ...groupUpdates }));
		}
		if (Object.keys(sectionUpdates).length > 0) {
			setOpenSections((prev) => ({ ...prev, ...sectionUpdates }));
		}
	}

	const isSectionOpen = (title: string) => !!openSections[title];

	const isGroupOpen = (href: string) => !!openGroups[href];

	// Preserve sidebar scroll position across navigation
	const navRef = useRef<HTMLElement>(null);
	const savedScrollTop = useRef(0);
	const isInitialMount = useRef(true);

	useEffect(() => {
		savedScrollTop.current = navRef.current?.scrollTop ?? 0;
	});

	useEffect(() => {
		if (isInitialMount.current) {
			// On initial mount, scroll the active item into view
			isInitialMount.current = false;
			requestAnimationFrame(() => {
				const nav = navRef.current;
				const activeLink = nav?.querySelector<HTMLElement>("[data-active='true']");
				if (nav && activeLink) {
					const navRect = nav.getBoundingClientRect();
					const linkRect = activeLink.getBoundingClientRect();
					nav.scrollTop += linkRect.top - navRect.top - navRect.height / 2 + linkRect.height / 2;
				}
			});
		} else {
			// On subsequent navigations, preserve scroll position
			requestAnimationFrame(() => {
				if (navRef.current) {
					navRef.current.scrollTop = savedScrollTop.current;
				}
			});
		}
	}, [pathname]);

	const isActive = (href: string) => pathname === href;

	const isSectionLinkActive = (href: string) => isActive(href);

	return (
		<>
			{/* Rail - Always visible (48px) */}
			<aside
				aria-label="Sidebar actions"
				data-sidebar-open={sidebarOpen}
				className="fixed inset-y-0 left-0 z-50 flex flex-col items-center border-r border-border bg-surface py-4"
				style={{ width: RAIL_WIDTH }}
			>
				{/* Logo */}
				<Link
					href="/projects"
					aria-label="Go to projects"
					className="mb-4 text-text rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
				>
					<Image src="/website/vpk-logo-dark.svg" alt="" width={24} height={24} priority className="dark:hidden" />
					<Image src="/website/vpk-logo-light.svg" alt="" width={24} height={24} priority className="hidden dark:block" />
				</Link>

				{/* Toggle button */}
				<button
					type="button"
					onClick={() => setSidebarOpen(!sidebarOpen)}
					aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
					className="flex items-center justify-center p-2 rounded-md text-text-subtle bg-transparent border-none transition-colors hover:bg-bg-neutral hover:text-text"
				>
					<MenuIcon label="Toggle sidebar" size="medium" />
				</button>
			</aside>

			{/* Panel - Slides in/out (256px) */}
			<aside
				aria-label="Component browser"
				className="fixed inset-y-0 z-40 flex flex-col border-r border-border bg-surface transition-transform will-change-transform"
				style={{
					left: RAIL_WIDTH,
					width: PANEL_WIDTH,
					transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
					transitionDuration: "var(--duration-slow)",
					transitionTimingFunction: "var(--ease-in-out)",
				}}
			>
				{/* Header */}
				<header
					className="flex h-14 items-center border-b border-border px-4"
				>
					<Link
						href="/projects"
						className="text-lg font-semibold text-text no-underline hover:text-text"
					>
						{logoText}
					</Link>
				</header>

				{/* Search */}
				<div className="px-4 pt-4 pb-3">
					<InputGroup>
						<InputGroupAddon>
							<SearchIcon label="Search" />
						</InputGroupAddon>
						<InputGroupInput
							id="sidebar-search"
							type="search"
							aria-label="Search components"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search..."
							className="[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
						/>
						{isSearching ? (
							<InputGroupAddon align="inline-end">
								<InputGroupButton
									onClick={() => setSearchQuery("")}
									aria-label="Clear search"
									size="icon-xs"
									shape="circle"
								>
									<Icon
										render={<CrossIcon label="" size="small" />}
										label="Clear search"
										className="text-icon-subtlest [&_svg]:size-3"
									/>
								</InputGroupButton>
							</InputGroupAddon>
						) : null}
					</InputGroup>
				</div>

				{/* Navigation */}
				<nav
					aria-label="Component navigation"
					ref={navRef}
					className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4"
				>

					{/* Static pages */}
					{!isSearching && staticPages.length > 0 ? <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
							{staticPages.map((page) => (
								page.children?.length ? (
									<NavGroupItem
										key={page.href}
										item={page}
										isActive={isActive}
										isSearching={false}
										isGroupOpen={isGroupOpen(page.href)}
										onToggleGroup={() => toggleGroup(page.href)}
									/>
								) : (
									<NavFlatItem
										key={page.href}
										item={page}
										isActive={isActive(page.href)}
									/>
								)
							))}
						</ul> : null}

					{/* Collapsible sections */}
					{filteredSections.map((section) => {
						const hasItems = section.items.length > 0;
						const sectionOpen = isSearching || isSectionOpen(section.title);
						return (
							<div key={section.title}>
								<div className="flex items-center gap-1">
									{section.href ? (
										<Link
											href={section.href}
											data-active={isSectionLinkActive(section.href)}
											className={NAV_SECTION_LINK_CLASSNAME}
										>
											{section.title}
										</Link>
									) : (
										<div className={NAV_SECTION_LABEL_CLASSNAME}>
											{section.title}
										</div>
									)}
									{!isSearching && hasItems ? <button
											type="button"
											onClick={() => toggleSection(section.title)}
											aria-label={sectionOpen ? `Collapse ${section.title}` : `Expand ${section.title}`}
											className="flex items-center justify-center rounded-md text-text-subtle bg-transparent border-none transition-colors hover:bg-bg-neutral hover:text-text"
											style={{ width: 36, height: 36 }}
										>
											<span
												className="inline-flex transition-transform duration-medium ease-in-out"
												style={{ transform: sectionOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
											>
												<ChevronDownIcon label="" size="small" />
											</span>
										</button> : null}
								</div>

								{sectionOpen && hasItems ? <ul className="m-0 flex list-none flex-col gap-1 p-0">
										{section.items.map((item) =>
											item.children?.length ? (
												<NavGroupItem
													key={item.href}
													item={item}
													isActive={isActive}
													isSearching={isSearching}
													isGroupOpen={isSearching || isGroupOpen(item.href)}
													onToggleGroup={() => toggleGroup(item.href)}
												/>
											) : (
												<NavFlatItem
													key={item.href}
													item={item}
													isActive={isActive(item.href)}
												/>
											),
										)}
									</ul> : null}
							</div>
						);
					})}

					{/* No results */}
					{isSearching && filteredSections.length === 0 ? <p className="px-3 py-6 text-sm text-text-subtlest text-center">
							No components found
						</p> : null}
				</nav>

				{/* Footer */}
				<footer
					className="border-t border-border p-4"
				>
					<span className="text-xs text-text-subtlest">
						Maintained by{" "}
						<a
							href={VENN_SLACK_PROFILE_URL}
							target="_blank"
							rel="noreferrer"
							className="rounded-sm text-text-subtle no-underline transition-colors hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
						>
							@Venn ✌️
						</a>
					</span>
				</footer>
			</aside>
		</>
	);
}

function NavFlatItem({
	item,
	isActive,
}: Readonly<{
	item: NavItem;
	isActive: boolean;
}>) {
	return (
		<li>
			<Link
				href={item.href}
				data-active={isActive}
				className="flex items-center gap-1.5 rounded-md py-2 px-3 text-sm no-underline transition-colors text-text-subtle data-[active=true]:bg-bg-neutral data-[active=true]:font-semibold data-[active=true]:text-text"
			>
				<span className="truncate">{item.name}</span>
			</Link>
		</li>
	);
}

function NavGroupItem({
	item,
	isActive,
	isSearching,
	isGroupOpen,
	onToggleGroup,
}: Readonly<{
	item: NavItem;
	isActive: (href: string) => boolean;
	isSearching: boolean;
	isGroupOpen: boolean;
	onToggleGroup: () => void;
}>) {
	return (
		<li>
			<Collapsible open={isGroupOpen} onOpenChange={onToggleGroup}>
				<div className="flex items-center gap-1">
					{item.expandOnly ? (
						<div className={cn(NAV_GROUP_LABEL_CLASSNAME, "gap-1.5")}>
							<span className="truncate">{item.name}</span>
						</div>
					) : (
						<Link
							href={item.href}
							data-active={isActive(item.href)}
							className={cn(NAV_GROUP_LINK_CLASSNAME, "gap-1.5")}
						>
							<span className="truncate">{item.name}</span>
						</Link>
					)}
					{!isSearching ? <CollapsibleTrigger
							render={
								<button
									type="button"
									aria-label={isGroupOpen ? `Collapse ${item.name}` : `Expand ${item.name}`}
									className="flex items-center justify-center rounded-md text-text-subtle bg-transparent border-none transition-colors hover:bg-bg-neutral hover:text-text"
									style={{ width: 36, height: 36 }}
								/>
							}
						>
							<span
								className="inline-flex transition-transform duration-medium ease-in-out"
								style={{ transform: isGroupOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
							>
								<ChevronDownIcon label="" size="small" />
							</span>
						</CollapsibleTrigger> : null}
				</div>
				<CollapsibleContent>
					<ul className="ml-3.5 translate-x-px list-none m-0 border-l border-border px-2.5 py-0.5 flex flex-col gap-0.5">
						{item.children?.map((child) => (
							<NavFlatItem
								key={child.href}
								item={child}
								isActive={isActive(child.href)}
							/>
						))}
					</ul>
				</CollapsibleContent>
			</Collapsible>
		</li>
	);
}
