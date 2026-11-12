"use client";

import {
	createContext,
	use,
	useCallback,
	useMemo,
	useState,
	type ReactNode,
} from "react";

/** One-shot request to expand a PR artifact-pane section (e.g. CI checks). */
export interface PullRequestSectionExpandRequest {
	nonce: number;
	pullRequestIdentity: string;
	sectionId: string;
}

/** One-shot request to scroll the activity feed to an entry. */
export interface ActivityRevealRequest {
	nonce: number;
	/**
	 * When set, scroll this entry into view (e.g. Claude Code card header on
	 * Build). Otherwise scroll to the newest feed row.
	 */
	entryId?: string;
}

interface MetadataRailContextValue {
	/** Whether the extended Details fields are visible across rail presentations. */
	detailsShowMore: boolean;
	/** Controlled open section ids shared by the docked rail and hover preview. */
	openSectionIds: ReadonlySet<string>;
	setDetailsShowMore: (showMore: boolean) => void;
	setOpenSectionIds: (openSectionIds: ReadonlySet<string>) => void;
	/** Latest request to expand a pull-request details-rail section. */
	pullRequestSectionExpandRequest: PullRequestSectionExpandRequest | null;
	/** Ask one PR details rail to open a collapsible section. */
	requestExpandPullRequestSection: (pullRequestIdentity: string, sectionId: string) => void;
	/** Acknowledge a handled request without clearing a newer request. */
	consumePullRequestSectionExpandRequest: (nonce: number) => void;
	/** Latest request to scroll the activity feed to an entry. */
	activityRevealRequest: ActivityRevealRequest | null;
	/**
	 * Ask the activity feed to scroll. Omit `entryId` to target the newest row;
	 * pass one to anchor a specific entry (e.g. agent card). The section nav
	 * follows the resulting scroll, so no explicit tab change is needed.
	 */
	requestRevealLatestActivity: (entryId?: string) => void;
	/** Acknowledge a handled activity reveal without clearing a newer request. */
	consumeActivityRevealRequest: (nonce: number) => void;
	/**
	 * When true, `revealActivityKey` changes do not request a scroll (e.g. while
	 * a pull-request detail is open and the work-item feed is not mounted).
	 * Explicit `requestRevealLatestActivity` calls are unchanged.
	 */
	setSuppressActivityPanelReveal: (suppressed: boolean) => void;
}

const MetadataRailContext = createContext<MetadataRailContextValue | null>(null);

interface MetadataRailProviderProps {
	children: ReactNode;
	/**
	 * When this key changes to a non-null value, scroll the activity feed to the
	 * latest entry (e.g. jira-golden-journey-v2 Plan orchestration reveal), or to
	 * `revealActivityEntryId` when that prop is set.
	 */
	revealActivityKey?: string | number | null;
	/**
	 * Optional Activity entry id to scroll into view when `revealActivityKey`
	 * changes (e.g. `activity-story-session-claude-code` on Build).
	 */
	revealActivityEntryId?: string | null;
}

/**
 * Cross-surface request bus for the metadata rail and the activity feed.
 *
 * Activity moved into the left column's section nav, so this owns only the
 * disclosure state that must survive rail presentation changes plus one-shot
 * requests such as "scroll the feed here" and "expand that rail section".
 */
export function MetadataRailProvider({
	children,
	revealActivityKey = null,
	revealActivityEntryId = null,
}: Readonly<MetadataRailProviderProps>) {
	const [detailsShowMore, setDetailsShowMore] = useState(false);
	const [openSectionIds, setOpenSectionIds] = useState<ReadonlySet<string>>(
		() => new Set(["development"]),
	);
	const [pullRequestSectionExpandRequest, setPullRequestSectionExpandRequest] =
		useState<PullRequestSectionExpandRequest | null>(null);
	const [activityRevealRequest, setActivityRevealRequest] =
		useState<ActivityRevealRequest | null>(null);
	const requestExpandPullRequestSection = useCallback((pullRequestIdentity: string, sectionId: string) => {
		setPullRequestSectionExpandRequest((current) => ({
			nonce: (current?.nonce ?? 0) + 1,
			pullRequestIdentity,
			sectionId,
		}));
	}, []);
	const consumePullRequestSectionExpandRequest = useCallback((nonce: number) => {
		setPullRequestSectionExpandRequest((current) => current?.nonce === nonce ? null : current);
	}, []);
	const requestRevealLatestActivity = useCallback((entryId?: string) => {
		setActivityRevealRequest((current) => ({
			nonce: (current?.nonce ?? 0) + 1,
			...(entryId ? { entryId } : {}),
		}));
	}, []);
	const consumeActivityRevealRequest = useCallback((nonce: number) => {
		setActivityRevealRequest((current) => current?.nonce === nonce ? null : current);
	}, []);
	const [suppressActivityPanelReveal, setSuppressActivityPanelRevealState] = useState(false);
	const setSuppressActivityPanelReveal = useCallback((suppressed: boolean) => {
		setSuppressActivityPanelRevealState(suppressed);
	}, []);
	// Chapter/orchestration keys request the scroll during render so the feed does
	// not settle on the wrong row first. Track the previous key in state (not a
	// ref) so render stays pure.
	const [trackedRevealActivityKey, setTrackedRevealActivityKey] = useState<
		string | number | null | undefined
	>(revealActivityKey);
	if (!Object.is(trackedRevealActivityKey, revealActivityKey)) {
		setTrackedRevealActivityKey(revealActivityKey);
		if (revealActivityKey != null && revealActivityKey !== "" && !suppressActivityPanelReveal) {
			setActivityRevealRequest((current) => ({
				nonce: (current?.nonce ?? 0) + 1,
				...(revealActivityEntryId ? { entryId: revealActivityEntryId } : {}),
			}));
		}
	}
	const value = useMemo<MetadataRailContextValue>(
		() => ({
			activityRevealRequest,
			consumeActivityRevealRequest,
			consumePullRequestSectionExpandRequest,
			detailsShowMore,
			openSectionIds,
			pullRequestSectionExpandRequest,
			requestExpandPullRequestSection,
			requestRevealLatestActivity,
			setDetailsShowMore,
			setOpenSectionIds,
			setSuppressActivityPanelReveal,
		}),
		[
			activityRevealRequest,
			consumeActivityRevealRequest,
			consumePullRequestSectionExpandRequest,
			detailsShowMore,
			openSectionIds,
			pullRequestSectionExpandRequest,
			requestExpandPullRequestSection,
			requestRevealLatestActivity,
			setDetailsShowMore,
			setOpenSectionIds,
			setSuppressActivityPanelReveal,
		],
	);

	return <MetadataRailContext value={value}>{children}</MetadataRailContext>;
}

export function useMetadataRail(): MetadataRailContextValue {
	const context = use(MetadataRailContext);
	if (context === null) {
		throw new Error("useMetadataRail must be used within a MetadataRailProvider");
	}
	return context;
}
