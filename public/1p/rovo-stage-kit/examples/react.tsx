// The Rovo Stage Kit in a React 18 app. `rovo-stage-kit` is the kit's folder as a local package
// ("rovo-stage-kit": "file:vendor/rovo-stage-kit"); the JSON import needs resolveJsonModule.
import React, { useEffect, useRef, useState } from 'react';
import { RovoPiece, RovoStage, type StageHandle, stageInfo } from 'rovo-stage-kit/react';
import stage from 'rovo-stage-kit/rovo-stage.json';

/** The stage as a hero: as wide as its column, the board's own ratio, playing on its own clock.
 * It is decorative motion, so assistive tech skips it. */
export function StageHero(): React.ReactElement {
    return (
        <div aria-hidden>
            <RovoStage stage={stage} />
        </div>
    );
}

/** Filling a box of the host's size: the board fitted inside, letterboxed. */
export function StageInBox(): React.ReactElement {
    return (
        <div style={{ width: 960, height: 720 }}>
            <RovoStage stage={stage} style={{ height: '100%' }} />
        </div>
    );
}

/** Driven by the host's own clock (a scroll position, a video's time): it holds each frame. */
export function StageOnScroll({ progress }: { progress: number }): React.ReactElement {
    const loop = stageInfo(stage)?.loop ?? 60;
    return <RovoStage stage={stage} time={progress * loop} />;
}

/** Opening on the keynote's curtain: down for two seconds, then raised into the stage. */
export function KeynoteOpening(): React.ReactElement {
    return <RovoStage stage={stage} curtain={2} />;
}

/** Played and paused from outside, and still for people who ask for less motion. */
export function ControlledStage(): React.ReactElement {
    const handle = useRef<StageHandle>(null);
    const [reduced, setReduced] = useState(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const change = () => setReduced(query.matches);
        query.addEventListener('change', change);
        return () => query.removeEventListener('change', change);
    }, []);
    const poster = stageInfo(stage)?.poster ?? 0;
    return (
        <>
            <RovoStage ref={handle} stage={stage} time={reduced ? poster : undefined} />
            <button type="button" onClick={() => handle.current?.pause()}>
                Pause
            </button>
            <button type="button" onClick={() => handle.current?.play()}>
                Play
            </button>
        </>
    );
}

/** One piece alone, looking and playing as it does on this stage. */
export function MentionsPiece(): React.ReactElement {
    return <RovoPiece id="mentions" pieceStyles={stage.pieceStyles} scale={0.75} />;
}
