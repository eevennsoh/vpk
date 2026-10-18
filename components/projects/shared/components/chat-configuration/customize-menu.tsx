"use client";

// oxlint-disable react-doctor/jsx-no-jsx-as-prop -- These components intentionally use slot/render-node props for icons, triggers, and adornments.

// oxlint-disable react-doctor/prefer-tag-over-role -- This file uses ARIA roles for custom generated visuals or composite widgets where the suggested native tag would change semantics or behavior.

import { token } from "@/lib/tokens";
import { SwitchIndicator } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { MenuItemButton, CircleIcon } from "./menu-item-button";
import { REASONING_OPTIONS, FILTER_BY_APPS_ICON, SELECTED_CHECK_ICON } from "./customize-menu-data";
import GlobeIcon from "@atlaskit/icon/core/globe";
import OfficeBuildingIcon from "@atlaskit/icon/core/office-building";

const SOURCE_MENU_ROW_CLASS_NAME = "h-8 min-h-8 gap-3 pl-2 pr-3 py-0 font-normal leading-5";
const SOURCE_MENU_ICON_CLASS_NAME = "grid size-6 shrink-0 place-items-center";

export interface CustomizeMenuProps {
	selectedReasoning: string;
	onReasoningChange: (reasoning: string) => void;
	showReasoning?: boolean;
	showSources?: boolean;
	webResultsEnabled: boolean;
	onWebResultsChange: (enabled: boolean) => void;
	companyKnowledgeEnabled: boolean;
	onCompanyKnowledgeChange: (enabled: boolean) => void;
	onClose: () => void;
}

export default function CustomizeMenu({
	selectedReasoning,
	onReasoningChange,
	showReasoning = true,
	showSources = true,
	webResultsEnabled,
	onWebResultsChange,
	companyKnowledgeEnabled,
	onCompanyKnowledgeChange,
	onClose,
}: Readonly<CustomizeMenuProps>) {
	return (
		<>
			{showReasoning ? (
				<ReasoningSection selectedReasoning={selectedReasoning} onReasoningChange={onReasoningChange} onClose={onClose} />
			) : null}
			{showSources ? (
				<SourcesSection
					webResultsEnabled={webResultsEnabled}
					onWebResultsChange={onWebResultsChange}
					companyKnowledgeEnabled={companyKnowledgeEnabled}
					onCompanyKnowledgeChange={onCompanyKnowledgeChange}
					onClose={onClose}
				/>
			) : null}
		</>
	);
}

interface ReasoningSectionProps {
	selectedReasoning: string;
	onReasoningChange: (reasoning: string) => void;
	onClose: () => void;
}

function ReasoningSection({ selectedReasoning, onReasoningChange, onClose }: Readonly<ReasoningSectionProps>) {
	return (
		<div>
			<div style={{ padding: `${token("space.050")} ${token("space.200")} 0` }}>
				<h3 style={{ font: token("font.heading.xxsmall") }} className="text-text-subtle">
					Reasoning
				</h3>
			</div>
			<div
				style={{
					borderRadius: "12px",
					marginTop: token("space.100"),
				}}
			>
				{REASONING_OPTIONS.map((option) => (
					<MenuItemButton
						key={option.id}
						elemBefore={<CircleIcon>{option.icon}</CircleIcon>}
						elemAfter={selectedReasoning === option.id ? SELECTED_CHECK_ICON : null}
						description={option.description}
						onClick={() => {
							onReasoningChange(option.id);
							onClose();
						}}
					>
						{option.label}
					</MenuItemButton>
				))}
			</div>
		</div>
	);
}

interface SourcesSectionProps {
	webResultsEnabled: boolean;
	onWebResultsChange: (enabled: boolean) => void;
	companyKnowledgeEnabled: boolean;
	onCompanyKnowledgeChange: (enabled: boolean) => void;
	onClose: () => void;
}

function SourcesSection({ webResultsEnabled, onWebResultsChange, companyKnowledgeEnabled, onCompanyKnowledgeChange, onClose }: Readonly<SourcesSectionProps>) {
	return (
		<div className="min-w-64">
			<h3 className="px-2 pt-1 pb-2 text-xs font-semibold text-text-subtle">Sources</h3>
			<SourceToggleRow icon={<GlobeIcon label="" />} label="Include web results" checked={webResultsEnabled} onCheckedChange={() => onWebResultsChange(!webResultsEnabled)} />
			<SourceToggleRow
				icon={<OfficeBuildingIcon label="" />}
				label="Search company knowledge"
				checked={companyKnowledgeEnabled}
				onCheckedChange={() => onCompanyKnowledgeChange(!companyKnowledgeEnabled)}
			/>
			<Separator className="my-1" />
			<MenuItemButton className={SOURCE_MENU_ROW_CLASS_NAME} elemBefore={<span className={SOURCE_MENU_ICON_CLASS_NAME}>{FILTER_BY_APPS_ICON}</span>} onClick={onClose}>
				Filter by apps
			</MenuItemButton>
		</div>
	);
}

interface SourceToggleRowProps {
	icon: React.ReactNode;
	label: string;
	checked: boolean;
	onCheckedChange: () => void;
}

function SourceToggleRow({ icon, label, checked, onCheckedChange }: Readonly<SourceToggleRowProps>) {
	return (
		<MenuItemButton
			role="switch"
			aria-checked={checked}
			aria-label={label}
			className={SOURCE_MENU_ROW_CLASS_NAME}
			elemBefore={<span className={SOURCE_MENU_ICON_CLASS_NAME}>{icon}</span>}
			elemAfter={<SwitchIndicator checked={checked} />}
			onClick={onCheckedChange}
		>
			{label}
		</MenuItemButton>
	);
}
