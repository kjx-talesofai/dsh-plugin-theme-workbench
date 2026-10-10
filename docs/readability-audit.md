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
| entries scanned | 6,141 (every `.css` file, plus every `.js` file — 49 of them carry an inlined stylesheet) |
| rules with both a background and a color | 482 |
| measured | 215 |
| skipped as shape (a gradient, `url()`, `none`, or a `background: 0 0` reset) | 235 |
| skipped because a colour did not resolve | 32, across 23 values — the largest are `--dsw-alias-code-diff-added/-deleted`, `--dsl-code-block-background`, `--dsw-alias-bg-layer-4`, `--card-fill`, `--changes-fill`, `--deliverable-fill` |

Two limits are load-bearing, and both are the reason `npm test` is not redundant:

- **A rule that paints text over an *inherited* background is invisible here.**
  The audit sees only same-rule pairs. The test suite covers that case for the
  token matrix, where the pairing is known.
- **Coverage is bounded, not implied.** The counts above are printed on every run
  so a shrinking rule set cannot pass silently. That is not hypothetical. Two
  separate defects in this tool were caught by its own coverage lines:

  1. A rewrite dropped 3-digit hex support, which removed `#fff` from the
     resolvable set and made section A report a **false all-clear**. The
     unresolved-value list is what gave it away.
  2. Comments were not stripped. A prose sentence in `Menu.module.css` that
     happens to contain a brace pair parsed as a *rule*, and — worse — a comment
     containing a brace truncated the block after it. Stripping them **raised**
     the measured count from 207 to 210, because 13 rules had been mis-split.
     Line counts that can only go up for a good reason are worth printing.
  3. **The corpus was chosen by path, which is a guess.** The filter
     `dsh-client-<pkg>/lib/client.js` missed `client.excel.js`,
     `client.terminal.js`, `client.pdf.js`, both `dsh-experimental-*` bundles and
     `dsh-session-log-export` — six stylesheet carriers. A parallel audit built its
     own extractor and found the hole. The corpus is now selected by **content**,
     which costs 0.2 s and takes the measured count 210 → 215. The conclusions did
     not move (A: the same single finding; D: still 0), but a rule set that depends
     on guessing a filename is not a coverage claim.

## Results

**The headline.** Of the 1,895 pair-instances where the shipped palette reaches
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

**Section E: the shape of the problem.** Of the 213 `--dsw-*` tokens the CSS
carriers read, **25 are asked to be both a fill and an ink colour**, and this plugin
writes 22 of them. (Counted across every declaration, including reads inside other
custom-property definitions — counting only fill/ink properties calls 29 written
names dead instead of the true 18, because that is where the neutral ramp is
consumed.) Of the 108 names this palette writes, 18 are never read by anything, 4
of them ramp steps. That is the structure every defect here has had — one token, two jobs,
and in dark mode the two jobs want opposite luminance:

| token | as a fill | as an ink colour |
|---|---|---|
| `state-error-primary` | `.OnRn_q_removeFailed` (white icon on it) | `.FfBBxq_cardBroken` (error text) |
| `button-info-fill` | `.yhfFVG_primary` (white icon on it) | `.y21zpG_badge` (the Recommended chip) |
| `state-success/-warn/-business-primary` | washes and focus rings | the state's own text |

Both of the findings above are rows in that table, and the `v0.1.1` badge fix was
the third. The census cannot say whether a given pair is satisfiable — sections A
to C do that — but it names the risk set, which is what a reader needs to know
where to look next.

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

## What no custom property can paint

Everything above is about colours this palette *chooses*. These are the places it
has no say, all verified against the archive rather than inferred.

| finding | evidence | consequence |
|---|---|---|
| **The spreadsheet preview has no dark mode** | `sidebar-documentpreview/lib/client.excel.js` (7.0 MB): `.fortune-container{background-color:#fff…}` and **zero** `data-ds-dark-theme` or `prefers-color-scheme` selectors in the whole bundle | a full white application in the right-hand panel while the rest of the app is dark. Third-party (fortune-sheet) literals — **233** colour declarations (64 of them `#fff`, 165 distinct hex values; counted by property name in the bundle) — so no token layer can reach it |
| `--dsw-hovercard-bg` is component-scoped | declared only on the card: `HoverCard.module.css .card{--dsw-hovercard-bg:#2C2C2E}`, and the compiled `._card_38jqx_9`; never declared at `body` or `:root` | an inline `body` write can never win. The card is dark in **both** modes — deliberate-looking, since the inks on it (`.jJkEga_hoverTitle`, `.GY4FdW_taskName`) are white — so this is a coverage gap, not a defect |
| `--dsw-focus-ring-color` is component-scoped | `html[data-input-modality=pointer] body :focus-visible:not(:read-write){--dsw-focus-ring-color:transparent}` — its only declaration | in pointer modality the ring is transparent *by design*; keyboard focus never matches that selector, so the outline falls back to `--dsw-alias-state-business-primary` and **is** themed |
| Elevation has no dark recipe upstream | `--dsw-shadow-lv1/2/3` and `--dsw-elevation-soft` carry black alphas with no `body[data-ds-dark-theme]` twin; `--dsw-elevation-*` are additionally a `body,body *` trap | dark surfaces get no lift. Inherited, not introduced here — the shipped dark palette has the same problem |
| **The onboarding flow is the one sizeable surface left entirely on the shipped cool palette** | `--dsw-alias-onboarding-card-fill`, `-secondary-fill`, `-accent` and `--dsw-gradient-onboarding-{violet,blue,cyan}-stops`; the two *fills* do have a dark twin (`#2c2c2e` 80 %, `#48494c`), the accent and all three gradient stop-sets have exactly **one** declaration each; this palette writes none of them | a cold grey card and a blue-violet accent ring on warm paper, in a theme whose whole point is warm paper. Unlike the rows above this one is **reachable** — they are `body`-level tokens — so it is a coverage decision, not an impossibility |

### Checked and rejected

Two claims from parallel audits of the same archive did not survive verification,
and are recorded so they are not re-derived:

- **"The terminal is always black."** `.xterm-viewport{cursor:default;background-color:#000;…}`
  is followed in the same sheet by `.xterm-viewport{background:var(--dsw-alias-bg-base)}`,
  which wins on source order. The terminal follows the theme. Only the IME
  `composition-view` keeps a black background, and it is `display:none` until a
  composition starts.
- **"The test allowlist lists ten names that are declared nowhere."** It does not;
  none of those names appears in `tests/plugin.test.mjs`. (The *un*declared names
  are real — `--dsw-alias-fill-tertiary`, `-separator-primary`, `-label-error` and
  seven others are consumed but declared nowhere in the archive, so they are
  invalid at computed-value time and paint nothing. They are shipped gaps, not
  cold patches, and the allowlist was already correct about them.)

## Not covered

- Gradients, `url()` assets and translucent veils over vibrancy: the archive gives
  no single effective colour to measure. The macOS sidebar is the biggest of these
  and is documented in `surface-map.md`.
- The 26 unresolved values above.
- Anything the archive cannot express statically: which surface a text element
  actually inherits, and the compositor's own treatment of `backdrop-filter`.
