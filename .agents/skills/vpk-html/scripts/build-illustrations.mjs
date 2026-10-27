#!/usr/bin/env node
/*
 * build-illustrations (v2) — the technical-illustration exemplar generator.
 *
 *   node .agents/skills/vpk-html/scripts/build-illustrations.mjs            # brief exemplars only (unsandboxed write)
 *   node .agents/skills/vpk-html/scripts/build-illustrations.mjs --check    # exit 1 if a brief exemplar drifted
 *   node .agents/skills/vpk-html/scripts/build-illustrations.mjs --legacy   # also rewrite the 5 hand SVG exemplars
 *
 * BRIEF_EXAMPLES are iso-kit briefs (scripts/iso/briefs/*.json): buildFigure() → illustrationPage()
 * (figures/page.mjs) → the ws0 runtime pipeline per target, written to assets/illustrations/<slug>.html
 * and assets/demos/demo-illustration-<slug>.html. GALLERY puts the core ones on the hub page,
 * assets/demos/demo-illustration-gallery.html (one inlined iso block, a distinct FIG_nnn per figure), with links to
 * GALLERY_PAGES: assets/demos/demo-illustration-gallery-<source>-<group>.html. An exemplar with a `gallery` key
 * appears only on that gallery page (no standalone page); every page must fit the data-URL viewer budget.
 * Every output passes check-html and the iso audit before anything is written.
 * LEGACY_EXAMPLES are the five v1 hand SVGs. They are maintained in place by
 * build.mjs --refresh-library; --legacy regenerates them and warns, because the committed copies
 * have drifted from this source (ws0 V9: about −13,000 lines). They keep their paths and markup.
 * Finish with: node .agents/skills/vpk-html/scripts/build.mjs --refresh-library (barrier step).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { illustrationPage } from "./figures/page.mjs";
import { shelfFigures } from "./hairline/figures.mjs";
import { ANATOMY_GL_FIGURES } from "./anatomy-gl/figures.mjs";
import { buildFigure } from "./iso/build-figure.mjs";
import { auditHtml } from "./iso/audit.mjs";
import { DEMOS, ILLUSTRATIONS } from "./shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BRIEF_EXAMPLES = Object.freeze([
	{
		slug: "iso-exploded-stack",
		brief: "iso/briefs/exploded-stack.json",
		title: "Exploded Stack",
		summary: "An isometric stack built by the iso kit from a JSON brief. It assembles once on entry, separates under the pointer or the Gap slider, and holds still under reduced motion.",
	},
	{
		slug: "iso-flatpack-shelf",
		brief: "iso/briefs/flatpack-shelf.json",
		title: "Flat-pack shelf, step 3",
		summary: "An assembly-manual exploded view of a small wall shelf. Hover to pull the panels apart along the dowel axis; the orange middle shelf is the part this step adds.",
	},
	{
		slug: "iso-phone-anatomy",
		brief: "iso/briefs/phone-anatomy.json",
		title: "Anatomy of a phone",
		summary: "A phone pulled apart into its stacked layers, from back glass to cover glass. Hover a layer to lift it and read its name; the battery is the part to watch.",
	},
	{
		slug: "iso-cache-shelves",
		brief: "iso/briefs/cache-shelves.json",
		title: "Select a cache tier",
		summary: "A system figure of a three-tier read path: CPU, L1/L2 caches and memory as stacked plates on a board. Select any tier to lift it; the L2 cache is the one under discussion.",
	},
	{
		slug: "iso-parcel-tray",
		brief: "iso/briefs/parcel-tray.json",
		title: "Parcel sorting tray",
		summary: "An open sorting tray holding three parcels and a coiled tape roll, seen from above. Hover to lift the parcels out of the tray; the urgent parcel carries the accent.",
	},
	{
		slug: "iso-turntable-anatomy",
		brief: "iso/briefs/turntable-anatomy.json",
		title: "Anatomy of a turntable",
		summary: "A record player built from a plinth, a cylindrical platter, a record and a tonearm block, with its true depth dimensioned. Hover to explode it upward; the record is the focal part.",
	},
	{
		slug: "iso-card-stack-ui",
		brief: "iso/briefs/card-stack-ui.json",
		title: "Anatomy of a card",
		summary: "A UI card pulled apart into its interface layers: surface, media, text block, action button and focus ring. Select a layer to lift it out; the primary button is the part to watch.",
	},
	// Recreations of the anatomy collection (an-*). `gallery` names the gallery page that shows each one
	// (GALLERY_PAGES); these get no standalone page, so the demos folder stays small. The hairline pages render the
	// vendored hairline figures themselves (hairline/figures.mjs), not briefs.
	{ slug: "iso-an-hash-map", brief: "iso/briefs/an-hash-map.json", title: "Hash map collisions, pigeonhole buckets", gallery: "anatomy-1", summary: "After the anatomy collection. A turned-leg sorting desk with eight pigeonholes, buckets 0 to 7, and a coding machine on a ruled rail. The letters are highlighted: kiwi in bucket 1, fig in 5, raisin on plum in 3, a collision, with lime and orange waiting in the tray." },
	{ slug: "iso-an-binary-search", brief: "iso/briefs/an-binary-search.json", title: "Binary search on a lab balance", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric lab balance, pillar, beam and two hung pans: a sample on the left, the accented middle weight on the lower right pan. In front a case of sixteen graded weights; twelve sunk flush, four left in slots 9 to 12, seat 11 empty." },
	{ slug: "iso-an-dns", brief: "iso/briefs/an-dns.json", title: "DNS resolution by pneumatic tube", gallery: "anatomy-1", summary: "An isometric recreation of the anatomy collection's \"DNS resolution\" pneumatic tube dispatcher: from a resolver drum on a round desk, tubes of rising height reach the root, com and example.com servers; the accented capsule waits in its cradle and a rack of cache cards stands for cached answers." },
	{ slug: "iso-an-message-queue", brief: "iso/briefs/an-message-queue.json", title: "A message queue as a marble run", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric marble run: two producer hoppers sit on the upstream end of one level lane, four marbles wait in order behind an escapement gate, and three consumer drums stand at the lane exit. Hover or arrow keys lift one part." },
	{ slug: "iso-an-lru-cache", brief: "iso/briefs/an-lru-cache.json", title: "LRU cache as a bookcase", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric low bookcase with ten lettered slots, A to J, across its front; E to J hold books, A to D are empty. Four books stand on top between bookends, most recent at left; the least recent, Book D, sits over its free slot." },
	{ slug: "iso-an-tcp-handshake", brief: "iso/briefs/an-tcp-handshake.json", title: "TCP handshake, a mail ropeway", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric mail ropeway: client and server stations with gauges, mail bins, bull wheels and semaphores, and a midway hut on braced stilts carrying two ropes. Click to send SYN, SYN with ACK and ACK; the highlighted client arm reads established." },
	{ slug: "iso-an-gradient-descent", brief: "iso/briefs/an-gradient-descent.json", title: "Gradient descent on a contour model", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric contour model of a narrow valley in stacked boards; pins on a thread zigzag down, overshoot across the valley and settle at the black current pin on the floor, beside the accented rate knob." },
	{ slug: "iso-an-bloom-filter", brief: "iso/briefs/an-bloom-filter.json", title: "Bloom filter as a fruit machine", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric fruit machine: three hash reels recessed in a front window, a coin slot, a pull lever on a side hub, a rail of sixteen flags on top and a payout tray, with a tablet of fruit coins where the grape coin is highlighted." },
	{ slug: "iso-an-flex-grow", brief: "iso/briefs/an-flex-grow.json", title: "flex-grow as a bench vise", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric bench vise: a fixed and a moving jaw clamp three blocks in a row. Three equal springs share the free space: one after the grow 1 block, two after the grow 2 block, none after the grow 0 block." },
	{ slug: "iso-an-mark-sweep", brief: "iso/briefs/an-mark-sweep.json", title: "Mark and sweep as a modular synth", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric synth case as the heap: patch cables run from the highlighted stack module and the registers, so A, B, C, G and K are marked; D, H and I patch only into each other, a cycle no root reaches, and the sweep pulls them off the rails." },
	{ slug: "iso-an-b-tree", brief: "iso/briefs/an-b-tree.json", title: "B-tree index, a rotary card file", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric rotary card file: ten trays of highlighted index cards hang round a spoked wheel turned by a crank, above a six-drawer cabinet. One tray sits at the reading stop and the drawer holding the found row slides open." },
	{ slug: "iso-an-debounce", brief: "iso/briefs/an-debounce.json", title: "Debounce and throttle recorder", gallery: "anatomy-1", summary: "An isometric take on the \"Debounce, throttle\" music-box recorder from the anatomy collection: five turns of the crank are five calls, the throttle dashpot sets two pins on the disc and the orange debounce dashpot sets one." },
	{ slug: "iso-an-mutex", brief: "iso/briefs/an-mutex.json", title: "A mutex as a tank and key", gallery: "anatomy-1", summary: "After the anatomy collection. Dimetric water tank on a stand, filled by two pumps, one at each side, each run by its own controller with a key slot on top. Between them a lock box holds a single accented interlock key. Hover or arrow keys lift one part." },
	{ slug: "iso-an-merge-sort", brief: "iso/briefs/an-merge-sort.json", title: "Merge sort on a chime rack", gallery: "anatomy-2", summary: "After the anatomy collection. Dimetric chime rack: two sorted runs of bells, each shortening behind its front bell, a merged run of the longest bells, and the accented overhead traveller carrying the lower front bell to the end of the merged run." },
	{ slug: "iso-an-sampling", brief: "iso/briefs/an-sampling.json", title: "Temperature as a roulette wheel", gallery: "anatomy-2", summary: "After the anatomy collection. Dimetric roulette table: a pocket rotor whose sixteen frets are spaced by next-token probability, a ball in the widest pocket, a thermostat with an accented temperature knob and a thermometer, and a chip tray." },
	{ slug: "iso-an-watch", brief: "iso/briefs/an-watch.json", title: "Watch movement taken apart", gallery: "anatomy-2", summary: "After the anatomy collection. Dimetric watch movement in a holder: main plate with mainspring barrel, gear train, escape wheel, pallet fork and balance wheel as thin discs on arbors, crown on its stem at the case edge. The balance wheel is highlighted." },
	{ slug: "iso-an-seasons", brief: "iso/briefs/an-seasons.json", title: "Tellurion on a turntable", gallery: "anatomy-2", summary: "After the anatomy collection. Dimetric tellurion: a lamp on a pillar for the Sun, an orbit arm whose five gears carry a globe with its axis tilted 23.4 degrees from vertical, and a ring tracing the yearly orbit. The globe's Tropic of Cancer is highlighted." },
	{ slug: "iso-an-computer", brief: "iso/briefs/an-computer.json", title: "An old desk computer", gallery: "anatomy-2", summary: "After the anatomy collection. Dimetric all-in-one desk computer on a desk mat: a vented case, a deep bezel round a display showing a prompt and cursor, a floppy slot, and a keyboard tied to the case by a coiled cable. The display is accented." },
	{ slug: "iso-an-rate-limiter", brief: "iso/briefs/an-rate-limiter.json", title: "Token bucket on an air bench", gallery: "anatomy-3", summary: "A recreation of anatomy's \"Token bucket\" (No. 27, Air bench) as an isometric air bench: a pump fills an orange token tank that holds at most eight tokens, a relief valve on the lid vents the overflow, and a punch press with an interlock spends one token for each punch of the paper tape." },
	{ slug: "iso-an-easing", brief: "iso/briefs/an-easing.json", title: "Easing curves on a bench", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric easing bench: a lead screw moves a carriage at a constant rate (time); its follower rides a raised ease-in-out band on an upright graph plate, and a lift arm raises the highlighted progress block on a scaled column." },
	{ slug: "iso-an-public-key", brief: "iso/briefs/an-public-key.json", title: "A strongbox with two kinds of key", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric strongbox with hinges, a hasp and a keyholed lid lock. A highlighted public key stands in the lid lock and two more wait in a caddy on its left; the one private key sits alone on a knurled pedestal." },
	{ slug: "iso-an-box-model", brief: "iso/briefs/an-box-model.json", title: "The box model as a frame jig", gallery: "anatomy-3", summary: "A recreation of the anatomy collection's \"Box model\" frame jig. A picture-frame jig on a base, with a fence and a clamp, holds the CSS box model as nested frames: a dashed margin outline, a border moulding, a padding mat and the content print; the moulding and the print carry the accent. Hovering lifts the frames apart." },
	{ slug: "iso-an-git-merge", brief: "iso/briefs/an-git-merge.json", title: "Branch and merge on a model railway", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric model railway: stations threaded on a main line, and a feature line that branches off and crosses back into main at a merge station with one stud per parent, where the accented main cart stands. Hover or arrow keys lift a part." },
	{ slug: "iso-an-one-pane", brief: "iso/briefs/an-one-pane.json", title: "One pane as a die set", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric die set: a base on four feet holds the picture bed; four guide pillars pass through the frosted copy, the ringed distance field and the glass pane on top, highlighted. A 2D canvas stands on the front ledge." },
	{ slug: "iso-an-one-context", brief: "iso/briefs/an-one-context.json", title: "One context as a plotter", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric plotter: sixteen wells, one 2D canvas per pane, each holding a stamped shape. A gantry on a drag chain carries one highlighted webgl2 print head over pane 11, its stamp lowered into that pane. Hover or arrow keys lift one part." },
	{ slug: "iso-an-shared-canvas", brief: "iso/briefs/an-shared-canvas.json", title: "Shared canvas, a drafting board", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric drafting board in device pixels: a corner block at (0, 0), width and height rulers with ratchet stops marking a 512 by 352 canvas, and the accented draw card seated at the corner." },
	{ slug: "iso-an-one-texture", brief: "iso/briefs/an-one-texture.json", title: "One texture, a tray of mip levels", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric tray: the picture stands in a slot at the back; dot-grid wells in front, each half the last, hold its mip levels down to a 1x1 pit. Two loupes stand on level 0 and a tiny highlighted loupe reads level 2." },
	{ slug: "iso-an-fit", brief: "iso/briefs/an-fit.json", title: "object-fit as a picture frame", gallery: "anatomy-3", summary: "After the anatomy collection. Dimetric picture frame on a steel square: the window is the element's box, the print fills it by cover, and the two overhanging strips lie cut off beside the frame. Hovering slides the cut strips away." },
	{ slug: "iso-an-one-stage", brief: "iso/briefs/an-one-stage.json", title: "One stage as a chest of drawers", gallery: "anatomy-3", summary: "After the anatomy collection. Chest of seven render-target drawers: four tall half-float, three short 8-bit, glass pass output pill on top." },
	{ slug: "iso-an-separable-blur", brief: "iso/briefs/an-separable-blur.json", title: "Separable blur, two combs", gallery: "anatomy-4", summary: "A tribute to the anatomy collection's \"Separable blur\" bench. A row comb blurs the source into scratch, then a column comb blurs scratch into frosted, so each pixel reads 98 taps instead of the 2,401 a solid pin block would read." },
	{ slug: "iso-an-field-key", brief: "iso/briefs/an-field-key.json", title: "A cache key as a pin lock", gallery: "anatomy-4", summary: "A tribute to anatomy's \"Field key\" (No. 41): a pin-tumbler lock cut open, where eight pins sit level at the shear line on the accented key blade, cut to last frame's key; change one setting and its pin rides past the line and the whole frame redraws." },
	{ slug: "iso-an-four-frames", brief: "iso/briefs/an-four-frames.json", title: "Four frames as chip stacks", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric tray with four wells. Each chip is one WebGL draw and each thin chip eight blur passes: a first frame stacks 38 draws, a moving control 35, a still glass one chip and a control at rest leaves its well empty." },
	{ slug: "iso-an-lookup", brief: "iso/briefs/an-lookup.json", title: "Lookup, a reading stand", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric reading stand: a clear pane on four posts over a frosted plate, grid lines crowding to the rim, and a bezel probe whose highlighted wire leans outward from the plumb line to its read spot, short of the sled stop." },
	{ slug: "iso-an-profile", brief: "iso/briefs/an-profile.json", title: "Profile gauge on a pane edge", gallery: "anatomy-4", summary: "A recreation of anatomy's \"Profile\" (No. 44): spring pins on a gauge head rest on a slice of a glass pane's edge, so their tops trace the edge, level across the middle and falling over the bezel to a rim the caliper reads at 26.8 px." },
	{ slug: "iso-an-lens-bench", brief: "iso/briefs/an-lens-bench.json", title: "Dispersion, a lens bench", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric lens bench: a glass disc in a ring mount held on a jointed arm over a ruled plate, a probe near its rim, and a rail where the blue, green and red reads of one pixel land apart. The probe is highlighted." },
	{ slug: "iso-an-studio", brief: "iso/briefs/an-studio.json", title: "Rim light on a turntable", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric studio: a rounded pill on a turntable turned 20 degrees between a key lamp and a dimmed fill lamp; its edge is a full rim facing the key, a half rim facing the fill and a trace at the ends. The full rim is highlighted." },
	{ slug: "iso-an-frosted-copy", brief: "iso/briefs/an-frosted-copy.json", title: "Frosted copy, a lightbox and a print", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric print bench: the highlighted pane sits on a lit, dot-gridded bed, its dashed blur reach and halftone frost spilling past it, between a two-bar carriage and paper rolls, with a histogram and blur dial on the front ledge." },
	{ slug: "iso-an-spot-plate", brief: "iso/briefs/an-spot-plate.json", title: "Spot plate, drops that merge", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric spot plate: six channels each hold a pair of glass drops, three pairs run together into one stadium-shaped piece and three still apart, beside a feeler fan and the highlighted merge dial." },
	{ slug: "iso-an-bevel-offset", brief: "iso/briefs/an-bevel-offset.json", title: "Bevel offset on a glass bench", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric glass bench: a bevelled glass block under a clamp, a comb of fibres bending out from its rim, and a carriage on a ruler that sets the IOR. The rim ray and its carriage are highlighted." },
	{ slug: "iso-an-lit-by-facing", brief: "iso/briefs/an-lit-by-facing.json", title: "Lit by facing, a rim stage", gallery: "anatomy-4", summary: "A recreation of anatomy's \"Lit by facing\" (No. 50): a clear rim on a stepped dais lit by a fixed key light at 1.0 and a half-strength fill at 0.5, each point lit by how squarely it faces them, with the rim as the one orange part and select-to-lift parts." },
	{ slug: "iso-an-press-and-pull", brief: "iso/briefs/an-press-and-pull.json", title: "Press and pull", gallery: "anatomy-4", summary: "After the anatomy collection. Dimetric figure: a capsule glass button pressed by a fingertip set toward the pull. A dashed outline marks its rest footprint; the orange capsule is longer and shifted toward the finger. Hover or arrows lift a part." },
	{ slug: "iso-an-three-reads", brief: "iso/briefs/an-three-reads.json", title: "Three reads, one normal", gallery: "anatomy-4", summary: "An isometric optical bench based on the anatomy collection's \"Three reads\" (dispersion) figure: a line card looks through a bevelled glass block (the orange focal part) at red, green and blue read screens set 1, 2 and 3 steps along the same normal, with a red–blue spread dimension and a spread dial." },
	// Teardowns (after the MIT `teardown` skill, github.com/jakubkrehel/skills): briefs written assembled, drawn exploded, with an
	// Exploded / Assembled switch, a Spread slider and part naming (illustrations.md § Teardown).
	{ slug: "iso-td-card", brief: "iso/briefs/td-card.json", title: "Teardown of an interface card", gallery: "teardown", summary: "The teardown skill's own concept example: an interface card taken apart into page, card surface, media, text and the primary button. Switch to Assembled to stack the layers back, or drag the Spread slider; point at a layer to name it." },
	{ slug: "iso-td-drive", brief: "iso/briefs/td-drive.json", title: "Teardown of a hard drive", gallery: "teardown", summary: "After teardown's Drive: the circuit board drops below the base casting, the spindle motor, three platters and the disc clamp rise up the spindle, the head stack swings aside and the top cover lifts clear. Assembled closes the cover over all of it." },
	{ slug: "iso-td-cpu", brief: "iso/briefs/td-cpu.json", title: "Teardown of a CPU in its socket", gallery: "teardown", summary: "After teardown's CPU: motherboard and chokes, the socket frame and its pin field, the package substrate with capacitors, the die, thermal paste, the heat spreader and the retention lid with its lever, stacked along one axis." },
	{ slug: "iso-td-gpu", brief: "iso/briefs/td-gpu.json", title: "Teardown of a graphics card", gallery: "teardown", summary: "After teardown's GPU: backplate, board with GPU, memory, power stages and display ports, the I/O bracket pulled out sideways, the cold plate, two heat pipes, a sixty-fin stack and the shroud with three fans." },
	{ slug: "iso-td-pixels", brief: "iso/briefs/td-pixels.json", title: "Teardown of display pixels", gallery: "teardown", summary: "The teardown skill's concept of layered pixels: backlight, rear polariser, transistor grid, liquid crystal, black matrix, the red, green and blue filters and the cover glass, each lifted off the one below." },
]);

export const LEGACY_EXAMPLES = Object.freeze([
	{
		slug: "isometric-device",
		title: "Isometric Device",
		summary: "An isometric hardware shell using the grayscale figure ramp for faces, edges, and labels.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Isometric device shell with labeled screen, base, and connector rail.">
\t\t\t<path d="M170 132 390 64 552 136 332 214Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M332 214 552 136 552 264 332 342Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M170 132 332 214 332 342 170 258Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M228 148 390 100 494 144 332 198Z" fill="var(--paper)" stroke="var(--ill-line)"/>
\t\t\t<path d="M252 232 302 256M252 250 302 274M252 268 302 292" stroke="var(--ill-hatch)" stroke-width="2"/>
\t\t\t<path d="M426 246h82M426 264h60M426 282h72" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<path d="M116 110h94" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<path d="M210 110 196 102v16Z" fill="var(--ill-line)"/>
\t\t\t<text x="72" y="114" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">screen</text>
\t\t\t<path d="M556 304c34 0 42-18 64-18" stroke="var(--ill-line)"/>
\t\t\t<text x="626" y="290" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">rail</text>
\t\t</svg>`,
	},
	{
		slug: "exploded-assembly",
		title: "Exploded Assembly",
		summary: "An exploded component stack with indefinite SMIL transforms started only when motion is allowed.",
		svg: `\t\t<svg data-vpk-illustration data-vpk-smil-stagger="90" viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Exploded assembly with three isometric plates moving into assembled position.">
\t\t\t<g>
\t\t\t\t<path d="M180 158 350 104 520 158 350 220Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t\t<animateTransform attributeName="transform" type="translate" begin="indefinite" dur="240ms" values="0 -46; 0 0" keySplines="0.25 0.1 0.25 1" calcMode="spline" fill="freeze"/>
\t\t\t</g>
\t\t\t<g>
\t\t\t\t<path d="M180 216 350 162 520 216 350 278Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t\t<path d="M250 218h200" stroke="var(--ill-hatch)" stroke-width="2" stroke-dasharray="10 10"/>
\t\t\t\t<animateTransform attributeName="transform" type="translate" begin="indefinite" dur="240ms" values="0 0; 0 0" keySplines="0.25 0.1 0.25 1" calcMode="spline" fill="freeze"/>
\t\t\t</g>
\t\t\t<g>
\t\t\t\t<path d="M180 274 350 220 520 274 350 336Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t\t<animateTransform attributeName="transform" type="translate" begin="indefinite" dur="240ms" values="0 46; 0 0" keySplines="0.25 0.1 0.25 1" calcMode="spline" fill="freeze"/>
\t\t\t</g>
\t\t\t<path d="M112 158h60M112 216h60M112 274h60" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<text x="66" y="162" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">top</text>
\t\t\t<text x="52" y="220" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">core</text>
\t\t\t<text x="44" y="278" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">base</text>
\t\t</svg>`,
	},
	{
		slug: "annotated-mechanism",
		title: "Annotated Mechanism",
		summary: "Dimension lines, leader curls, and compact mono labels for a compact mechanism diagram.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Annotated mechanism with dimension line, curled leader, actuator, and guide rail.">
\t\t\t<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z" fill="var(--ill-line)"/></marker></defs>
\t\t\t<rect x="180" y="164" width="300" height="82" rx="8" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M208 204h242" stroke="var(--ill-hatch)" stroke-width="2" stroke-dasharray="12 10"/>
\t\t\t<circle cx="268" cy="204" r="34" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<circle cx="396" cy="204" r="34" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M268 204h128" stroke="var(--ill-line)" stroke-width="2.5"/>
\t\t\t<path d="M180 286h300" stroke="var(--ill-line)" stroke-dasharray="24 6" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
\t\t\t<path d="M180 252v50M480 252v50" stroke="var(--ill-line)"/>
\t\t\t<text x="330" y="312" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">300 unit span</text>
\t\t\t<path d="M520 154c34-18 52 2 40 22-10 16 8 28 36 20" stroke="var(--ill-line)"/>
\t\t\t<text x="602" y="202" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">curl leader</text>
\t\t</svg>`,
	},
	{
		slug: "hatched-cross-section",
		title: "Hatched Cross Section",
		summary: "A cutaway panel using bundled hatch strokes and two-tone faces without gradients.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hatched cross section with outer shell, inner channel, and material layers.">
\t\t\t<path d="M160 108h400v190H160Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M212 156h296v94H212Z" fill="var(--paper)" stroke="var(--ill-line)"/>
\t\t\t<path d="M176 126 248 298M206 126 278 298M236 126 308 298M266 126 338 298M296 126 368 298M326 126 398 298M356 126 428 298M386 126 458 298M416 126 488 298M446 126 518 298" stroke="var(--ill-hatch)" stroke-width="2"/>
\t\t\t<path d="M212 156h296v24H212Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M212 226h296v24H212Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M520 152h76" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<text x="604" y="156" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">layer A</text>
\t\t\t<path d="M520 240h76" stroke="var(--ill-line)" stroke-dasharray="24 6"/>
\t\t\t<text x="604" y="244" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">layer B</text>
\t\t</svg>`,
	},
	{
		slug: "isometric-pipeline",
		title: "Isometric Pipeline",
		summary: "A remixable architecture-pipeline illustration with modules, flow arrows, and shaded joins.",
		svg: `\t\t<svg data-vpk-illustration viewBox="0 0 720 420" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Isometric pipeline connecting source, transform, model, and delivery modules.">
\t\t\t<defs><marker id="pipe-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10Z" fill="var(--ill-line)"/></marker></defs>
\t\t\t<path d="M90 170 174 132 258 170 174 210Z" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M280 170 364 132 448 170 364 210Z" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M470 170 554 132 638 170 554 210Z" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M174 210v58L90 226v-56M174 268l84-42v-56" fill="var(--ill-tone2)" stroke="var(--ill-line)"/>
\t\t\t<path d="M364 210v58l-84-42v-56M364 268l84-42v-56" fill="var(--ill-tone3)" stroke="var(--ill-line)"/>
\t\t\t<path d="M554 210v58l-84-42v-56M554 268l84-42v-56" fill="var(--ill-tone1)" stroke="var(--ill-line)"/>
\t\t\t<path d="M248 204h58M438 204h58" stroke="var(--ill-line)" stroke-width="2" marker-end="url(#pipe-arrow)"/>
\t\t\t<path d="M136 226h78M326 226h78M516 226h78" stroke="var(--ill-hatch)" stroke-width="2" stroke-dasharray="12 10"/>
\t\t\t<text x="174" y="118" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">source</text>
\t\t\t<text x="364" y="118" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">transform</text>
\t\t\t<text x="554" y="118" text-anchor="middle" fill="var(--ill-ink50)" font-family="Geist Mono, monospace" font-size="10" letter-spacing="0">deliver</text>
\t\t</svg>`,
	},
]);

const targetsFor = slug => [path.join(ILLUSTRATIONS, `${slug}.html`), path.join(DEMOS, `demo-illustration-${slug}.html`)];

// The v1 page body: the hand SVG inside a framed figure with the summary as its caption.
function legacyFigureHtml({ svg, summary }) {
	return `\t<figure class="figure-frame">\n${svg}\n\t\t<figcaption class="caption">${summary}</figcaption>\n\t</figure>`;
}

async function renderExample(example, kind) {
	const { applyRuntimePipeline } = await import("./runtime/pipeline.mjs");
	const { validateHtmlString } = await import("./check-html.mjs");
	let base;
	if (kind === "brief") {
		const built = await buildFigure({ brief: path.join(__dirname, example.brief), runtime: false, slug: example.slug, title: example.title, summary: example.summary });
		const errors = built.findings.filter(finding => finding.severity === "error");
		if (errors.length) throw new Error(`${example.slug}: iso audit errors: ${errors.map(f => `${f.rule} ${f.message}`).join("; ")}`);
		base = built.html;
	} else {
		base = illustrationPage({ slug: example.slug, title: example.title, summary: example.summary, figureHtml: legacyFigureHtml(example) });
	}
	return targetsFor(example.slug).map(filePath => {
		const html = applyRuntimePipeline(base, { filePath });
		const failures = validateHtmlString(html, filePath).failures;
		if (failures.length) throw new Error(`${path.relative(process.cwd(), filePath)} fails check-html:\n  - ${failures.join("\n  - ")}`);
		if (kind === "brief") {
			const errors = auditHtml(html).findings.filter(finding => finding.severity === "error");
			if (errors.length) throw new Error(`${path.relative(process.cwd(), filePath)}: iso audit errors after the pipeline`);
		}
		return { filePath, html };
	});
}

// The gallery hub: the seven core brief exemplars on one page (one iso block for all of them; the pipeline inserts it once),
// then links to the gallery pages. Every exemplar with a `gallery` key renders only on its gallery page (GALLERY_PAGES),
// grouped by source and shelf so each page stays well inside the data-URL viewer budget (media/size-budget.mjs).
export const GALLERY = Object.freeze({
	slug: "illustration-gallery",
	title: "Generated illustrations",
	summary: "Seven figures built by the iso kit from JSON briefs in its one manual style: white plates, thin lines, one orange accent on the focal part and flat cast shadows. Each assembles on entry; hover or select a part to explode it. The gallery pages below hold hairline's own figures, drawn by the vendored hairline engine, and the recreations of the anatomy collection.",
});

const HAIRLINE = "Lucas Marques's hairline figures, drawn by the vendored hairline engine (scripts/hairline) in the page's theme";
const ANATOMY = "Recreations of the anatomy collection's figures, rebuilt by the iso kit from JSON briefs";
const hairline = (shelf, title) => ({ key: `hairline-${shelf}`, engine: "hairline", shelf, title: `Hairline: ${title}`, summary: `${HAIRLINE}: the ${title.toLowerCase()} shelf. Each answers the pointer; the line under it reads out what it is doing.` });
const anatomy = (n, range) => ({ key: `anatomy-${n}`, title: `Anatomy collection, ${range}`, summary: `${ANATOMY}, ${range.toLowerCase()}. Each assembles on entry; hover or select a part to lift it.` });

export const GALLERY_PAGES = Object.freeze([
	hairline("interfaces", "Interfaces"),
	hairline("data", "Data"),
	hairline("machines", "Machines"),
	hairline("devices", "Devices"),
	hairline("coding", "Coding"),
	hairline("security", "Security"),
	hairline("connectivity", "Connectivity"),
	hairline("empty", "Empty states"),
	hairline("marks", "Marks"),
	anatomy(1, "Part 1"),
	anatomy(2, "Part 2"),
	anatomy(3, "Part 3"),
	anatomy(4, "Part 4"),
	{ key: "anatomy-webgl", engine: "anatomy-gl", title: "Anatomy collection, WebGL", summary: "The anatomy collection's ten WebGL machines, drawn by the original figures: their flame, plasma, arcs, molten steel and Cherenkov light are fragment shaders, coloured with the vpk-html tokens and its one orange accent. Click, drag or use the keys as each hint says." },
	{ key: "teardown", title: "Teardowns", summary: "Exploded views after the teardown skill: each figure is drawn taken apart along its assembly paths. Use Exploded and Assembled or the Spread slider to put it together, and point at a part to name it." },
].map(page => Object.freeze({ ...page, slug: `illustration-gallery-${page.key}`, fileName: `demo-illustration-gallery-${page.key}.html` })));

const GALLERY_CSS = `.gallery-figure {
\tdisplay: grid;
\tgap: 12px;
}

.gallery-figure + .gallery-figure {
\tborder-top: 1px solid var(--rule);
\tpadding-top: 24px;
}

.gallery-figure h2 {
\tcolor: var(--headline);
\tfont-size: 20px;
\tfont-weight: 500;
}

.gallery-figure > p {
\tcolor: var(--body-text);
\tmax-width: 72ch;
}

/* The house figcaption centres a 62ch box; under a full-width plate that leaves ragged lines, so the gallery aligns it to the plate's left edge. */
.gallery-figure figcaption {
\tmax-width: 72ch;
\ttext-align: left;
}

