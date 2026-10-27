// hairline/figures — the 36 hairline figures the gallery shows, by shelf, in the site's order
// (hairline.lucasmarkes.com/figures). `title` and `summary` are the site's name and summary for the figure; the
// `caption` says what the figure shows. Thirty-three figures are the package's (`vendor/packages/hairline/src`);
// the three `mark` figures are the site's Marks shelf, the hairline-create pages in
// `vendor/apps/site/public/skill/hairline-<id>.html`. The marks are tributes: the marks belong to their owners,
// and neither hairline nor vpk-html is affiliated with them.

export const HAIRLINE_SHELVES = Object.freeze([
	["interfaces", "Interfaces"],
	["data", "Data"],
	["machines", "Machines"],
	["devices", "Devices"],
	["coding", "Coding"],
	["security", "Security"],
	["connectivity", "Connectivity"],
	["empty", "Empty states"],
	["marks", "Marks"],
]);

const figure = (shelf, id, title, summary, caption, mark = false) => Object.freeze({ shelf, id, title, summary, caption, mark });

export const HAIRLINE_FIGURES = Object.freeze([
	figure("interfaces", "exploded", "Exploded", "An app window taken apart into four layers. Moving across opens the gap; moving down picks a layer.", "A screen is a stack: open the gap and the button you click turns out to sit layers above the window that holds it."),
	figure("data", "terrain", "Terrain", "Eighty-one pillars on a plinth. They rise around the pointer and settle back into a dune with two rises.", "Each pillar is one value: read together, their heights become a surface, and the dune with two rises is visible before any number is."),
	figure("data", "phosphor", "Phosphor", "A seven by seven dot matrix playing a loop. Where the pointer paints, the dots fade like phosphor.", "A dot matrix keeps a little of where it has been: painted dots fade step by step, so the trail shows the path as well as the place."),
	figure("data", "riffle", "Riffle", "A tray of eight cards. The card under the pointer stands up and its neighbours lean after it. The arrow keys walk the cards.", "Eight cards keep their order in one tray; pulling one stands it up clear of its neighbours, so it can be read without losing its place."),
	figure("machines", "slow", "Slow", "Crates riding a belt through a gate. Hovering slows the clock without stopping it.", "The gate sets the clock: slowing it stretches every crate's passage, but the belt never stops."),
	figure("machines", "turntable", "Turntable", "Blocks on a turntable. A flick across it spins it, and it settles on the nearest quarter turn.", "Everything on the platter turns as one; a flick spins it, and it always comes to rest on the nearest quarter turn."),
	figure("machines", "elevator", "Elevator", "Four floors with the shaft open and the car inside. The pointer's height picks the floor; the car travels there.", "Pick a floor and the car travels up or down the open shaft to meet it, passing the floors between; the landings stay still."),
	figure("devices", "keyboard", "Keyboard", "Sixty keys in a block. The key under the pointer sinks and its neighbours follow it down, less the further away.", "A press is not one key: the key under the pointer sinks furthest and its neighbours follow it down, less the further away."),
	figure("devices", "phone", "Phone", "A phone in layers: glass, board, battery, shell. Moving across opens the gap; moving down picks a layer.", "Open the phone and the layers stack in the order they are built: shell, battery, board, then the glass that closes it."),
	figure("devices", "laptop", "Laptop", "A thin laptop, open on its hinge. The pointer's height sets the lid; it follows on a spring.", "Everything hangs off one hinge: the base stays put and the thin lid, with the display, swings on it."),
	figure("coding", "terminal", "Terminal", "A terminal window with its history in rows. The pointer's height scrolls back; the line under it lifts and its neighbours follow.", "History is a stack of rows: the pointer scrolls back through it, and the row under it lifts off the screen while the prompt stays put."),
	figure("coding", "cabinet", "Cabinet", "A rack of twelve blades, a few half out. The pointer's height pulls the nearest ones out, the farther the less.", "Reach for one blade and its neighbours come with it, less the further they sit: the pull falls off with distance from the blade you pick."),
	figure("coding", "branches", "Branches", "A commit graph with a branch forking off main and merging back. The commit under the pointer rises, and its history rises after it.", "A commit carries its history: raise one and every commit it came from rises after it, the further back the less."),
	figure("coding", "format", "Format", "A file of ten crooked lines. The pointer runs the formatter down it, and every line above snaps square.", "The formatter only ever works one line at a time: everything it has passed sits square on its indent, everything ahead of it is still crooked."),
	figure("coding", "rebuild", "Rebuild", "A tree of packages. The one under the pointer rises, and every package that depends on it rises after it.", "Change one package and only what depends on it rebuilds: it rises, then every package downstream rises after it along the links."),
	figure("coding", "stack", "Stack", "A call stack of five frames. The pointer's height picks one, and the frames above lift away to open it.", "Each call sits on the one that made it; to read a frame you lift every newer call off it, and only the top one can return."),
	figure("security", "vault", "Vault", "A vault door with a dial and three bolts. The pointer turns the dial; detents catch every ten, and on the combination the bolts draw back.", "Turn the dial to the combination and all three bolts draw back out of their keepers together; until then the door stays shut."),
	figure("security", "lockers", "Lockers", "A bank of twelve lockers, one ajar at rest. The locker under the pointer opens; the one at rest closes.", "Only one locker stands open at a time: open another and the one that was ajar swings shut."),
	figure("security", "padlock", "Padlock", "A padlock with its shackle in. As the pointer comes near the shackle lifts out and swings open.", "Come near and the shackle rises: the long leg keeps hold of the body, and only the free leg clears its socket, which is all that unlocking has to do."),
	figure("connectivity", "patch", "Patch", "A patch panel of twenty-four ports with cables. The cable under the pointer lifts and its neighbours lean away.", "Every cable plugs into one port; lift one and its neighbours lean away, so you can trace which port it serves."),
	figure("connectivity", "dish", "Dish", "A parabolic dish on a two-axis gimbal. The pointer aims the dish; it follows on a spring.", "Two axes are enough to aim anywhere: the turntable sets the heading, the pivots on the yoke set the elevation, and the dish follows."),
	figure("connectivity", "router", "Router", "A router with its antennas up. Each antenna leans toward the pointer, the nearest most.", "The box only routes; the antennas carry the signal, and each leans toward where the client is, the nearest most."),
	figure("connectivity", "hub", "Hub", "A hub with eight tiles around it on dashed links. The tile under the pointer rises and its link turns solid.", "One hub, eight tiles: the tile you point at rises and its link turns solid, while its neighbours rise less."),
	figure("connectivity", "relay", "Relay", "A hub with four branches of tiles. The path to the leaf under the pointer lights hop by hop.", "Nothing reaches a leaf directly: a message leaves the hub and lights each tile on its branch in turn before the last hop out to the leaf."),
	figure("connectivity", "settle", "Settle", "Twelve tiles lie crooked round a hub. As the pointer nears it, they slide into a tree and the links draw in.", "Loose tiles become a tree: as the pointer nears the hub they slide into place and the links between them draw in."),
	figure("empty", "loupe", "Loupe", "A stand loupe on a blank ruled sheet. The pointer drags it across; the rules pass enlarged under the glass, with nothing between them.", "The glass adds nothing: the lines it shows are the same blank rules on the sheet below, only drawn wider apart."),
	figure("empty", "sieve", "Sieve", "Three test sieves stacked over a pan. The pointer's height picks one; it rises clear of the stack, and every mesh is bare.", "Each sieve keeps what its mesh cannot pass and hands the rest down; lift one clear of the stack and its mesh is bare."),
	figure("empty", "rail", "Rail", "A garment rail with seven bare hangers. The pointer brushes them; each rocks away, the nearest most, and settles.", "Brush the rail and the hangers rock away from the hand, the nearest most, then settle back on the bar."),
	figure("empty", "plug", "Plug", "A wall socket, and a plug lying on the floor at the end of its cord. The pointer draws the plug up toward the socket; it stops short, and falls back.", "Nothing is connected yet: the pointer draws the plug up toward the socket, but it stops short of the holes and drops back to the floor."),
	figure("empty", "query", "Query", "A question mark built as a bent bar over a loose ball. The hook turns toward the pointer, and the ball rolls after it.", "The hook is only a bent bar; the question comes from the loose ball below it, which rolls whichever way the hook turns."),
	figure("empty", "drawer", "Drawer", "A cabinet of three drawers. The pointer's height picks one; it slides out and shows two dividers with nothing between them.", "Pull a drawer and it comes out empty: two dividers mark out three compartments, and the further it opens the more of that nothing you see."),
	figure("empty", "basket", "Basket", "A wire basket under a bail handle. It tilts toward the pointer and shows its bare floor; the handle swings after it.", "An empty state is a container with nothing in it: tilt the basket and the bare floor is all there is to see."),
	figure("empty", "plot", "Plot", "A bar chart with seven flat tabs where the bars would stand. The pointer brushes them; each lifts a little and drops back to zero.", "With no data the chart keeps its shape: seven tabs mark where bars would stand, and each one lifts only a little before dropping back to zero."),
	figure("marks", "vercel", "Vercel", "“No deployments yet.” The triangle hovers over its pad. The nearer the pointer, the lower it settles, until it seats.", "Nothing is deployed yet: the triangle waits over its empty slot, and only comes down to seat when the pointer is close.", true),
	figure("marks", "mastra", "Mastra", "“No agents connected.” The spheres of the mark, joined, and one apart. The pointer draws it in; a neck forms, stretches and lets go.", "No agent is connected: the lone sphere can be drawn toward the others, but the neck that forms only stretches and lets go.", true),
	figure("marks", "notion", "Notion", "“No pages inside.” The cube as a box. The pointer's height opens its lid, and the box is empty.", "The box is empty: lifting the lid shows there are no pages inside.", true),
]);

export const shelfFigures = shelf => HAIRLINE_FIGURES.filter(entry => entry.shelf === shelf);
