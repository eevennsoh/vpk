// The Rovo stage file (rovo-stage.json) and the kit's data, as types. Rovo Stage Kit 1.3.0.

/** A piece the kit draws (pieces.json lists each with its name, size and moment). */
export type PieceId = 
    | 'search'
    | 'searchDrop'
    | 'filters'
    | 'bubbles'
    | 'composer'
    | 'starters'
    | 'skills'
    | 'twg'
    | 'reasoning'
    | 'workPill'
    | 'sources'
    | 'sourcesPopover'
    | 'voice'
    | 'picker'
    | 'avatars'
    | 'badgeRovo'
    | 'hold'
    | 'compact'
    | 'switch'
    | 'bloom'
    | 'glyphSearch'
    | 'glyphChat'
    | 'glyphForYou'
    | 'glyphAuto'
    | 'appConfluence'
    | 'appJira'
    | 'appSlack'
    | 'appFigma'
    | 'appGithub'
    | 'appDrive'
    | 'appLoom'
    | 'mosaic'
    | 'filmFacets'
    | 'mobileChat'
    | 'scheduledTask'
    | 'quizArtifact'
    | 'dashboardArtifact'
    | 'artifactsLogo'
    | 'rovoDevCli'
    | 'codeCard'
    | 'codeSearchLogo'
    | 'ringsTile'
    | 'agentPresence'
    | 'mentions'
    | 'attribution'
    | 'shareSnapshot'
    | 'loomRecordBar'
    | 'loomTeleprompter'
    | 'loomCameraBubble'
    | 'loomOverlays'
    | 'recordForAgent'
    | 'governance'
    | 'iso42001'
    | 'statTokens'
    | 'stampTyping'
    | 'stampPhotos'
    | 'stampShapes'
    | 'stampShield'
    | 'stampRovoMark'
    | 'stampTangle'
    | 'stampLoops'
    | 'stampRibbon'
    | 'stampSignal'
    | 'stampGrid'
    | 'stampSparkle'
    | 'stampFields'
    | 'stampSquiggle'
    | 'stampSmile'
    | 'agentIdentities'
    | 'atlassianMcp'
    | 'redactedPrompt'
    | 'needsInput'
    | 'agentSessions'
    | 'requestResolver'
    | 'jiraList'
    | 'riskStack'
    | 'costByModel'
    | 'spendCard'
    | 'dimensions'
    | 'potentialSavings'
    | 'sessionCard'
    | 'readiness'
    | 'highReadiness'
    | 'cursorActivity'
    | 'presenceFacepile'
    | 'rovoWithYou'
    | 'workflowCard'
    | 'conversation'
    | 'agentCard'
    | 'codeSearchQuery'
    | 'twgSearchCli';

/** once: plays its moment and holds its last frame · loop: plays again after a rest · live: never
 * stops. */
export type PlayMode = 'once' | 'loop' | 'live';

export type Appearance = 'light' | 'dark';

/** The board's shape: one screen, or several side by side. */
export type Aspect = 
    | '16:9'
    | '21:9'
    | '32:9'
    | '48:9'
    | '9:16';

/** How a piece plays its moment, in seconds. */
export interface MomentSpec {
    play: PlayMode;
    /** Seconds a loop rests on its last frame before it plays again. */
    rest: number;
    /** Seconds its moment runs before it holds. */
    length: number;
}

/** How a kind of piece looks and plays wherever it stands (the lab's Library settings). */
export interface PieceStyle {
    /** false: drawn without its card (pieces whose `card` is true in pieces.json). */
    surface?: boolean;
    play?: PlayMode;
    rest?: number;
    length?: number;
}

export type PieceStyles = Partial<Record<PieceId, PieceStyle>>;

/** One piece on a hand-composed wall. */
export interface ComposedPiece {
    /** Unique in its composition. */
    key: string;
    id: PieceId;
    /** Its top left corner on the wall, in points, within one period. */
    x: number;
    y: number;
    scale: number;
    /** Its height off the wall; past 60 it passes in front of the greeting. */
    z: number;
    /** Its own moment, over its kind's style. */
    play?: PlayMode;
    rest?: number;
    length?: number;
}

