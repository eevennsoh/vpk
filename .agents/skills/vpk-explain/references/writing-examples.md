# Worked clarity examples

These original examples exercise the adapted writing guidance. They are not
official ASD examples or certified dictionary-compliant rewrites.

## A condition controls an action

Original: “The agent will attempt to delete temporary files if the export has
completed, unless the user has requested that they should be retained.”

Revision: “If the export has completed, the agent tries to delete temporary
files. It keeps those files if the user requested this.”

The revision keeps both the export condition and the retention exception.
“Tries” preserves the absence of a guarantee that deletion succeeds.

## Confidence and requirement strength

Original: “The request may have failed because the token expired. The caller
must check the token before retrying.”

Revision: “The request may have failed because the token expired. The caller
must check the token before it retries.”

Keep “may have” and “must.” Do not claim that token expiration is the confirmed
cause or make the required check optional. A style change should not change
what the reader believes or what the reader must do.

## Technical names with different meanings

Keep: “Check the file size. Verify the digital signature.”

These actions inspect different properties. A blanket replacement of every
“verify” with “check” can hide a useful distinction. Consistent terminology
requires understanding the actions before deciding whether they are synonyms.

## Teaching goes beyond rewriting

Source: “A cache can reuse a stored response.”

Rewrite: “A cache can return a response it stored earlier.”

Explanation: “A cache can return a response it stored earlier. For example,
a simulated cache might keep the answer to a repeated lookup. In that example,
the second request can use the stored answer. Real systems also need rules
for expiration and updates.”

The explanation adds a labeled example and boundaries. Those additions help
teach the concept. They do not belong in a request to rewrite the source alone.
