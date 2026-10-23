# Brand Profile

An optional, offline personalization layer. When present, vpk-html documents
can adopt author/contact details and a local logo without leaving the
Algebrica editorial identity. A brand color may be recorded as customer
metadata, but the built-in identity stays grayscale unless the prompt
explicitly requests a branded override. There is no runtime; the agent reads
this profile while filling the template and bakes values into the output.

## Location

- Primary: `~/.config/vpk-html/brand.md`
- Fallback: `~/.vpk-html/brand.md`

If neither exists, render with the built-in identity: a white ADS surface, ink links,
grayscale ink chrome, grayscale figures, and no logo.

## Format

YAML frontmatter plus freeform Markdown habit notes:

```markdown
---
author: Jordan Lee
name: Jordan Lee
role: Staff Engineer
email: jordan@example.com
website: jordanlee.dev
company: Northwind
brand_color: "#6554C0"      # customer brand metadata; not applied by default
logo: ~/brand/northwind.png # local image; base64-inlined at fill time
---

# Habit notes

- Prefer plain, declarative subject lines over clever ones.
- In status reports, lead with what slipped, not what shipped.
- Never use exclamation marks in formal letters.
```

Frontmatter keys are optional. Habit notes are editorial defaults, not hard
rules.

## Precedence

Highest wins:

1. Explicit prompt for this document.
2. Editorial judgment for the genre and audience.
3. Habit notes.
4. Frontmatter.
5. Built-in default.

## How The Agent Bakes It

### Identity Substitution

Fill `{{AUTHOR}}`, `{{NAME}}`, role, email, `{{PAGE / CONTACT}}`, company, and
similar placeholders from frontmatter unless the prompt overrides them.

### Brand Color

If `brand_color` is set, keep it as customer metadata unless the prompt
explicitly asks for a customer-branded page. The default Algebrica render does
not change `--accent`; chrome stays grayscale, content links underline only on
hover/focus, and figures stay grayscale.

For an explicit branded override only, change the inline chrome alias:

```css
/* from */ --accent: #312f2f;
/* to   */ --accent: var(--ds-brand-override, #6554C0);
```

`check-html.mjs` allows only this `--ds-brand-override` fallback shape. It stays
offline and intentionally affects page chrome only. It must not rewrite
`--focal`, `--ill-*`, status tokens, links, or neutral paper/ink tokens.
Figures stay grayscale.

### Logo

If `logo:` resolves to a local image, base64-inline it as a `data:image/*` URI
in the header slot. Never emit a remote URL or local file path. If the logo is
missing or the profile is absent, render no logo.

## Verification

A document baked from a profile must still pass the full offline gate:

```bash
node .agents/skills/vpk-html/scripts/check-html.mjs artifacts/vpk-html/<slug>/<slug>.html
```
