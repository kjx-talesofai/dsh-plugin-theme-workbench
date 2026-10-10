# Readability, consistency and mode-adaptation audit

One-off audit of the plugin's five palettes against the CSS that DSH 0.2.0-rc.2
actually ships. Reproduce it with:

```sh
node tools/audit-contrast.mjs                     # this machine's install
node tools/audit-contrast.mjs /path/to/app.asar    # any other one
```

It is dev-only — it needs the archive, so CI does not run it — and `tools/` is
excluded from the tarball by the existing pack guard.

## What was measured

Every rule in the archive that declares **both** a background and a `color`, with
`var()` chains and `color-mix()` resolved through (a) the shipped palette and
(b) each of the ten palettes. Contrast is WCAG 2.1; the floor is 3.0 for large
text and 4.5 otherwise, taken from the rule's own `font-size`/`font-weight`.

| | |
|---|---|
| entries scanned | 106 (every `.css` file, plus the stylesheet inlined in each `dsh-client-*` bundle) |
| rules with both a background and a color | 454 |
| measured | 207 |
| skipped as shape (a gradient, `url()`, `none`, or a `background: 0 0` reset) | 221 |
| skipped because a colour did not resolve | 26, across 18 values — the largest are `--dsw-alias-code-diff-added/-deleted`, `--dsl-code-block-background`, `--dsw-alias-bg-layer-4`, `--card-fill`, `--changes-fill`, `--deliverable-fill` |

Two limits are load-bearing, and both are the reason `npm test` is not redundant:

- **A rule that paints text over an *inherited* background is invisible here.**
  The audit sees only same-rule pairs. The test suite covers that case for the
  token matrix, where the pairing is known.
- **Coverage is bounded, not implied.** The counts above are printed on every run
  so a shrinking rule set cannot pass silently. That is not hypothetical: while
  writing this tool a rewrite dropped 3-digit hex support, which removed `#fff`
  from the resolvable set and made section A report a false all-clear. Printing
  the unresolved values is what caught it.

## Results

**The headline.** Of the 1,820 pair-instances where the shipped palette reaches
4.5:1, **zero** are below 4.5 under any of the five themes, in either mode. The
theme is never the reason something became unreadable.

**Cross-theme consistency.** Zero instances where one theme falls below its floor
while the others clear it. The five palettes differ in *character* — `calm`'s ink
is the softest — and that shows up as a ratio spread, but never as one theme
missing a floor the rest hold.

**Section A: degraded past the palette's own softness — 1 finding.** The warm
palettes are deliberately lower-contrast than the shipped cool one (on the page,
the shipped primary ink reaches 18.90:1 where `calm`'s reaches 11.24:1), so a raw
ratio comparison flags the entire design. Section A normalises for that first and
reports only pairs that degrade *more* than the general softness predicts. One
pair does:

| | |
|---|---|
| rule | `.OnRn_q_removeFailed` (ui-attachment) |
| paints | `background: var(--dsw-alias-state-error-primary, #d54941)`, `color: #fff` |
| it is | the remove/retry button on a failed file card, whose content is an **icon** |
| dark mode | **2.32:1** under every theme (shipped: 3.29:1) |

An icon needs 3:1, so this one is genuinely below the bar, and it is the single
place where the theme is worse than the shipped palette on a real painted pair.

The cause is structural, not a typo. `--dsw-alias-state-error-primary` is a fixed
value per mode (`#f0908a` in dark) with **two incompatible roles**: it is the
colour error *text* is drawn in, and it is the fill under a hardcoded white icon.
Measured, both ways:

| pair, dark mode | at `#f0908a` | at the lightest red that reaches 3:1 on white (`#d17d78`) |
|---|---|---|
| white icon on the fill (`.OnRn_q_removeFailed`) — needs 3.0 | 2.32 | **3.04** |
| `bg-layer-3` text on the fill (`.FfBBxq_brokenBadge`) — needs 4.5 | 5.11–6.21 | **3.90–4.74, below 4.5 in four of five themes** |
| error text on a `bg-layer-2` card — needs 4.5 | 4.61–6.88 | **4.39–5.25, below 4.5 in two** |
| error text on the page — needs 4.5 | 7.48–8.34 | 5.71–6.36 |

Fixing the icon costs a pair that currently passes. A real fix is either upstream
(the button should not hardcode `#fff`) or a CSS override of another component's
hashed class, which this plugin deliberately does not do — so this one is **left
open and reported** rather than traded away silently.

**Sections B and C: nothing.** No pair is below 3:1 where the shipped palette is
comfortable, and no theme is an outlier against its siblings.

## Fixed as a result

The audit's first run found the defect that the `v0.1.1` badge fix was a special
case of: **wash tokens derived from a fixed fraction instead of solved.**

- `state-success-tertiary` — 4.21–4.48:1 under every theme in light mode
  (`state-success-primary` on it, `.success` in the connection indicator).
- `state-warn-tertiary` — 4.43:1 under `novel` (`state-warn-label` on it,
  `.warning`).

Both, plus `state-business-tertiary`, are now solved by `wash()` against **every**
colour drawn on them, each enumerated from the archive (`.gOeFyG_strip`,
`.ZVcBiW_installSafety`, `.rkta1W_contextGreen`, and the rest). The binding text
differs by mode, which is exactly what a per-text solve gets wrong. Worst pair
across all ten palettes: **4.60:1**, against a 4.5 floor and a solve target a hair
above it so 8-bit rounding cannot land under.

## Not covered

- Gradients, `url()` assets and translucent veils over vibrancy: the archive gives
  no single effective colour to measure. The macOS sidebar is the biggest of these
  and is documented in `surface-map.md`.
- The 26 unresolved values above.
- Anything the archive cannot express statically: which surface a text element
  actually inherits, and the compositor's own treatment of `backdrop-filter`.
