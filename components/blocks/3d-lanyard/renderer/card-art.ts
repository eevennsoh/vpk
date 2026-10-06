import { CARD, DEG, HOLE_R } from "./constants";
import type { AgentCardArt, CardContent, CardTheme, LanyardSurface } from "./types";

/** Raster inputs the card face paints from. */
export interface CardArtSources {
	headerPattern: LanyardSurface;
	agentImages: Record<string, LanyardSurface>;
	rovoMark: LanyardSurface;
	/** Decoded presenter photo; null when absent or still loading. */
	portrait: LanyardSurface | null;
}

export const cardPalettes = {
	light: { body: '#fff', header: '#f8f8f8', title: '#292a2e', muted: '#8c8f97',
		outline: 'rgba(30,31,33,.14)', hole: 'rgba(11,18,14,.14)' },
	dark: { body: '#1f1f21', header: '#18191a', title: '#cecfd2', muted: '#97999e',
		grid: '#4b4d51', edge: '#3b3d40', outline: 'rgba(206,207,210,.14)', hole: 'rgba(206,207,210,.14)' }
};
let darkHeaderPattern: HTMLCanvasElement | undefined;
function headerPattern(sources: CardArtSources, dark: boolean) {
	if (!dark) return sources.headerPattern;
	if (!darkHeaderPattern) {
		// Recolour the original opaque tile, retaining every dash and antialiased edge.
		darkHeaderPattern = document.createElement('canvas');
		darkHeaderPattern.width = sources.headerPattern.width; darkHeaderPattern.height = sources.headerPattern.height;
		const c = darkHeaderPattern.getContext('2d')!; c.drawImage(sources.headerPattern, 0, 0);
		const pixels = c.getImageData(0, 0, darkHeaderPattern.width, darkHeaderPattern.height);
		const rgb = (hex: string) => (hex.match(/[a-f\d]{2}/gi) ?? []).map((channel) => parseInt(channel, 16));
		const background = rgb(cardPalettes.dark.header), grid = rgb(cardPalettes.dark.grid);
		for (let i = 0; i < pixels.data.length; i += 4) {
			const ink = 1 - pixels.data[i] / 255;
			for (let channel = 0; channel < 3; channel++) pixels.data[i + channel] = background[channel] + (grid[channel] - background[channel]) * ink;
		}
		c.putImageData(pixels, 0, 0);
	}
	return darkHeaderPattern;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}
function linesFor(ctx: CanvasRenderingContext2D, text: string, width: number) {
	const lines: string[] = [];
	for (const paragraph of String(text).split('\n')) {
		let line = '';
		for (const word of paragraph.split(/\s+/).filter(Boolean)) {
			if (ctx.measureText(word).width > width) {
				if (line) { lines.push(line); line = ''; }
				for (const letter of word) {
					if (line && ctx.measureText(line + letter).width > width) { lines.push(line); line = ''; }
					line += letter;
				}
			} else if (line && ctx.measureText(line + ' ' + word).width > width) {
				lines.push(line); line = word;
			} else line += (line ? ' ' : '') + word;
		}
		lines.push(line);
	}
	return lines;
}
function fitText(ctx: CanvasRenderingContext2D, text: string, family: string, preferred: number, maxLines: number, lineRatio: number, minimum: number, tracking = 0) {
	let size = preferred, lines: string[];
	do {
		ctx.font = `500 ${size}px "${family}", ${family === 'Atlassian Mono' ? 'monospace' : 'Arial, sans-serif'}`;
		ctx.letterSpacing = `${size * tracking}px`;
		lines = linesFor(ctx, text, CARD.width - CARD.paddingX * 2);
		if (lines.length <= maxLines || size <= minimum) break;
		size -= 1;
	} while (true);
	if (lines.length > maxLines) {
		lines = lines.slice(0, maxLines);
		let last = lines[maxLines - 1];
		while (last && ctx.measureText(last + '…').width > CARD.width - CARD.paddingX * 2) last = last.slice(0, -1);
		lines[maxLines - 1] = last + '…';
	}
	return { lines, size, lineHeight: size * lineRatio };
}
function drawPortrait(ctx: CanvasRenderingContext2D, sources: CardArtSources, config: CardContent) {
	const image = config.photo ? sources.portrait : null;
	const x = CARD.x + 109.5, y = CARD.y + 52.5, width = 141, height = 140;
	ctx.save();
	ctx.beginPath(); ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); ctx.clip();
	ctx.fillStyle = '#e1e7dc'; ctx.fillRect(x, y, width, height);
	if (image) {
		const scale = Math.max(width / image.width, height / image.height);
		const cropWidth = width / scale, cropHeight = height / scale;
		ctx.drawImage(image, (image.width - cropWidth) / 2, (image.height - cropHeight) / 2, cropWidth, cropHeight, x, y, width, height);
	} else {
		const initials = String(config.name || 'Your name').trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
		ctx.font = '500 44px "Atlassian Sans", Arial, sans-serif';
		ctx.fillStyle = '#6b7864'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		ctx.fillText(initials, x + width / 2, y + height / 2 + 2);
	}
	ctx.restore();
}
const DESCRIPTION_LINES = 3;

/** Wraps to the card's text column and ellipsises whatever overflows. */
function wrapDescription(ctx: CanvasRenderingContext2D, text: string) {
	const width = CARD.width - CARD.paddingX * 2;
	const lines = linesFor(ctx, text, width);
	if (lines.length <= DESCRIPTION_LINES) return lines;
	const visible = lines.slice(0, DESCRIPTION_LINES);
	let last = visible[DESCRIPTION_LINES - 1];
	while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
	visible[DESCRIPTION_LINES - 1] = last + '…';
	return visible;
}