.gallery-pages ul {
\tdisplay: grid;
\tgap: 6px;
\tlist-style: none;
\tpadding: 0;
}

.gallery-pages a {
\tcolor: var(--headline);
}`;

const escapeText = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = text => escapeText(text).replace(/"/g, "&quot;");

const coreExamples = () => BRIEF_EXAMPLES.filter(example => !example.gallery);
const pageExamples = key => BRIEF_EXAMPLES.filter(example => example.gallery === key);
const pageCount = page => (page.engine === "hairline" ? shelfFigures(page.shelf).length : page.engine === "anatomy-gl" ? ANATOMY_GL_FIGURES.length : pageExamples(page.key).length);

// Links from one gallery page to every other one (the hub links all of them).
function galleryNav(currentSlug) {
	const links = [{ slug: GALLERY.slug, fileName: `demo-${GALLERY.slug}.html`, title: "All galleries (hub)" }, ...GALLERY_PAGES]
		.filter(page => page.slug !== currentSlug)
		.map(page => {
			const count = page.key ? ` (${pageCount(page)})` : "";
			return `\t\t\t<li><a href="${escapeAttr(page.fileName)}">${escapeText(page.title)}</a>${count}</li>`;
		});
	return `\t<nav class="gallery-pages" aria-labelledby="gallery-pages-${currentSlug}">\n\t\t<h2 id="gallery-pages-${currentSlug}">Gallery pages</h2>\n\t\t<ul>\n${links.join("\n")}\n\t\t</ul>\n\t</nav>`;
}

// Briefs carry their own figId; on a shared page each gets FIG_001..n by position (audit A9).
async function renderGalleryPage({ slug, title, summary, examples, eyebrow, nav }) {
	const { renderIsoFigure, loadBrief } = await import("./iso/build-figure.mjs");
	const { auditScene } = await import("./iso/audit.mjs");
	const { applyRuntimePipeline } = await import("./runtime/pipeline.mjs");
	const { validateHtmlString } = await import("./check-html.mjs");
	if (!examples.length) throw new Error(`${slug}: no exemplars`);
	const sections = examples.map((example, index) => {
		const brief = { ...loadBrief(path.join(__dirname, example.brief)), figId: `FIG_${String(index + 1).padStart(3, "0")}` };
		// One tab, as on a standalone page: A17 counts the SVG's bytes, indentation included, so a deeper indent
		// would push a figure that fits its budget on its own page over it here.
		const built = renderIsoFigure(brief, { indent: "\t" });
		const errors = auditScene(built.scene).filter(finding => finding.severity === "error");
		if (errors.length) throw new Error(`${slug} ${example.slug}: iso audit errors: ${errors.map(f => `${f.rule} ${f.message}`).join("; ")}`);
		return `\t<section class="gallery-figure" aria-labelledby="gallery-${example.slug}">\n\t\t<h2 id="gallery-${example.slug}">${escapeText(example.title)}</h2>\n\t\t<p>${escapeText(example.summary)}</p>\n\t\t${built.region}\n\t</section>`;
	});
	const base = illustrationPage({ slug, title, summary, figureHtml: sections.join("\n"), figureEngine: "iso-kit", eyebrow, extraCss: GALLERY_CSS, afterHtml: nav });
	const filePath = path.join(DEMOS, `demo-${slug}.html`);
	const html = applyRuntimePipeline(base, { filePath });
	const failures = validateHtmlString(html, filePath).failures;
	if (failures.length) throw new Error(`${path.relative(process.cwd(), filePath)} fails check-html:\n  - ${failures.join("\n  - ")}`);
	const errors = auditHtml(html).findings.filter(finding => finding.severity === "error");
	if (errors.length) throw new Error(`${path.relative(process.cwd(), filePath)}: iso audit errors after the pipeline: ${errors.map(f => `${f.rule} ${f.figure} ${f.message}`).join("; ")}`);
	return { filePath, html };
}

// A hairline shelf: each figure's plate (hairline/inline.mjs) in the same section frame as the iso entries. The
// page's hairline CSS goes into <head> and its runtime block before </body> ahead of the pipeline, so the registry
// blocks land after it and the enhancement block stays last (the pipeline's fixed point, --refresh-library).
async function renderHairlinePage({ slug, title, summary, shelf, eyebrow, nav }) {
	const { hairlinePlate, hairlineRuntimeBlock, hairlineStyleTag } = await import("./hairline/inline.mjs");
	const { applyRuntimePipeline } = await import("./runtime/pipeline.mjs");
	const { validateHtmlString } = await import("./check-html.mjs");
	const figures = shelfFigures(shelf);
	if (!figures.length) throw new Error(`${slug}: no hairline figures`);
	const sections = figures.map(figure => `\t<section class="gallery-figure" aria-labelledby="gallery-hl-${figure.id}">\n\t\t<h2 id="gallery-hl-${figure.id}">${escapeText(figure.title)}</h2>\n\t\t<p>${escapeText(figure.summary)}</p>\n\t\t${hairlinePlate({ id: figure.id, caption: figure.caption })}\n\t</section>`);
	const marks = figures.some(figure => figure.mark) ? "\n\t<p class=\"gallery-note\">Brands hairline likes, drawn as a tribute. The marks belong to their owners; neither hairline nor vpk-html is affiliated with them.</p>" : "";
	let base = illustrationPage({ slug, title, summary, figureHtml: sections.join("\n") + marks, figureEngine: "hairline", eyebrow, extraCss: GALLERY_CSS, afterHtml: nav });
	base = base.replace("</head>", `${hairlineStyleTag()}\n</head>`).replace("</body>", `${await hairlineRuntimeBlock(figures.map(figure => figure.id))}\n</body>`);
	const filePath = path.join(DEMOS, `demo-${slug}.html`);
	const html = applyRuntimePipeline(base, { filePath });
	const failures = validateHtmlString(html, filePath).failures;
	if (failures.length) throw new Error(`${path.relative(process.cwd(), filePath)} fails check-html:\n  - ${failures.join("\n  - ")}`);
	return { filePath, html };
}

// The anatomy collection's WebGL figures (anatomy-gl/inline.mjs): the vendored figures run as they are, each in the same
// section frame as the iso entries, with the plate CSS in <head> and the runtime block before </body>, as hairline does.
async function renderAnatomyGlPage({ slug, title, summary, eyebrow, nav }) {
	const { anatomyGlPlate, anatomyGlRuntimeBlock, anatomyGlStyleTag } = await import("./anatomy-gl/inline.mjs");
	const { applyRuntimePipeline } = await import("./runtime/pipeline.mjs");
	const { validateHtmlString } = await import("./check-html.mjs");
	const sections = ANATOMY_GL_FIGURES.map(figure => `\t<section class="gallery-figure" aria-labelledby="gallery-an-${figure.slug}">\n\t\t<h2 id="gallery-an-${figure.slug}">${escapeText(figure.title)}</h2>\n\t\t<p>${escapeText(figure.summary)}</p>\n\t\t${anatomyGlPlate({ slug: figure.slug })}\n\t</section>`);
	let base = illustrationPage({ slug, title, summary, figureHtml: sections.join("\n"), figureEngine: "anatomy-gl", eyebrow, extraCss: GALLERY_CSS, afterHtml: nav });
	base = base.replace("</head>", `${anatomyGlStyleTag()}\n</head>`).replace("</body>", `${await anatomyGlRuntimeBlock(ANATOMY_GL_FIGURES.map(figure => figure.slug))}\n</body>`);
	const filePath = path.join(DEMOS, `demo-${slug}.html`);
	const html = applyRuntimePipeline(base, { filePath });
	const failures = validateHtmlString(html, filePath).failures;
	if (failures.length) throw new Error(`${path.relative(process.cwd(), filePath)} fails check-html:\n  - ${failures.join("\n  - ")}`);
	return { filePath, html };
}

export async function renderGallery() {
	return renderGalleryPage({ slug: GALLERY.slug, title: GALLERY.title, summary: GALLERY.summary, examples: coreExamples(), eyebrow: "technical illustration · iso kit gallery", nav: galleryNav(GALLERY.slug) });
}

export async function renderGalleryPages() {
	const keys = new Set(GALLERY_PAGES.map(page => page.key));
	const orphan = BRIEF_EXAMPLES.find(example => example.gallery && !keys.has(example.gallery));
	if (orphan) throw new Error(`${orphan.slug}: unknown gallery "${orphan.gallery}"`);
	const outputs = [];
	for (const page of GALLERY_PAGES) {
		const common = { slug: page.slug, title: page.title, summary: page.summary, nav: galleryNav(page.slug) };
		outputs.push(page.engine === "hairline"
			? await renderHairlinePage({ ...common, shelf: page.shelf, eyebrow: "technical illustration · hairline gallery" })
			: page.engine === "anatomy-gl"
			? await renderAnatomyGlPage({ ...common, eyebrow: "technical illustration · anatomy WebGL gallery" })
			: await renderGalleryPage({ ...common, examples: pageExamples(page.key), eyebrow: "technical illustration · iso kit gallery" }));
	}
	return outputs;
}

/** Builds every output in memory: [{ filePath, html }]. */
export async function buildIllustrations({ legacy = false } = {}) {
	const outputs = [];
	for (const example of coreExamples()) outputs.push(...(await renderExample(example, "brief")));
	outputs.push(await renderGallery(), ...(await renderGalleryPages()));
	if (legacy) for (const example of LEGACY_EXAMPLES) outputs.push(...(await renderExample(example, "legacy")));
	return outputs;
}

export async function main(argv = process.argv.slice(2)) {
	const unknown = argv.filter(arg => !["--check", "--legacy"].includes(arg));
	if (unknown.length) {
		console.error(`unknown argument ${unknown[0]}\nUsage: build-illustrations.mjs [--check] [--legacy]`);
		return 2;
	}
	const check = argv.includes("--check");
	const legacy = argv.includes("--legacy");
	if (legacy && !check) console.warn("warn --legacy rewrites the 5 v1 exemplars from this source; the committed copies are maintained by --refresh-library and will drift (ws0 V9). Review the diff before keeping it.");
	let outputs;
	try {
		outputs = await buildIllustrations({ legacy });
	} catch (error) {
		console.error(`✗ ${error.message}`);
		return 1;
	}
	const rel = filePath => path.relative(process.cwd(), filePath);
	if (check) {
		const stale = outputs.filter(({ filePath, html }) => !fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== html);
		for (const { filePath } of stale) console.error(`✗ ${rel(filePath)} is stale (run build-illustrations.mjs, unsandboxed)`);
		if (!stale.length) console.log(`✓ ${outputs.length} illustration outputs match their source`);
		return stale.length ? 1 : 0;
	}
	fs.mkdirSync(ILLUSTRATIONS, { recursive: true });
	fs.mkdirSync(DEMOS, { recursive: true });
	for (const { filePath, html } of outputs) {
		const changed = !fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== html;
		if (changed) fs.writeFileSync(filePath, html, "utf8");
		console.log(`${changed ? "wrote" : "unchanged"} ${rel(filePath)}`);
	}
	console.log(`${BRIEF_EXAMPLES.length + (legacy ? LEGACY_EXAMPLES.length : 0)} technical illustration exemplar(s), the gallery hub and ${GALLERY_PAGES.length} gallery pages generated from ${rel(__dirname)}; finish with build.mjs --refresh-library`);
	return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main().then(code => (process.exitCode = code));