/** A wall composed piece by piece in the lab's composer. */
export interface StageComposition {
    version: 1;
    name: string;
    /** The wall repeats every period, in points; the camera travels one period a loop. */
    period: number;
    /** Points a second at the calm pace (the stage's `pace` option scales it). */
    speed: number;
    /** The frame it was composed in, and the band of it the camera sees whole, in points. */
    frame: { w: number; h: number };
    band: { top: number; bottom: number };
    pieces: ComposedPiece[];
    /** Where the keynote curtain's cards land: card id → the key of the piece each stands in for. */
    keynote?: Record<string, string>;
}

/** The lab's board: the canvas and the stage's card with its options. */
export interface StageBoard {
    preset?: string;
    layout?: 'single';
    canvas?: 
    | 'mist'
    | 'paper'
    | 'ink'
    | 'wallpaper';
    aspect?: Aspect;
    /** The stage to the canvas's edges: no margin, no rounded corners. */
    bleed?: boolean;
    appearance?: Appearance;
    cells: {
        a: {
            module: 'stage';
            /** static: the stage holds its poster frame whatever the time. */
            motion?: 'animated' | 'static';
            /** A chosen still as a share of the loop; null for the stage's own poster. */
            frame?: number | null;
            tone?: string;
            label?: boolean;
            eyebrow?: string;
            caption?: string;
            /** 1 frames the stage as made; less takes in more of it. */
            zoom?: number;
            panX?: number;
            panY?: number;
            /** The stage's options (GUIDE.md lists them). Numbers are kept as text. */
            options?: Record<string, string | boolean>;
        };
    };
}

/** rovo-stage.json: what the Rovo stage lab exports and the kit draws. */
export interface StageFile {
    format: 'rovo-stage';
    version: 1;
    /** The kit version that wrote it. */
    kit: string;
    exportedAt: string;
    board: StageBoard;
    /** The hand-composed wall; null when the stage packs its own. */
    composition: StageComposition | null;
    /** How each kind of piece looks and plays; empty for their own ways. */
    pieceStyles: PieceStyles;
}

/** What stageInfo() reads off a stage file. */
export interface StageInfo {
    /** Seconds until the film comes round to where it began: one loop is a seamless cycle. */
    loop: number;
    /** The board's size in points (CSS pixels at scale 1). */
    width: number;
    height: number;
    aspect: Aspect;
    appearance: Appearance;
    /** Whether it can open on the keynote's curtain (16:9 or wider). */
    curtain: boolean;
    /** Pieces on its hand-composed wall; null when the stage packs its own. */
    pieces: number | null;
    /** The second the lab shows as its still: the frame for reduced motion or a poster. */
    poster: number;
    /** The stage holds still on its poster whatever the time. */
    still: boolean;
}

/** A piece as pieces.json lists it. */
export interface KitPiece {
    id: PieceId;
    name: string;
    /** What it does, in a line. */
    moment: string;
    group: string;
    groupLabel: string;
    /** Its own box in points, and its scale on the wall. */
    w: number;
    h: number;
    scale: number;
    /** Seconds its moment runs before it holds; null when it never stops of its own accord. */
    holds: number | null;
    /** It has no surface of its own (text, a pointer, a film). */
    bare: boolean;
    /** It is drawn on a card of its own, which `surface: false` turns off. */
    card: boolean;
}

/** A stage as the players take it: the stage file (object or its text), or the lab's config. */
export type StageSource = StageFile | Record<string, unknown> | string;

/** Control over a stage or a piece. */
export interface StageHandle {
    play(): void;
    pause(): void;
    /** Seconds into the film (the curtain's included); it keeps playing or paused as it was. */
    seek(seconds: number): void;
    /** Seconds into the film now. */
    time(): number;
    /** Draws it afresh where it is: crisp again after a long seek (GUIDE.md, "Time"). */
    redraw(): void;
    readonly playing: boolean;
}