export function drawCard(ctx: CanvasRenderingContext2D, sources: CardArtSources, config: CardContent, yaw: number, agent: AgentCardArt | null = null, theme: CardTheme = 'light') {
	const { x, y, width, height, radius } = CARD;
	const dark = !!agent && theme === 'dark', palette = cardPalettes[dark ? 'dark' : 'light'];
	ctx.save();
	ctx.translate(210, 419);
	ctx.transform(Math.cos(yaw * DEG), Math.sin(yaw * DEG) * .08, 0, 1, 0, 0);
	ctx.translate(-210, -419);
	// Artwork stays shadow-free; the scene casts shadows from its 3D geometry.
	ctx.fillStyle = palette.body; roundRect(ctx, x, y, width, height, radius); ctx.fill();
	ctx.save(); roundRect(ctx, x, y, width, height, radius); ctx.clip();
	ctx.fillStyle = palette.header; ctx.fillRect(x, y, width, CARD.header);
	// Original 56px tile, at Figma's 64% scale and 20% opacity, centered in the header.
	// The 58px exported asset includes its 1px stroke on each outer edge.
	ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, CARD.header); ctx.clip();
	ctx.globalAlpha = dark ? 1 : .2;
	const pattern = headerPattern(sources, dark);
	const tile = 56 * .64;
	const startX = x + width / 2 - tile / 2 - Math.ceil(width / tile / 2) * tile;
	const startY = y + CARD.header / 2 - tile / 2 - Math.ceil(CARD.header / tile / 2) * tile;
	for (let ty = startY; ty < y + CARD.header; ty += tile) for (let tx = startX; tx < x + width; tx += tile) {
		ctx.drawImage(pattern, 1, 1, 56, 56, tx, ty, tile, tile);
	}
	ctx.restore();
	if (agent) {
		// Figma's 128px badge slot includes a 4.686px vertical hexagon overhang.
		ctx.drawImage(sources.agentImages[agent.asset], x + 116, y + 58.5 - 4.685714, 128, 137.386658);
		if (agent.asset === 'rovo') ctx.drawImage(sources.rovoMark, x + 139, y + 82, 82, 82);
	} else drawPortrait(ctx, sources, config);
	ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
	const nameText = config.name || 'Your name', roleText = String(config.role || '').toUpperCase();
	let name = fitText(ctx, nameText, 'Atlassian Sans', 32, 3, 37 / 32, 12);
	let role = fitText(ctx, roleText, 'Atlassian Mono', 20, 4, 24 / 20, 10, .01);
	if (!roleText.trim()) role.lines = [];
	const gap = role.lines.length ? 16 : 0;
	const textHeight = () => name.lines.length * name.lineHeight + gap + (role.lines.length ? (role.lines.length - 1) * role.lineHeight + role.size * .75 : 0);
	// Keep the new top alignment while allowing long custom names and roles to fit.
	while (textHeight() > height - CARD.header - CARD.paddingY * 2 && (name.size > 12 || role.size > 10)) {
		name = fitText(ctx, nameText, 'Atlassian Sans', Math.max(12, name.size - 1), 3, 37 / 32, 12);
		role = fitText(ctx, roleText, 'Atlassian Mono', Math.max(10, role.size - 1), 4, 24 / 20, 10, .01);
		if (!roleText.trim()) role.lines = [];
	}
	const top = y + CARD.header + CARD.paddingY;
	ctx.font = `500 ${name.size}px "Atlassian Sans", Arial, sans-serif`;
	ctx.letterSpacing = '0px'; ctx.fillStyle = palette.title;
	const metrics = ctx.measureText('Hg');
	let baseline = top + (name.lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 + metrics.fontBoundingBoxAscent;
	name.lines.forEach(line => { ctx.fillText(line, x + CARD.paddingX, baseline); baseline += name.lineHeight; });
	ctx.font = `500 ${role.size}px "Atlassian Mono", monospace`;
	ctx.letterSpacing = `${role.size * .01}px`; ctx.fillStyle = palette.muted;
	// The Figma role uses cap-height trimming; its visible capitals start after the 16px gap.
	baseline = top + name.lines.length * name.lineHeight + gap + ctx.measureText('H').actualBoundingBoxAscent;
	role.lines.forEach(line => { ctx.fillText(line, x + CARD.paddingX, baseline); baseline += role.lineHeight; });
	if (agent) {
		ctx.font = '400 20px "Atlassian Sans", Arial, sans-serif';
		ctx.letterSpacing = '.2px';
		const description = wrapDescription(ctx, agent.description);
		// The provider's 15px trimmed cap height is followed by a 24px content gap.
		baseline = top + 37 + 16 + 15 + 24 + ctx.measureText('H').actualBoundingBoxAscent;
		description.forEach(line => { ctx.fillText(line, x + CARD.paddingX, baseline); baseline += 24; });
	}
	ctx.restore();
	ctx.strokeStyle = palette.outline; ctx.lineWidth = .5;
	roundRect(ctx, x, y, width, height, radius); ctx.stroke();
	ctx.globalCompositeOperation = 'destination-out';
	ctx.beginPath(); ctx.arc(210, 419, HOLE_R, 0, Math.PI * 2); ctx.fill();
	ctx.globalCompositeOperation = 'source-over';
	ctx.strokeStyle = palette.hole; ctx.lineWidth = 1;
	ctx.beginPath(); ctx.arc(210, 419, HOLE_R + .5, 0, Math.PI * 2); ctx.stroke();
	ctx.restore();
}
