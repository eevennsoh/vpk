# Mega-bento wall (figure brief)

Draw one isometric explainer figure of a wall of tiles lying flat on the ground plane, with the title tile as its focal point.

## Subject

A wide wall of tiles glides sideways past a fixed set of reserved landing gaps. The figure shows a single 1920 x 1080 window of the wall, plus the first of the three lanyard tiles that hangs just past the right-hand edge. The window holds 35 flat parts (28 tiles and the seven gap outlines):

- one title tile in the middle (the focal part);
- seven landing gaps drawn as dashed outlines: six empty ones, three above and three below the title tile, and the seventh, the title tile's own, a dashed outline drawn 2 units outside the tile so the tile sits in it (the wall has 7 landing gaps in all, and the figure shows all seven);
- 14 Stage Kit piece tiles, 10 card print tiles, a poster tile and a strip tile;
- one lanyard tile hanging from the top edge, past the right-hand side of the window.

The whole wall holds 91 Stage Kit pieces, 25 card prints and 3 lanyards, glides at 80.6 px per second and repeats every 11,264 px.

## Geometry (arbitrary world units; scale it to fit)

All tiles are flat rectangles about 1 unit thick (the title tile 2) on the ground plane, at 0.1 world units per source pixel, so the window is 192 x 108 units. Positions come straight from the wall's packing, listed here as x, y, width, depth in units (the tile list is in the table below).

| id | tile | x | y | width | depth |
| --- | --- | --- | --- | --- | --- |
| gap-1 | landing gap (outline) | 24.5 | 20.8 | 17.6 | 14.4 |
| gap-2 | landing gap (outline) | 149.9 | 20.8 | 17.6 | 14.4 |
| gap-3 | landing gap (outline) | 87.2 | 16.6 | 17.6 | 10.8 |
| gap-4 | landing gap (outline) | 24.5 | 72.8 | 17.6 | 14.4 |
| gap-5 | landing gap (outline) | 149.9 | 72.8 | 17.6 | 14.4 |
| gap-6 | landing gap (outline) | 87.2 | 80.6 | 17.6 | 10.8 |
| gap-7 | landing gap (outline, the title tile's own, 2 units larger than the tile on every side) | 62.2 | 45.8 | 21.6 | 16.4 |
| title | Title tile | 64.2 | 47.8 | 17.6 | 12.4 |
| piece-1 | Stage kit piece 1 | 2.8 | 2.8 | 51.4 | 9.4 |
| print-1 | Card print 1 | 2.8 | 38 | 26 | 14 |
| piece-2 | Stage kit piece 2 | 44.9 | 15 | 37 | 22.9 |
| print-2 | Card print 2 | 2.8 | 54.8 | 26 | 14 |
| piece-3 | Stage kit piece 3 | 44.9 | 63 | 37.8 | 21.3 |
| print-3 | Card print 3 | 2.8 | 90 | 26 | 14 |
| piece-4 | Stage kit piece 4 | 31.6 | 90 | 36.3 | 10.8 |
| print-4 | Card print 4 | 31.6 | 40.6 | 26 | 14 |
| piece-5 | Stage kit piece 5 | 85.6 | 30.2 | 22.7 | 30.3 |
| print-5 | Card print 5 | 85.6 | 63.3 | 26 | 14 |
| piece-6 | Stage kit piece 6 | 111.1 | 38 | 46.4 | 17.6 |
| print-6 | Card print 6 | 107.6 | 2.8 | 26 | 14 |
| piece-7 | Stage kit piece 7 | 2.8 | 15 | 14.1 | 14.1 |
| print-7 | Card print 7 | 107.6 | 80.1 | 26 | 14 |
| piece-8 | Stage kit piece 8 | 2.8 | 71.6 | 11.9 | 11.9 |
| print-8 | Card print 8 | 111.1 | 19.6 | 26 | 14 |
| piece-9 | Stage kit piece 9 | 170.3 | 48.8 | 43.7 | 29.6 |
| poster-1 | Poster 1 | 114.4 | 58.4 | 30 | 16 |
| print-9 | Card print 9 | 136.4 | 2.8 | 26 | 14 |
| piece-10 | Stage kit piece 10 | 136.4 | 90 | 37.7 | 12.8 |
| print-10 | Card print 10 | 165.2 | 2.8 | 26 | 14 |
| piece-11 | Stage kit piece 11 | 170.3 | 19.6 | 20.7 | 21.6 |
| piece-12 | Stage kit piece 12 | 176.9 | 81.2 | 14.1 | 14.1 |
| piece-13 | Stage kit piece 13 | 70.7 | 87.1 | 11.9 | 11.9 |
| strip | Strip tile | 57 | 2.8 | 33 | 6.5 |
| piece-14 | Stage kit piece 14 | 147.2 | 58.4 | 19.8 | 10 |
| lanyard-1 | Lanyard 1 | 194.8 | -2 | 36 | 48 |

## Labels (exactly these six)

1. 7 LANDING GAPS: one of the empty gaps
2. STAGE KIT PIECE · 91: one Stage Kit piece tile
3. CARD PRINT · 25: one card print tile
4. LANYARD · 3: the lanyard tile
5. GLIDE ← 80.6 PX/S: the Stage Kit piece 10 tile at the front edge of the wall, beside a leftward arrow along that edge
6. PERIOD 11,264 PX: the strip tile

## Motion and interaction

- On entry the wall assembles from the middle out in six bands by distance from the title tile (the title first, then five bands of the remaining tiles).
- The pointer interaction is select: hovering a tile lifts it slightly and shows its name in a readout; leaving puts it back. The keyboard can step through the tiles. Under reduced motion nothing moves and the figure is the still, fully assembled art.
- The figure must also print in its assembled pose.

## Constraints

Stay grayscale (the document's own tokens only), keep text legible on a 390 px wide screen, and make the figure readable without relying on motion. One caption below the figure states the insight (the gaps stay reserved while the wall glides past them) and does not repeat the title.
