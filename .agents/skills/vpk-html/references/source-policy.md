# Source policy

Owner of source handling for [SKILL.md](../SKILL.md). Load when you write any visible word or source.

## Decide by who supplied the claim

Where a claim came from decides whether you verify it. The first matching row wins.

| The claim is… | Do | Never |
| --- | --- | --- |
| In the user’s material, and the user asked only to render it | Render it exactly as given, numbers and names unchanged | Browse to check it, “correct” it or add a figure the material lacks |
| In the user’s material, but the user asked you to check or update it | Verify it against a primary source and cite that source | Change it silently; show the old and new value |
| Added by you (a current fact, a product, company, person or version detail, a price, a release date, a “latest” or “recent” claim) | Verify it against a primary source before rendering, and cite it | Render it from memory |
| Something the user asked you to research | Verify it against a primary source and cite it | Fill a gap with an inference |

A primary source is the vendor’s own docs, filing, release notes or the user’s own repository; a blog summary is not one.

GOOD: eval 1 supplies “proposed annual price $228,000” and asks for a render, so the page shows $228,000 as given and makes no network call.

BAD: the same page adds “about 6% above the market price for 240 seats”, a figure inferred from memory that the material never states. Leave it out, or write `[DATA NEEDED: market price for 240 seats]`.

## Budget the check, then mark the gap

Spend at most 5 minutes, or 3 searches, on any one claim. Then act on what you found:

| You found | Do |
| --- | --- |
| One primary source that settles it | Render the claim and list the source in a visible Sources section |
| Sources that conflict, or nothing within the budget | Spend the one question of [contract § Question budget](contract.md#question-budget) on it, or mark the claim `[DATA NEEDED: …]` |
| Third-party material you copied or adapted | Render a visible Credits section |

Metadata comments may include template name, vpk-html version, render timestamp, and source labels or basenames. They must not include absolute source file paths by default.
