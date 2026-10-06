export interface LanyardPlayerState {
	time: number;
	playing: boolean;
	looping: boolean;
}

/**
 * Playback clock for a lanyard. It lives outside React so a 60 fps timeline
 * re-renders only the transport that subscribes to it, never the editor, and
 * the frame loop runs only while the animation is actually playing.
 */
export class LanyardPlayer {
	private state: LanyardPlayerState = { time: 0, playing: false, looping: false };
	private readonly listeners = new Set<() => void>();
	private frame = 0;
	private last = 0;

	/**
	 * `prefersReducedMotion` is read on every play request, so a preference
	 * change applies immediately. While it holds, play settles to the end pose.
	 */
	constructor(
		readonly duration: number,
		private readonly render: (time: number) => void,
		private readonly prefersReducedMotion: () => boolean = () => false,
	) {}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => { this.listeners.delete(listener); };
	};

	getSnapshot = () => this.state;

	private set(next: Partial<LanyardPlayerState>) {
		this.state = { ...this.state, ...next };
		this.listeners.forEach((listener) => listener());
	}

	/** Redraws the current frame, e.g. after the card text or canvas size changed. */
	redraw() {
		this.render(this.state.time);
	}

	play() {
		if (this.prefersReducedMotion()) {
			this.finish();
			return;
		}
		// Exactly one frame loop: a replay during playback must not start a second.
		this.halt();
		const time = this.state.time >= this.duration ? 0 : this.state.time;
		this.last = 0;
		this.set({ playing: true, time });
		this.render(time);
		this.schedule();
	}

	pause() {
		this.halt();
		this.set({ playing: false });
	}

	replay() {
		this.halt();
		this.set({ time: 0 });
		this.play();
	}

	/** Pauses and moves the playhead in a single notification. */
	seek(time: number) {
		this.halt();
		const clamped = Math.min(Math.max(time, 0), this.duration);
		this.set({ playing: false, time: clamped });
		this.render(clamped);
	}

	/** Jumps to the settled end pose without animating. */
	finish() {
		this.seek(this.duration);
	}

	setLooping(looping: boolean) {
		this.set({ looping });
		if (looping && !this.state.playing) this.replay();
	}

	dispose() {
		this.halt();
		this.listeners.clear();
	}

	private halt() {
		cancelAnimationFrame(this.frame);
		this.frame = 0;
	}

	private schedule() {
		this.frame = requestAnimationFrame(this.tick);
	}

	private tick = (now: number) => {
		this.frame = 0;
		if (!this.state.playing) return;
		let time = this.state.time + (this.last ? Math.min((now - this.last) / 1000, .1) : 0);
		this.last = now;
		if (time >= this.duration) {
			if (this.state.looping) time %= this.duration;
			else {
				this.set({ time: this.duration, playing: false });
				this.render(this.duration);
				return;
			}
		}
		this.set({ time });
		this.render(time);
		this.schedule();
	};
}
