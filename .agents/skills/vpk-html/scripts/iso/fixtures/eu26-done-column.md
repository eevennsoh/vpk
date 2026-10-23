# Done column flash (figure brief)

Draw one isometric explainer figure: a column of finished cards with a flash ring that spreads from its foot.

## Subject

A work-tracking board has a "Done" column holding 23 cards. At the moment the flash plays, the column is a long narrow tray. Four of its cards are shown, stacked along the tray's length with a small gap between them. Each card is a thin rectangle with three details drawn on its top face: a cover line along the top, a shorter title bar below it and a small dot at the lower right. A bright ring is centred at the foot of the column and expands outward; it is clipped to the tray's top, and the figure shows the moment it clears the top edge of the column (0.53 s after the flash starts). The cards are tossed out of the column a little later, at 0.62 s.

## Geometry (arbitrary world units; scale it to fit)

- The tray is 60 wide, 150 long and 6 tall, with a thin floor and low walls.
- Four cards, each 50 wide, 32 long and 2.4 thick, lie in the tray at 8 + 36 x (card number - 1) along its length.
- The ring is a flat disc of radius 171.3 (about 1.14 x the column length) centred on the foot of the column. It is clipped to a window 28 units wider than the tray on every side (`clipPad`), so the figure shows the flash washing the ground around the column and the ring's edge crossing it just past the column's top end. The ring is the figure's focal part: the eye should land on it first, and its edge must be visible at rest (the first version clipped it to the tray top, which removed the whole edge).
- Show the radius-over-time graph as a separate flat chart if you need it; do not draw it into the isometric scene.

## Labels (exactly these four, plus one dimension)

1. DONE COLUMN: the tray
2. CARD · 1 OF 23: the first card
3. FLASH RING: the ring
4. RING CLEARS TOP · 0.53 S: the ring, at the moment it clears the top
- A dimension along the length of the column reading TOSS · 0.62 S.

## Motion and interaction

- On entry the figure assembles: the tray first, then cards 1 and 2 together, then cards 3 and 4 together, then the ring.
- The pointer interaction is an explode: moving over the figure lifts the cards out of the tray (a slider-like gap that returns to its resting value when the pointer leaves). Under reduced motion nothing moves and the figure is the still, fully assembled art.
- The figure must also print in its assembled pose.

## Constraints

Stay grayscale (the document's own tokens only), keep text legible on a 390 px wide screen, and make the figure readable without relying on motion. One caption below the figure states the insight (the ring has cleared the top before the toss) and does not repeat the title.
