// rovo-stage-kit: the Rovo Stage Kit for any page (React rides inside). Importing it defines
// <rovo-stage> and <rovo-piece>. Rovo Stage Kit 1.0.0.
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

export interface StageOptions {
    stage: StageSource;
    time?: number;
    playing?: boolean;
    curtain?: number;
    appearance?: Appearance;
    fit?: 'contain' | 'none';
    className?: string;
    style?: Record<string, string | number>;
    onStage?: (info: StageInfo) => void;
}

export interface PieceOptions {
    id: PieceId;
    time?: number;
    playing?: boolean;
    pieceStyles?: PieceStyles | Record<string, unknown>;
    moment?: Partial<MomentSpec>;
    surface?: boolean;
    scale?: number;
    appearance?: Appearance;
    className?: string;
    style?: Record<string, string | number>;
}

/** A stage or piece drawn into an element: its controls, new options, and its end. */
export interface Mounted<O> extends StageHandle {
    update(options: Partial<O>): void;
    unmount(): void;
}

/** Draws a stage into an element (its contents are replaced). */
export declare function mountStage(element: HTMLElement, options: StageOptions): Mounted<StageOptions>;

/** Draws one piece into an element (its contents are replaced). */
export declare function mountPiece(element: HTMLElement, options: PieceOptions): Mounted<PieceOptions>;

export interface RovoStageEventMap extends HTMLElementEventMap {
    /** The stage is read and drawn: its info. */
    ready: CustomEvent<StageInfo>;
    /** The stage file couldn't be fetched or read. */
    stageerror: CustomEvent<unknown>;
}

/** <rovo-stage src="rovo-stage.json" [time] [paused] [curtain] [appearance] [fit]> */
export declare class RovoStageElement extends HTMLElement {
    /** The stage file itself (object or text), over `src`. */
    stage: StageSource | null;
    play(): void;
    pause(): void;
    /** Held there when it is held on a `time`; else it plays on or stays paused. */
    seek(seconds: number): void;
    redraw(): void;
    readonly currentTime: number;
    addEventListener<K extends keyof RovoStageEventMap>(
        type: K,
        listener: (this: RovoStageElement, event: RovoStageEventMap[K]) => unknown,
        options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void;
}

/** <rovo-piece piece="mentions" [time] [paused] [scale] [appearance] [surface="off"] [play] [rest]
 * [length]> */
export declare class RovoPieceElement extends HTMLElement {
    /** A stage file's `pieceStyles`. */
    pieceStyles: PieceStyles | Record<string, unknown> | undefined;
    play(): void;
    pause(): void;
    seek(seconds: number): void;
    redraw(): void;
    readonly currentTime: number;
}

/** Defines the two elements (importing the kit does it; a second copy leaves them be). */
export declare function defineRovoElements(): void;

export declare function stageInfo(source: StageSource): StageInfo | null;
export declare const PIECES: readonly KitPiece[];
export declare const KIT_VERSION: string;
export declare const STAGE_FORMAT: 'rovo-stage';
export declare const STAGE_FORMAT_VERSION: 1;

declare global {
    interface HTMLElementTagNameMap {
        'rovo-stage': RovoStageElement;
        'rovo-piece': RovoPieceElement;
    }
}
