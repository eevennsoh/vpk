import { animate } from "motion";

import { createFinaleConfettiBurst, FINALE_CONFETTI_DURATION } from "./finale-confetti";

/** One simultaneous burst. Resolve only once every piece is gone, before GL takes over. */
export function playFinaleConfetti(signal: AbortSignal, reducedMotion: boolean): Promise<void> {
	if (signal.aborted || reducedMotion) return Promise.resolve();
	return new Promise((resolve) => {
		const layer = document.createElement("div");
		layer.setAttribute("aria-hidden", "true");
		layer.inert = true;
		layer.dataset.finaleConfetti = "";
		layer.className = "pointer-events-none fixed inset-0 z-[10000] overflow-hidden";
		const particles = createFinaleConfettiBurst(window.innerHeight);
		const animations: ReturnType<typeof animate>[] = [];
		const pieces = particles.map((particle) => {
			const piece = document.createElement("div");
			piece.dataset.confettiCorner = particle.corner;
			piece.className = "absolute pointer-events-none";
			Object.assign(piece.style, {
				left: particle.corner === "left" ? "0" : "100%",
				top: "100%",
				width: `${particle.width}px`,
				height: `${particle.height}px`,
				borderRadius: `${particle.radius}px`,
				backgroundColor: particle.color,
				transform: particle.keyframes.transform[0],
				opacity: "0",
				willChange: "transform, opacity",
			});
			layer.appendChild(piece);
			return piece;
		});
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			signal.removeEventListener("abort", finish);
			window.removeEventListener("resize", finish);
			for (const animation of animations) animation.cancel();
			layer.remove();
			resolve();
		};
		signal.addEventListener("abort", finish, { once: true });
		// A resized viewport clears the burst and lets the shader capture fresh geometry.
		window.addEventListener("resize", finish, { once: true });
		document.body.appendChild(layer);
		try {
			for (let index = 0; index < pieces.length; index++) {
				animations.push(animate(pieces[index], particles[index].keyframes, { duration: FINALE_CONFETTI_DURATION, ease: "linear" }));
			}
			void Promise.all(animations).then(finish, finish);
		} catch {
			// Unsupported animation must never prevent the existing closing sequence.
			finish();
		}
	});
}
