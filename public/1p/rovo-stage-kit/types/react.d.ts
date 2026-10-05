// rovo-stage-kit/react: the Rovo Stage Kit for a React 18 host. Rovo Stage Kit 1.0.0.
import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from 'react';

import type {
    Appearance,
    KitPiece,
    MomentSpec,
    PieceId,
    PieceStyles,
    StageHandle,
    StageInfo,
    StageSource,
} from './stage-file';

export * from './stage-file';

export interface RovoStageProps {
    /** The stage file (rovo-stage.json), as an object or its text. */
    stage: StageSource;
    /** Seconds into the film, for a host that keeps its own time: the stage holds that frame.
     * Left out, the stage plays on its own clock. */
    time?: number;
    /** Whether its own clock runs (when `time` is left out). Default true. */
    playing?: boolean;
    /** Opens on the keynote's curtain, down this many seconds, then raised into the stage. */
    curtain?: number;
    /** Light or dark, over what the stage file says. */
    appearance?: Appearance;
    /** contain (default): fitted to this element, which keeps the board's ratio when its height is
     * left to it; none: the board at its own size in points. */
    fit?: 'contain' | 'none';
    className?: string;
    style?: CSSProperties;
    /** Told when the stage is read, and again when it changes. */
    onStage?: (info: StageInfo) => void;
}

export interface RovoPieceProps {
    id: PieceId;
    /** Seconds into its moment, for a host that keeps its own time; it plays when left out. */
    time?: number;
    playing?: boolean;
    /** A stage file's `pieceStyles`, so the piece looks and plays as on that stage. */
    pieceStyles?: PieceStyles | Record<string, unknown>;
    /** Its own moment over its kind's style. */
    moment?: Partial<MomentSpec>;
    /** false draws it without its card (pieces with `card: true`). */
    surface?: boolean;
    /** Its size against its own box in points. Default 1. */
    scale?: number;
    appearance?: Appearance;
    className?: string;
    style?: CSSProperties;
}

/** The stage a stage file describes, drawn as the Rovo stage lab draws it. */
export declare const RovoStage: ForwardRefExoticComponent<RovoStageProps & RefAttributes<StageHandle>>;

/** One piece alone, playing its moment as the wall plays it. */
export declare const RovoPiece: ForwardRefExoticComponent<RovoPieceProps & RefAttributes<StageHandle>>;

/** What a stage file holds, or null when the kit can't read it. */
export declare function stageInfo(source: StageSource): StageInfo | null;

/** Every piece the kit draws (as pieces.json). */
export declare const PIECES: readonly KitPiece[];
export declare const KIT_VERSION: string;
export declare const STAGE_FORMAT: 'rovo-stage';
export declare const STAGE_FORMAT_VERSION: 1;
