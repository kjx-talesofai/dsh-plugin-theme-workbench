# Warm-paper ("米白" / cream / sepia) theme specification

**Status:** research + prescriptive spec. Written for direct translation into hex design tokens.
**Scope:** the DSH desktop chat UI — canvas, sidebar, raised cards/panels, **composer**, user bubble
vs assistant transcript, code blocks, hairlines, scrollbars, toasts, tooltips, text tiers, links,
focus ring, semantic states. Light **and** dark for every theme.
**Audience:** an engineer implementing `--dsw-*` overrides in
[`dsh-plugin-theme-workbench/client.js`](../client.js). No design training assumed.

---

## 0. Provenance and how to read this

Every hex that is **not** mine is labelled with the file I read it from, and the URL is in §2. Every
number I derived is marked **`[computed]`** and the method is stated. Nothing here is presented as an
official token unless it is one.

| tag | meaning |
| --- | --- |
| *(cited)* | read verbatim out of an official token file / palette source. URL in §2. |
| **`[computed]`** | I derived it: OKLCH/CIE-L\* conversion, WCAG contrast, sRGB gamut search, or an alpha composite. Reproducible from the appendices. |
| *(derived)* | I sampled or reconstructed it from a non-token source (screenshot, third-party doc). Lower confidence; flagged inline. |
| **`not published`** | I could not find a primary source. I say so rather than invent one. |

Colour maths used throughout:

* **L\*** = CIE L\* (D65, sRGB primaries, from Y). *This is the same L\* that Material 3 calls the
  "tone" in HCT.* So "M3 tone 94" and "L\* 94" are the same axis, which is why §3 can compare
  M3's ladder to Solarized's directly.
* **`oklch(L% C H)`** = OKLCH, computed from sRGB with the standard matrices.
* **contrast** = WCAG 2.1 relative-luminance ratio `(Y₁+0.05)/(Y₂+0.05)`.
* **gamut ceiling** = the largest OKLCH chroma at a given `(L, H)` that still round-trips inside
  `[0,255]³` in sRGB. Computed by bisection (40 iterations). This is the number that tells you when
  a "warm surface" has physically stopped being warm.

---

## 1. Rules I must follow

The implementable contract. Numbers, not principles.

### 1.1 The eleven hard rules

**R1 — Never mix a surface toward `#ffffff`.**
White has OKLCH chroma 0, so `mix(canvas, white, w)` multiplies the canvas chroma by `(1−w)`.
The workbench's `up(0.85)` therefore retains **13.4 %** of the cream canvas's warmth:

| call | result | L\* | OKLCH C | chroma retained |
| --- | --- | --- | --- | --- |
| cream canvas `#f7f3ea` | — | 95.9 | 0.0127 | 100 % |
| `up(0.55)` (card) | `#fbfaf6` | 98.2 | 0.0054 | 42.5 % |
| `up(0.72)` (higher) | `#fdfcf9` | 99.0 | 0.0041 | 32.3 % |
| `up(0.85)` (**composer**) | `#fefdfc` | 99.4 | 0.0017 | **13.4 %** |

**`[computed]`** Reproduce with `mix(seeds.canvas, '#ffffff', w)` then `oklch()`.

Instead, **re-sample**: keep the canvas hue, set a new L\*, and scale chroma by an explicit factor.
`resample(canvas, ΔL*, k) = oklch(canvas.L + ΔL*, canvas.C × k, canvas.H)`.

**R2 — In light mode, content-adjacent surfaces are DARKER than the canvas.**
Sidebar, cards, panels, **composer**, code blocks, bubbles, nested surfaces: step **down** in L\*.
Every serious paper-like theme does this (evidence in §3.1). Never paint a light-mode card lighter
than its canvas.

**R3 — Only floating surfaces may be LIGHTER, and then only within limits.**
Menus, popovers, dialogs, tooltips, dropdowns may sit above the canvas. Their ceiling is
**L\* ≤ 98.5**, and their chroma must be **≥ 0.90 × the canvas chroma**. If you cannot satisfy both,
make the popover the same L\* as the canvas and let the hairline + shadow carry the elevation.

**R4 — No warm neutral above L\* 98.5; no warm neutral below OKLCH C 0.008.**
The sRGB gamut stops being warm near white. Max achievable chroma at hue 85° **`[computed]`**:

| L\* | 96.5 | 97.2 | 97.6 | 98.0 | 99.0 | 99.3 |
| --- | --- | --- | --- | --- | --- | --- |
| max C (H 85°) | 0.0332 | 0.0279 | 0.0226 | ~0.019 | 0.0120 | 0.0068 |

Practical approximation at hue 85°: **L\* + 100·C ≤ 99.8**. Work the inequality backwards: if you
want `C = 0.0127` (the cream canvas), the lightest warm surface you can build is **L\* 98.5**. Any
surface you push past that is white *by force of the colour space*, no matter what you intended.

**R5 — Pick your chroma band deliberately. Do not sit between bands.**

| band | canvas OKLCH C | belongs to |
| --- | --- | --- |
| cool / near-neutral UI | 0.000 – 0.004 | Obsidian default, GitHub Primer, Tailwind `neutral`/`zinc` |
| warm-neutral UI | 0.004 – 0.014 | Carbon `warmGray`, Tailwind `stone`, Radix `sand`, Rosé Pine Dawn |
| reading paper | 0.015 – 0.035 | Solarized, Everforest, Notion yellow, Radix `gold` |
| aged / vintage paper | 0.045 – 0.065 | Gruvbox, Kanagawa Lotus |

**R6 — Hold chroma across the elevation ramp.** For the first two steps above the canvas, surface
chroma must stay in **`[0.85 × C_canvas, 1.30 × C_canvas]`**. Cards may go to **1.6 ×** (a card is
allowed to be *more* like paper than the page). Anything below 0.85× is the bug in R1.

**R7 — One elevation step = ΔL\* 2.0.** Minimum 1.5 for a large surface, 3–4 for an unambiguously
separate plane, never more than 6 inside one light-mode palette. (Grounding: Material 3's own
container ladder is spaced at exactly 2 tone units — see §3.3.)

**R8 — Build a ladder, not a convergent series.** Every surface is `canvas + ΔL*` with a **fixed**
offset. The current code applies `up()` to the *canvas* three times with growing weights, so the
steps shrink as they approach white: modern-classic light is **+0.7, +0.3, +0.0, +0.0**
`[computed]` — three of the four levels are visually identical.

**R9 — Borders.** Derive hairlines from the **ink** at alpha (the shipped palette and Radix both do
this), with the border colour's chroma **≤ 0.7 × canvas chroma** and L\* **82–88**.
Light-mode alphas against `label-primary`: `l1 = 0.06`, `l2 = 0.10`, `l3 = 0.12`, `l4 = 0.16`.
*A border beats a fill step when the two surfaces are within ΔL\* 2.0* — controls inside a card,
table rows, tab underlines, input fields inside an already-raised panel, drop zones. Never stack a
full fill step **and** a strong stroke **and** a shadow for the same surface (see §6.6).

**R10 — Text ladder targets, measured against the canvas.**

| tier | target vs canvas | why |
| --- | --- | --- |
| `label-primary` | **11–17 : 1** | body + headings |
| `label-secondary` | **5.7–6.5 : 1** | descriptions, inactive tabs, timestamps you must read |
| `label-tertiary` | **3.6–4.0 : 1** | hints, placeholders |
| `label-caption` | **2.2–2.5 : 1** | *non-essential* metadata only — see §5.1 |
| `label-dimmed` | **1.3–1.8 : 1** | disabled / unavailable |

**R11 — Text chroma ≤ 0.022**, and within ±0.015 of the canvas chroma. Text hue either within 25° of
the canvas hue, **or** deliberately 120–180° away (a cool ink on warm paper — Solarized and
Everforest both do exactly this: `#657b83` H 222 on `#fdf6e3` H 90).

**R12 — Hue discipline.** Across a surface ramp, `|ΔH| ≤ 8°` when `C ≥ 0.010`, and `≤ 20°` when
`C ≤ 0.005` (where the drift is invisible). The current cream ramp drifts **87° → 95° → 91° → 68°**
`[computed]` — a 27° swing, with the last two stops at C ≈ 0.002 where hue is meaningless anyway.

**R13 — Re-derive the semantic colours per paper. Do not inherit them.**
The shipped light palette's states are cold and tuned for `#ffffff`. On cream **`[computed]`**:

| token | shipped | hex | on `#f7f3ea` |
| --- | --- | --- | --- |
| `state-warn-primary` | amber-500 | `#f59e0b` | **1.94 : 1** ✗ |
| `state-warn-label` | amber-600 | `#dd8629` | **2.52 : 1** ✗ |
| `state-success-primary` | green-500 | `#22c55e` | **2.06 : 1** ✗ |
| `state-error-primary` | red-600 | `#ec1313` | **4.06 : 1** ✗ (under 4.5) |

Fixes (§3.5 has the per-canvas table): error → `#b3261e` (**5.90:1**), warning text →
`#b45309` (**4.53:1**) or `#8a5a1e` (**5.32:1**), success → `#427b58` (**4.51:1**). Keep the
*saturated* amber/red/green for **fills only**, and always pair a warm fill with a dark warm text.

**R14 — Dark mode inverts the direction and compresses the canvas.**
Raised surfaces go **lighter**: composer **+3.5**, card **+4.5**, nested **+8.8**, overlay
**+10.5**, border **+13** ΔL\*. Keep the dark canvas at **L\* ≤ 11** (all five proposals obey this).
Every +1 L\* you add to a dark canvas costs roughly **0.6–0.9 ratio points** off the primary text
`[computed]`: `#ece5da` on `#1b1917` (L\* 8.9) = **14.01:1**, on Gruvbox's `#282828` (L\* 16.1) =
**11.79:1**, and a cool `#f9fafb` on `#151517` = **17.45:1**. Warm dark is not intrinsically dimmer —
warm dark *canvases* are conventionally lighter, and that is what eats the contrast.

**R15 — Exactly one primary accent.** Plus the four semantic states plus one monochrome "ink"
contrast colour. That is five chromatic families total, not ten.
Light-mode accent: **L\* 42–55** (so it clears 4.5:1 on every paper in §4.4), chroma
**0.08–0.17** for a calm reading theme, 0.17–0.25 only if you *want* shouty, hue **≥ 30°** from the
canvas hue or **0–15°** for a deliberately tonal/monochrome scheme.

**R16 — Focus ring.** 2 px, colour = accent, and the accent must clear **≥ 3:1** (WCAG 1.4.11) — prefer
**≥ 4.5:1** — against **every** surface it can land on: canvas, card, composer, sidebar, popover.
All five proposals in §7 clear **4.6:1** on the card `[computed]`.

### 1.2 The elevation recipe, verbatim

```js
// Replace mix(canvas, '#ffffff', w) with this.
// dL: L* offset (negative = darker). k: chroma multiplier. H is always the canvas hue.
function resample(canvasHex, dL, k) {
  const o = oklch(canvasHex)                       // {L, C, H}
  const L = clamp(o.L + dL / 100, 0.01, 1)
  const C = Math.min(o.C * k, maxChromaInSrgb(L, o.H))   // gamut clamp
  return oklchToHex(L, C, o.H)
}

// LIGHT
const sidebar  = resample(canvas, -2.4, 1.30)   // distinct column
const card     = resample(canvas, -2.0, 1.15)   // settings card, panel, composer
const composer = resample(canvas, -3.0, 1.10)   // the bottom input card
const higher   = resample(canvas, -3.6, 1.28)   // nested panel inside a card
const code     = resample(canvas, -4.6, 1.35)   // code block
const bubble   = resample(canvas, -5.0, 1.70)   // user message bubble
const border   = resample(canvas, -11.0, 0.55)  // opaque equivalent of the hairline state
const overlay  = resample(canvas, Math.min(1.5, 98.5 - L(canvas)), 0.92)  // popover ONLY

// DARK  (direction flips; chroma multipliers stay near 1 so hue is preserved)
const card     = resample(canvas, +4.5, 0.95)
const composer = resample(canvas, +3.5, 0.95)
const higher   = resample(canvas, +8.8, 0.90)
const overlay  = resample(canvas, +10.5, 0.85)
const code     = resample(canvas, +2.2, 0.90)
const bubble   = resample(canvas, +6.4, 1.30)
const border   = resample(canvas, +12.9, 1.10)
const sidebar  = resample(canvas, -2.2, 0.70)
```

Text tiers stay **solved, not faded** — the existing `reach(canvas, ink, target)` helper in
`client.js` is correct and should be kept. Only the surfaces are broken.

### 1.3 The stop-list

1. `mix(x, '#ffffff', *)` for any light-mode surface. Ever.
2. A light-mode surface with `L* > 98.5`.
3. A surface whose OKLCH chroma is `< 0.85 ×` its canvas chroma.
4. `#ffffff` anywhere in a warm theme except `label-primary-foreground` on a saturated accent fill.
5. `#000000` text. Use an ink at L\* 8–22 with a hue.
6. One accent family reused for accent + error + warning + success.
7. Pure-black shadows on warm paper (`#00000008`). Use the ink hue at the same alpha.
8. Any semantic colour inherited from a cool palette.

---

## 2. Reference data

All values below were read out of the file at the given URL. I fetched every one of these during
this task; nothing is from memory.

### 2.1 Reading / writing apps

#### Obsidian — **default theme**, shipped in the app bundle *(cited, primary)*

Extracted from `/Applications/Obsidian.app/Contents/Resources/obsidian.asar` (the `.theme-light` and
`.theme-dark` blocks of the bundled `app.css`). This is the app's own default, not a community theme.

| role | light | dark |
| --- | --- | --- |
| canvas (`--background-primary` ← `--color-base-00`) | `#ffffff` | `#1e1e1e` |
| alt surface / code (`--background-primary-alt` ← base-10) | `#fafafa` | `#242424` |
| sidebar (`--background-secondary` ← base-20) | `#f6f6f6` | `#262626` |
| border (`--background-modifier-border` ← base-30) | `#e0e0e0` | `#363636` |
| text (`--text-normal` ← base-100) | `#222222` | `#dadada` |
| text muted (← base-70) | `#5c5c5c` | `#b3b3b3` |
| text faint (← base-50) | `#ababab` | `#666666` |
| accent | `hsl(258, 88 %, 66 %)` | same HSL, re-derived |

Note for §3: **Obsidian's light elevation goes darker** (`#ffffff` → `#fafafa` → `#f6f6f6`), and its
dark elevation goes lighter. Also `--background-modifier-form-field: var(--color-base-00)` — inputs
are the *same* colour as the canvas in both modes, so the composer problem does not arise there.
Contrasts **`[computed]`**: light faint 2.30:1, dark faint 2.90:1 — both fail 3:1, a known complaint.

#### Obsidian — **Minimal** (kepano) *(cited)*
`https://raw.githubusercontent.com/kepano/obsidian-minimal/master/theme.css` — Minimal is a
*generator*, not a palette. Defaults: `--base-h: 0; --base-s: 0 %; --base-l: 96 %` (i.e. **zero
chroma**), `--bg1: white` for the canvas, `--bg2: hsl(H, S, 96 %)`, `--ui1/2/3` at `L − 6/12/20`,
`--tx1..tx4` at `L − 90/50/25/60`. So Minimal's default light canvas is **pure white**, and warm
variants come only from user-set `--base-h`/`--base-s`. Useful as the **cold baseline**, not as a
warm reference.

#### Obsidian — **Things** (colineckert) *(cited)*
`https://raw.githubusercontent.com/colineckert/obsidian-things/main/theme.css`

| token | light | dark |
| --- | --- | --- |
| `--color-base-00` (editor) | `#ffffff` | `#1c2127` |
| `--color-base-05` | `#fcfcfc` | — |
| `--color-base-10` (code blocks) | `#f6f7f8` | `#282c34` |
| `--color-base-20` | `#f6f7f8` | `#181c20` |
| `--color-base-25` | `#f0f0f0` | `#2c313c` |
| `--color-base-30` (dividers) | `#ebedf0` | `#35393e` |
| `--color-base-35/40/50` | `#d4d4d4` / `#bdbdbd` / `#ababab` | `#3f3f3f` / `#555` / `#666` |
| `--color-base-60/70/100` | `#707070` / `#5a5a5a` / `#222222` | `#999` / `#bababa` / `#dadada` |

Cold-blue-grey neutrals. Again: light elevation darker, dark elevation lighter.

#### Notion *(cited, via a documentation mirror of Notion's own CSS variables)*
`https://docs.super.so/notion-colors`

| name | text | bg |
| --- | --- | --- |
| Default | `#37352F` | `#FFFFFF` |
| Gray | `#9B9A97` | `#EBECED` |
| Brown | `#64473A` | `#E9E5E3` |
| Orange | `#D9730D` | `#FAEBDD` |
| Yellow | `#DFAB01` | `#FBF3DB` |
| Green | `#0F7B6C` | `#DDEDEA` |
| Blue | `#0B6E99` | `#DDEBF1` |
| Purple | `#6940A5` | `#EAE4F2` |
| Pink | `#AD1A72` | `#F4DFEB` |
| Red | `#E03E3E` | `#FBE4E4` |

Notion's canvas is **pure white**, but its *text* `#37352F` is a warm dark (OKLCH `32.9 % 0.0107 92`
**`[computed]`**) — worth stealing on its own. Dark mode: default text `rgba(255,255,255,0.9)`,
default bg `#2F3437`, gray bg `#454B4E`.

**Notion is also the clearest example of the warning-on-warm trap** **`[computed]`**:
`#DFAB01` on `#FBF3DB` = **1.90:1**; `#D9730D` on `#FAEBDD` = **2.81:1**. Both fail 3:1.
Notion survives because those pairs are used for *highlight chips with dark text*, not for text.
Do not copy the pair as a text/background combination.

#### Bear (Shiny Frog) *(cited — schema only, not values)*
`https://community.bear.app/t/definition-of-terms-used-in-the-theme-files/18306` — Bear staff
document the `.theme` keys: `text color`, `text secondary color`, `text tertiary color` (darkest →
lightest), `background secondary color`, `background tertiary color` (**lightest → darkest**),
`stroke color`, `accent color`, `search primary color`, `selection color`.

Two things are worth taking: Bear's background ramp explicitly runs **lightest → darkest as the
number increases**, and the user-posted sample theme is cool (`bg secondary #E3E3E9`, `stroke
#D7D7DD`, `text tertiary #7c7f93`, `accent #84464F`). Bear does not publish warm themes' hexes.

#### Kindle sepia, Apple Books sepia, iA Writer, Ulysses, Craft — **not published**

I could not find a primary source for any of these, and I am not going to invent numbers:

* **Kindle sepia** — Amazon ships no theme token file. Searches surfaced only forum posts and
  third-party pages ([MobileRead](https://www.mobileread.com/forums/showthread.php?t=297299),
  [Amazon's accessible-reading help](https://www.amazon.es/gp/help/customer/display.html?nodeId=TABlJ4ot69emTO8jJG)),
  none with an authoritative hex. Any `#fbf0d9`-style value circulating online is **unverified**.
* **Apple Books sepia** — I dumped `Assets.car` from `/System/Applications/Books.app` with
  `xcrun assetutil --info`. 204 named colour assets, **zero** matching `sepia|reader|theme|paper|page`;
  the only colours present are app-icon assets. The reader themes are not exposed as named assets.
* **iA Writer / Ulysses / Craft** — no published palette files found.

**Substitute for the "sepia reading paper" reference:** Solarized's `base3`/`base2` and Everforest's
`material` variant, both of which are genuine, cited, and in the same colour neighbourhood.

### 2.2 Developer palettes — warm / paper-like

#### Solarized Light (Ethan Schoonover) *(cited)*
`https://raw.githubusercontent.com/altercation/solarized/master/xresources/solarized`

```
base3 #fdf6e3   base2 #eee8d5   base1 #93a1a1   base0  #839496
base1 #93a1a1   base00 #657b83  base01 #586e75  base02 #073642  base03 #002b36
yellow #b58900  orange #cb4b16  red #dc322f     magenta #d33682
violet #6c71c4  blue #268bd2    cyan #2aa198    green #859900
```

The light mapping (from the commented block in the same file): canvas = `base3 #fdf6e3`,
raised/secondary = `base2 #eee8d5`, body text = `base00 #657b83`, emphasised text =
`base01 #586e75`, line colour = `base1 #93a1a1`.

**This is the single most important reference for §3: Solarized's raised surface is `base2`, which
is DARKER than the canvas** (L\* 97.0 → 92.0, **ΔL\* −5.0** `[computed]`), and *more* chromatic in
practice. Contrasts **`[computed]`**: `#586e75` on `#fdf6e3` = 4.99:1, `#657b83` on `#fdf6e3` =
4.13:1, `#93a1a1` on `#fdf6e3` = 2.48:1 (fails).

#### Rosé Pine — Dawn *(cited)*
`https://raw.githubusercontent.com/rose-pine/rose-pine-palette/main/palette.json`

| role | hex | L\* | OKLCH | contrast on base |
| --- | --- | --- | --- | --- |
| base | `#faf4ed` | 96.5 | `97.0 % 0.0113 72` | — |
| surface | `#fffaf3` | 98.5 | `98.7 % 0.0107 77` | — |
| overlay | `#f2e9e1` | 92.8 | `93.9 % 0.0145 64` | — |
| text | `#464261` | 29.6 | `39.6 % 0.0519 290` | 8.69:1 |
| subtle | `#797593` | 50.6 | `57.7 % 0.0458 291` | 4.02:1 |
| muted | `#9893a5` | 61.9 | `67.3 % 0.0268 298` | 2.73:1 |
| pine | `#286983` | 41.5 | `49.1 % 0.0770 228` | 5.51:1 |
| gold | `#ea9d34` | 70.8 | `75.5 % 0.1459 70` | — |
| love | `#b4637a` | 51.9 | `59.9 % 0.1071 3` | — |
| rose | `#d7827e` | 63.3 | `69.6 % 0.1058 23` | — |
| iris | `#907aa9` | 54.8 | `61.7 % 0.0738 306` | — |

**Dawn is the canonical counter-example**: its `surface #fffaf3` *is* lighter than `base`, and it
still reads as warm. The reason is quantitative — it keeps **95 %** of the base chroma (0.0107 /
0.0113) and only steps **+2.0 L\***. That is the *only* safe way to go lighter, and it is exactly
what the current implementation fails to do (13 % chroma retained).

#### Gruvbox Light (morhetz) *(cited)*
`https://raw.githubusercontent.com/morhetz/gruvbox/master/colors/gruvbox.vim`
(light mode maps `bg0/1/2/3/4 ← light0/1/2/3/4`, `fg0..4 ← dark0..4`, accents ← `faded_*`):

```
light0_hard  #f9f5d7   light0       #fbf1c7   light0_soft  #f2e5bc
light1 #ebdbb2   light2 #d5c4a1   light3 #bdae93   light4 #a89984
dark0  #282828   dark1  #3c3836   dark2  #504945   dark3  #665c54   dark4  #7c6f64
gray_244 #928374
faded_red #9d0006  faded_green #79740e  faded_yellow #b57614  faded_blue #076678
faded_purple #8f3f71  faded_aqua #427b58  faded_orange #af3a03
```

`bg0` (medium contrast) = `#fbf1c7`, **OKLCH `95.6 % 0.0555 96`** `[computed]` — the most
chromatic "paper" in this whole document, and it works. `light0/hard #f9f5d7` is the low-chroma
variant. Contrasts **`[computed]`**: `#282828` on `#fbf1c7` = 12.99:1; `#3c3836` on `#fbf1c7` =
10.22:1; `#928374` on `#fbf1c7` = 3.24:1; `#b57614` on `#fbf1c7` = 3.33:1.
Note **Gruvbox's light-mode text is pure neutral `#282828` (OKLCH C = 0.0000)** — a deliberate
chroma contrast against the very yellow page. That is a legitimate strategy and worth stealing.

#### Everforest Light (sainnhe) *(cited)*
`https://raw.githubusercontent.com/sainnhe/everforest/master/autoload/everforest.vim`

Four light variants, each with its own `bg0..bg5` ladder. `bg_dim` is the dimmed/de-emphasised
surface; `bg0` is the canvas; `bg1..bg5` are floating/statusline surfaces.

| variant | bg_dim | bg0 (canvas) | bg1 | bg2 | bg3 | bg4 | bg5 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hard | `#f2efdf` | `#fffbef` | `#f8f5e4` | `#f2efdf` | `#edeada` | `#e8e5d5` | `#bec5b2` |
| medium | `#efebd4` | `#fdf6e3` | `#f4f0d9` | `#efebd4` | `#e6e2cc` | `#e0dcc7` | `#bdc3af` |
| soft | `#efebd4` | `#f3ead3` | `#eae4ca` | `#e5dfc5` | `#ddd8be` | `#d8d3ba` | `#b9c0ab` |
| (bg_visual / bg_red / bg_yellow for each) | | | | | | | |

Accents and text (same in all light variants):

```
fg #5c6a72   grey0 #a6b0a0   grey1 #939f91   grey2 #829181
red #f85552  orange #f57d26  yellow #dfa000  green #8da101
aqua #35a77c blue #3a94c5    purple #df69ba
```

Note the **`bg0 → bg1 → bg2 → bg3` ladder is monotonically darker** (L\* 98.6 → 96.4 → 94.3 → 92.5
`[computed]`, steps ≈ −2.2, i.e. exactly M3's step size), and `bg0 → bg_dim` is −4.3.
**This is the cleanest, most directly copyable elevation ladder in the whole reference set.**
Contrasts **`[computed]`**: fg `#5c6a72` on `#fffbef` = 5.40:1; grey0 `#a6b0a0` on `#fffbef` =
2.17:1; orange on bg0 = 2.59:1; yellow = 2.21:1; green = 2.81:1; red = 3.17:1 — i.e. **Everforest's
accent colours are fill/decoration colours, not text colours, on the light canvas.**

#### Catppuccin Latte *(cited)*
`https://raw.githubusercontent.com/catppuccin/palette/main/palette.json` (the canonical palette JSON;
it ships pre-computed OKLCH, which is convenient).

| role | hex | L\* | OKLCH (from the file) |
| --- | --- | --- | --- |
| base (canvas) | `#eff1f5` | 95.1 | `95.8 % 0.0058 265` |
| mantle | `#e6e9ef` | 92.3 | `93.3 % 0.0087 265` |
| crust | `#dce0e8` | 89.1 | `90.6 % 0.0117 265` |
| surface0 | `#ccd0da` | 83.4 | `85.7 % 0.0145 268` |
| surface1 | `#bcc0cc` | — | — |
| surface2 | `#acb0be` | — | — |
| overlay0 | `#9ca0b0` | 66.0 | `70.8 % 0.0237 275` |
| overlay1 | `#8c8fa1` | — | — |
| overlay2 | `#7c7f93` | — | — |
| subtext0 | `#6c6f85` | — | — |
| subtext1 | `#5c5f77` | — | — |
| text | `#4c4f69` | 34.3 | `43.5 % 0.0430 279` |
| mauve | `#8839ef` | 44.8 | `55.5 % 0.2503 297` |
| red | `#d20f39` | 0.550 | `55.0 % 0.2155 19.8` |
| peach | `#fe640b` | — | `69.2 % 0.2041 42.4` |
| yellow | `#df8e1d` | — | `71.4 % 0.1494 67.8` |
| green | `#40a02b` | — | `62.5 % 0.1772 140.4` |
| teal | `#179299` | — | `60.2 % 0.0981 201.1` |
| blue | `#1e66f5` | — | `55.9 % 0.2255 262.1` |

Latte is **cool** (hue 265 throughout) but it is the best-documented *complete* ladder: look at the
chroma column — `base 0.0058 → mantle 0.0087 → crust 0.0117 → surface0 0.0145`. **Chroma rises as
L\* falls.** That is the pattern to copy; it is the exact inverse of `mix(x, white, w)`.
Contrasts **`[computed]`**: text 7.06:1, overlay0 2.30:1, surface2 1.91:1.

#### Kanagawa — Lotus *(cited)*
`https://raw.githubusercontent.com/rebelot/kanagawa.nvim/master/lua/kanagawa/colors.lua` and the
role assignments in `.../lua/kanagawa/themes.lua` (`lotus = function(palette) …`).

Assigned roles: `bg = lotusWhite3`, `bg_dim = lotusWhite1`, `bg_m1/m2/m3 = White2/White1/White0`,
`bg_p1/p2 = White4/White5`, `fg = lotusInk1`, `fg_dim = lotusInk2`.

```
lotusInk1  #545464  (fg)        lotusInk2  #43436c  (fg_dim)
lotusGray  #dcd7ba              lotusGray2 #716e61   lotusGray3 #8a8980
white0 #d5cea3  white1 #dcd5ac  white2 #e5ddb0  white3 #f2ecbc  white4 #e7dba0  white5 #e4d794
violet1 #a09cac violet2 #766b90 violet3 #c9cbd1 violet4 #624c83
blue1 #c7d7e0  blue2 #b5cbd2  blue3 #9fb5c9  blue4 #4d699b  blue5 #5d57a3
green #6f894e  green2 #6e915f  green3 #b7d0ae  pink #b35b79
orange #cc6d00 orange2 #e98a00  yellow #77713f  yellow2 #836f4a
yellow3 #de9800 yellow4 #f9d791 red #c84053  red2 #d7474b  red3 #e82424
aqua #597b75  aqua2 #5e857a
```

Canvas `#f2ecbc` = **OKLCH `93.6 % 0.0625 102`** `[computed]` — a genuinely saturated aged-paper
yellow. **Lotus's `bg_p1` (raised) is `white4 #e7dba0`, which is L\* 92.8 → 87.1, ΔL\* −5.7 — darker
AND more chromatic (`C 0.0625 → 0.0773`).** The textbook "go down and in" elevation.
Contrasts **`[computed]`**: ink1 on white3 = 6.19:1; violet1 on white3 = 2.23:1.

#### Obsidian's community warm themes
`Minimal` (§2.1) and `Things` (§2.1) were the two I could fetch from their official repos.
`Typora`, `Atom`, `Roam`, `Logseq` official palettes: **not published** in a form I could verify.
I am not listing impressionistic values for them.

### 2.3 Developer palettes — the cold contrast set

#### GitHub Primer, light *(cited)*
`https://unpkg.com/@primer/primitives/dist/css/functional/themes/light.css`

| token | hex | L\* | OKLCH |
| --- | --- | --- | --- |
| `bgColor-default` | `#ffffff` | 100.0 | `100 % 0 90` |
| `bgColor-muted` | `#f6f8fa` | 97.5 | `97.8 % 0.0034 248` |
| `bgColor-inset`-family / disabled | `#eff2f5` | — | — |
| `borderColor-default` | `#d1d9e0` | 86.3 | `88.1 % 0.0130 244` |
| `borderColor-muted` | `#d1d9e0b3` | — | — |
| `borderColor-emphasis` | `#818b98` | — | — |
| `fgColor-default` | `#1f2328` | 13.5 | `25.4 % 0.0111 254` |
| `fgColor-muted` | `#59636e` | 41.5 | `49.5 % 0.0215 251` |
| `bgColor-accent-emphasis` | `#0969da` | 45.9 | `54.0 % 0.1906 257` |
| `bgColor-danger-emphasis` | `#cf222e` | — | — |
| `bgColor-success-emphasis` | `#1f883d` | — | — |
| `bgColor-attention-emphasis` | `#9a6700` | — | — |

Contrasts **`[computed]`**: fg 15.80:1, fg-muted 6.11:1 on white. Every hue is **244–257** — that is
what "cold" means numerically, and it is the thing a warm theme must not accidentally do.

#### Nord *(cited)*
`https://raw.githubusercontent.com/nordtheme/nord/develop/src/nord.css`

```
nord0 #2e3440  nord1 #3b4252  nord2 #434c5e  nord3 #4c566a
nord4 #d8dee9  nord5 #e5e9f0  nord6 #eceff4
nord7 #8fbcbb  nord8 #88c0d0  nord9 #81a1c1  nord10 #5e81ac
nord11 #bf616a nord12 #d08770 nord13 #ebcb8b nord14 #a3be8c nord15 #b48ead
```

Nord's light surface stack is `nord6 #eceff4` (L\* 94.4) → `nord5 #e5e9f0` (92.2) → `nord4 #d8dee9`
(88.3), all at **hue 261–263**. Contrasts on `nord6`: `nord0` 10.2:1, `nord3` 5.5:1 `[computed]`.

#### Atom One Light, Tomorrow — **not fetched.** Omitted rather than guessed.

### 2.4 Design systems with published warm-neutral tokens

#### Radix Colors, light scales *(cited)*
`https://raw.githubusercontent.com/radix-ui/colors/main/src/light.ts`
Radix semantics: **1** app background · **2** subtle background · **3** component background ·
**6** subtle border · **8** strong border/focus · **9** solid fill · **11** low-contrast text ·
**12** high-contrast text.

| scale | 1 | 2 | 3 | 6 | 8 | 9 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sand` (warm) | `#fdfdfc` | `#f9f9f8` | `#f1f0ef` | `#dad9d6` | `#bcbbb5` | `#8d8d86` | `#63635e` | `#21201c` |
| `slate` (cool) | `#fcfcfd` | `#f9f9fb` | `#f0f0f3` | `#d9d9e0` | `#b9bbc6` | `#8b8d98` | `#60646c` | `#1c2024` |
| `gray` (neutral) | `#fcfcfc` | `#f9f9f9` | `#f0f0f0` | `#d9d9d9` | `#bbbbbb` | `#8d8d8d` | `#646464` | `#202020` |
| `bronze` | `#fdfcfc` | `#fdf7f5` | `#f6edea` | `#dfcdc5` | `#c2a499` | `#a18072` | `#7d5e54` | `#43302b` |
| `gold` | `#fdfdfc` | `#faf9f2` | `#f2f0e7` | `#d8d0bf` | `#b9a88d` | `#978365` | `#71624b` | `#3b352b` |
| `amber` | `#fefdfb` | `#fefbe9` | `#fff7c2` | `#f3d673` | `#e2a336` | `#ffc53d` | `#ab6400` | `#4f3422` |
| `tomato` | `#fffcfc` | `#fff8f7` | `#feebe7` | `#fdbdaf` | `#ec8e7b` | `#e54d2e` | `#d13415` | `#5c271f` |
| `red` | `#fffcfc` | `#fff7f7` | `#feebec` | `#fdbdbe` | `#eb8e90` | `#e5484d` | `#ce2c31` | `#641723` |
| `green` | `#fbfefc` | `#f4fbf6` | `#e6f6eb` | `#adddc0` | `#5bb98b` | `#30a46c` | `#218358` | `#193b2d` |
| `grass` | `#fbfefb` | `#f5fbf5` | `#e9f6e9` | `#b2ddb5` | `#65ba74` | `#46a758` | `#2a7e3b` | `#203c25` |
| `brown` | `#fefdfc` | `#fcf9f6` | `#f6eee7` | `#e4cdb7` | `#cea37e` | `#ad7f58` | `#815e46` | `#3e332e` |
| `yellow` | `#fdfdf9` | `#fefce9` | `#fffab8` | `#f3d768` | `#d5ae39` | `#ffe629` | `#9e6c00` | `#473b1f` |

Radix is the best single source for **step sizes**: `sand` `1→2` is **−1.4 L\***, `2→3` is **−2.3 L\***,
`3→6` is **−8.1 L\***, `11→12` is **−29.6 L\*** `[computed]`. And the sand-vs-slate comparison is a
clean read on warm-vs-cool at identical lightness: `sand2 #f9f9f8` is `98.2 % 0.0013 106` while
`slate2 #f9f9fb` is `98.5 % 0.0031 264` — **same L\*, opposite hue, and Radix's warm neutral is
*less* chromatic than its cool one at this step.**

#### Tailwind CSS *(cited)*
Hex ladders from `https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/public/colors.js`;
OKLCH from the v4 `theme.css` at
`https://raw.githubusercontent.com/tailwindlabs/tailwindcss/main/packages/tailwindcss/theme.css`.

```
stone    50 #fafaf9  100 #f5f5f4  200 #e7e5e4  300 #d6d3d1  400 #a8a29e
        500 #78716c  600 #57534e  700 #44403c  800 #292524  900 #1c1917  950 #0c0a09
neutral  50 #fafafa  100 #f5f5f5  200 #e5e5e5  300 #d4d4d4  400 #a3a3a3
        500 #737373  600 #525252  700 #404040  800 #262626  900 #171717  950 #0a0a0a
gray     50 #f9fafb  100 #f3f4f6  200 #e5e7eb  300 #d1d5db  400 #9ca3af
        500 #6b7280  600 #4b5563  700 #374151  800 #1f2937  900 #111827  950 #030712
slate    50 #f8fafc  100 #f1f5f9  200 #e2e8f0  300 #cbd5e1  400 #94a3b8
        500 #64748b  600 #475569  700 #334155  800 #1e293b  900 #0f172a  950 #020617
zinc     50 #fafafa  100 #f4f4f5  200 #e4e4e7  300 #d4d4d8  400 #a1a1aa
        500 #71717a  600 #52525b  700 #3f3f46  800 #27272a  900 #18181b  950 #09090b
amber    50 #fffbeb  100 #fef3c7  200 #fde68a  300 #fcd34d  400 #fbbf24  500 #f59e0b
        600 #d97706  700 #b45309  800 #92400e  900 #78350f  950 #451a03
orange   50 #fff7ed  100 #ffedd5  200 #fed7aa  300 #fdba74  400 #fb923c  500 #f97316
        600 #ea580c  700 #c2410c  800 #9a3412  900 #7c2d12  950 #431407
red      50 #fef2f2  100 #fee2e2  200 #fecaca  300 #fca5a5  400 #f87171  500 #ef4444
        600 #dc2626  700 #b91c1c  800 #991b1b  900 #7f1d1d  950 #450a0a
green    50 #f0fdf4  100 #dcfce7  200 #bbf7d0  300 #86efac  400 #4ade80  500 #22c55e
        600 #16a34a  700 #15803d  800 #166534  900 #14532d  950 #052e16
```

v4 OKLCH for `stone` (this is where the chroma honesty lives):

| step | OKLCH | step | OKLCH |
| --- | --- | --- | --- |
| 50 | `98.5 % 0.001 106.4` | 400 | `70.9 % 0.010 56.3` |
| 100 | `97 % 0.001 106.4` | 500 | `55.3 % 0.013 58.1` |
| 200 | `92.3 % 0.003 48.7` | 600 | `44.4 % 0.011 73.6` |
| 300 | `86.9 % 0.005 56.4` | 700 | `37.4 % 0.010 67.6` |
| | | 900 | `21.6 % 0.006 56.0` |
| | | 950 | `14.7 % 0.004 49.3` |

**`stone`'s chroma never exceeds 0.013 across all eleven steps, and steps 50/100 are 0.001.** So
Tailwind's canonical "warm neutral" is *almost* neutral. Compare the workbench's cream canvas at
**0.0127** and novel at **0.0196** `[computed]`: the "warm paper" themes are 10–20× more chromatic
than Tailwind's warm gray. Both are correct — they are in different bands (§1 R5) — but you must know
which band you are in. Also note Tailwind's own hue drifts 106 → 48 → 73 → 34 across the ramp; at
C ≤ 0.013 that drift is invisible, which is the empirical basis for R12's two-tier rule.

#### IBM Carbon *(cited)*
`https://raw.githubusercontent.com/carbon-design-system/carbon/main/packages/colors/tokens/colors.tokens.json`

| step | `warmGray` | `coolGray` | `gray` |
| --- | --- | --- | --- |
| 10 | `#f7f3f2` | `#f2f4f8` | `#f4f4f4` |
| 20 | `#e5e0df` | `#dde1e6` | `#e0e0e0` |
| 30 | `#cac5c4` | `#c1c7cd` | `#c6c6c6` |
| 40 | `#ada8a8` | `#a2a9b0` | `#a8a8a8` |
| 50 | `#8f8b8b` | `#878d96` | `#8d8d8d` |
| 60 | `#726e6e` | `#697077` | `#6f6f6f` |
| 70 | `#565151` | `#4d5358` | `#525252` |
| 80 | `#3c3838` | `#343a3f` | `#393939` |
| 90 | `#272525` | `#21272a` | `#262626` |
| 100 | `#171414` | `#121619` | `#161616` |

`warmGray-10 #f7f3f2` is **OKLCH `96.7 % 0.0045 34`** `[computed]` — arguably the most
"professional" 米白 in this document, and it is a *pink* warm (hue 34), not a yellow cream (hue 85).
`coolGray-10` is `96.7 % 0.0058 265`. **A warm and a cool gray at identical L\* 96.1, differing by
0.0013 in chroma.** That is the whole difference between "warm" and "cold" at the near-white end,
which is why R4's chroma floor exists: below ~0.004 the warm/cool distinction disappears entirely.

#### Salesforce Lightning Design System *(cited)*
`https://unpkg.com/@salesforce-ux/design-system/design-tokens/dist/colors.json`

`color-neutral-*`: `100 #ffffff`, `95 #f3f3f3`, `90 #e5e5e5`, `80 #c9c9c9`, `70 #aeaeae`,
`65 #a0a0a0`, `60 #939393`, `50 #747474`, `40 #5c5c5c`, `30 #444444`, `20 #2e2e2e`,
`15 #242424`, `10 #181818`.

**Correction to the brief:** SLDS as published on npm has **no warm-neutral family.** Its 66 colour
tokens are `border`, `brand`, `error`, `neutral`, `success`, `warning`, and `neutral` is *exactly*
zero-chroma grey at every step. So SLDS belongs in the **cold baseline** column, not the warm
references. (Its only non-neutral hues are `brand` blue, `error` red, `success` green,
`warning` orange.)

#### Material Design 3 tonal palettes *(cited)*
`https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/dynamiccolor/color_spec_2021.ts`
and `.../dynamiccolor/dynamic_scheme.ts`

Neutral chroma (HCT chroma; HCT's "tone" is CIE L\*, so the tones below are L\* directly):

| variant | `neutralPalette` chroma | `neutralVariantPalette` chroma |
| --- | --- | --- |
| TONAL_SPOT (Material You default) | **6.0** | **8.0** |
| NEUTRAL | 2.0 | 2.0 |
| MONOCHROME | 0.0 | 0.0 |
| EXPRESSIVE | 8.0 | 12.0 |
| VIBRANT | 10.0 | 12.0 |
| CONTENT / FIDELITY | `chroma/8` | `chroma/8 + 4` |

Surface roles and their light-mode tones **`(cited)`**:

| role | light tone | dark tone |
| --- | --- | --- |
| `surface` | **98** | 6 |
| `surfaceDim` | **87** | 6 |
| `surfaceBright` | **98** | 24 |
| `surfaceContainerLowest` | **100** | 4 |
| `surfaceContainerLow` | **96** | 10 |
| `surfaceContainer` | **94** | 12 |
| `surfaceContainerHigh` | **92** | 17 |
| `surfaceContainerHighest` | **90** | 22 |
| `onSurface` | tone **10** against `highestSurface`, contrast curve **4.5 / 7 / 11 / 21** | tone 90 |

**This is the load-bearing citation for §3.** M3's light canvas is tone 98, and every *container*
role above it is **darker**: 96, 94, 92, 90 — steps of exactly **2**. Only
`surfaceContainerLowest` (100) and `surfaceBright` (98) are lighter, and `surfaceBright` is a
*special-purpose flat* surface, not a card.
Caveat for honesty: HCT chroma is not OKLCH chroma. At these near-neutral tones HCT 6 ≈ OKLCH
`C 0.015–0.020`; the two scales are not interchangeable and I only use the M3 numbers for the
**tone/L\*** ladder and the **relative** chroma ordering.

#### WCAG contrast thresholds *(cited)*
* 1.4.3 Contrast (Minimum) — https://www.w3.org/TR/WCAG21/#contrast-minimum — **4.5:1** for normal
  text, **3:1** for large text (≥ 18 pt, or ≥ 14 pt bold).
* 1.4.11 Non-text Contrast — https://www.w3.org/TR/WCAG21/#non-text-contrast — **3:1** for UI
  components and graphical objects, which is what a focus ring and a border must clear.

---

## 3. The elevation problem in a light warm theme

### 3.1 Does a raised surface go lighter, or darker?

**Darker. In light mode, `canvas → card → composer → higher` steps DOWN in L\*.** Unequivocally, for
content-adjacent surfaces. Seven independent citations:

| system | canvas | raised step 1 | ΔL\* | direction |
| --- | --- | --- | --- | --- |
| Material 3 (container ladder) | tone 98 | 96 / 94 / 92 / 90 | −2 each | **down** |
| Solarized Light | `#fdf6e3` (97.0) | `#eee8d5` (92.0) | −5.0 | **down** |
| Everforest Light (hard) | `#fffbef` (98.6) | `#f8f5e4` → `#f2efdf` → `#edeada` | −2.2 / −4.3 / −6.1 | **down** |
| Everforest material | `#fdf6e3` (97.0) | `#efebd4` (`bg2`) | −4.2 | **down** |
| Obsidian default light | `#ffffff` (100) | `#fafafa` (code) / `#f6f6f6` (sidebar) | −1.7 / −3.1 | **down** |
| Kanagawa Lotus | `#f2ecbc` (92.8) | `#e7dba0` (`bg_p1`) | −5.7 | **down** |
| Catppuccin Latte | `#eff1f5` (95.1) | `#e6e9ef` → `#dce0e8` | −2.8 / −6.0 | **down** |
| Radix Colors | step 1 | step 2 → 3 → 6 | −1.4 / −2.3 / −8.1 | **down** |
| Tailwind `stone` | 50 | 100 → 200 → 300 | −1.7 / −5.4 / −11.8 | **down** |

The one counter-example: **Rosé Pine Dawn** (`base #faf4ed` → `surface #fffaf3`, **+2.0**). It works
because it retains **95 %** of the chroma. Note also that in Dawn, `overlay #f2e9e1` (`−3.7`) is the
*secondary/recessed* surface — so Dawn uses *both* directions for different roles, and the lighter
one is reserved for the floating "surface".

**Why does this happen?** Three converging reasons:

1. **Gamut.** At L\* 97–99 there is almost no sRGB room left for chroma (§1 R4). You physically
   cannot make a *lighter* warm surface that is still warm. Going darker buys you warmth back; going
   lighter spends it.
2. **Convention from physical paper.** A sheet lying on a desk catches less light than the desk
   surface only if it is shadowed — so "raised" reads as *shadowed*, i.e. darker, and the shadow is
   what tells you it is raised.
3. **Screens invert dark mode.** In dark mode, emission adds light, so "more raised = brighter". The
   workbench's `up()` was written for the dark convention (where it is correct) and then reused in
   light, where it is backwards.

### 3.2 When is slightly-darker the wrong answer, and same-lightness-different-warmth right?

**Use "same L\*, different warmth" when the two surfaces would otherwise collide in value** — i.e.
adjacent large areas where a ΔL\* step would read as a *shadow* rather than as a *material*. The
concrete cases in this app:

* **User bubble on the transcript.** A bubble at −5 L\* is fine, but if you also want the bubble to
  feel like a different *material* rather than a recessed well, keep it at −1 to −2 L\* and raise
  chroma to **1.6–1.8 ×** the canvas (bubble chroma 0.020 vs canvas 0.013 `[computed]`, in the cream
  proposal). The tint does the work; the value step stays small.
* **Sidebar vs canvas on macOS.** The sidebar is composited at ≈ 39 % over native vibrancy with a
  blue gradient (`#7a9bf01a`, see `docs/surface-map.md` §2.1), so a large ΔL\* gets *diluted* anyway.
  Prefer a **hue/chroma** difference (sidebar chroma × 1.3) over a big value step, and keep ΔL\* to
  −2.0 to −2.5.
* **Code blocks inside a card.** The card has already stepped down; a further big step down makes the
  code look like a hole. Use ≈ −2.5 from the *card*, plus a slight chroma increase.

**Use "slightly darker" always** for: composer, settings cards, popovers' *content* panels, nested
panels, and anything the user must recognise as a container.

**Use "lighter" only** for: menus, popovers, dialogs, tooltips, dropdowns, command palettes — i.e.
things that float over the page and carry a shadow. Even then, obey R3 (L\* ≤ 98.5, chroma ≥ 0.90 ×).

### 3.3 How big should the step be?

**ΔL\* = 2.0 per step. 1.5 is the floor. 3–4 for an unambiguously separate plane. Never > 6.**

Grounding, not vibes:

* **Material 3's own container ladder is spaced at exactly 2 tone units** (98/96/94/92/90) — six
  years of Android surfaces at that spacing.
* **Everforest's `bg0→bg1→bg2→bg3` steps are −2.2, −2.1, −1.8** `[computed]`, i.e. ≈2.
* **Radix `sand` 1→2→3 steps are −1.4 and −2.3** `[computed]`.
* **Tailwind `stone` 50→100 is −1.7** `[computed]`.
* Below **ΔL\* 1.0** two large adjacent patches are not reliably distinguishable on a consumer
  display; above **ΔL\* 6** within one light-mode palette, the "cards" start reading as separate
  documents pasted onto the page, and the shadow + hairline become redundant.

Concrete hex pairs **`[computed]`** (canvas → card at −2.0 with chroma held at 1.15×):

| theme canvas | canvas | card (−2.0) | ΔL\* | composer (−3.0) | popover (+1.5, R3) |
| --- | --- | --- | --- | --- | --- |
| cream `#f7f3ea` | `#f7f3ea` | `#f1ece2` | −2.4 | `#ede9df` | `#fcf8f0` |
| novel `#fdf6e3` | `#fdf6e3` | `#f7efda` | −2.4 | `#f4ecd7` | `#fffbef` |
| calm `#eef3ee` | `#eef3ee` | `#e7ede7` | −2.2 | `#e4e9e4` | `#f3f8f3` |
| modern-classic `#f9f9fb` | `#f9f9fb` | `#f2f2f5` | −2.4 | `#efeff1` | `#fbfbfd` |
| deep-work `#f5f5f4` | `#f5f5f4` | `#eeeeed` | −2.4 | `#ebebea` | `#fafaf9` |
| — *for comparison* — | | | | | |
| Solarized (real) | `#fdf6e3` | `#eee8d5` | −5.0 | — | — |
| **current cream (bug)** | `#f7f3ea` | `#fbfaf6` **lighter** | **+2.3** | `#fefdfc` **lighter** | — |

### 3.4 What role for hairline vs shadow vs fill?

Think of the three as **three different messages**, and use exactly one per surface:

| cue | says | cost | when it is the right tool |
| --- | --- | --- | --- |
| **ΔL\* fill step** | "this is a *different material* / plane" | free (no paint), but fails below 2 L\* | large surfaces (> ~200 × 200 px): cards, composer, sidebar, code blocks, bubbles |
| **hairline** (0.5–1 px, ink @ 0.06–0.16) | "this is a *boundary*" | 1 px of paint; survives any ΔL\* | controls inside a card, table rows, tab underlines, dividers, drop zones, **and any pair within 2 L\*** |
| **shadow** | "this *floats above* and can be dismissed" | a blur radius of perceived grey; the only cue that implies z-order | menus, popovers, dialogs, tooltips, and any surface whose L\* is ≥ canvas (R3) |

**A border beats a fill change whenever ΔL\* < 2.** Concretely, in this app: the settings nav cells
inside a card, the message-action row, the code-block header strip inside a code block, and the
composer's *input field* sitting inside the composer card (which is already a raised surface).

**Never stack all three.** The composer already carries `box-shadow: var(--dsw-elevation-soft)`
(`0 0 0 .5px <stroke>, 0 4px 16px #00000008, 0 0 24px #00000008`) **and**
`--dsw-elevation-stroke-color: var(--dsw-alias-border-l2)`. That is a hairline **and** a shadow
already. Adding an 85 %-toward-white fill on top makes the composer the *brightest, lightest,
least-saturated* object on a cream page — three wrong signals reinforcing each other. **Remove the
fill step, keep the shadow, and let the composer be 2–3 L\* darker than the page.** That is the fix.

**Also: tint the shadow.** The shipped shadow colours are literal `#00000008` (3 % black). On warm
paper a black shadow produces a *grey* halo, which is a subtle cool cast around every raised
surface. Use the theme ink at the same alpha (e.g. `#33302a0f`) — the shadow then reads as a
warm-shade rather than a grey smudge. The shadow *colour* is only reachable via
`--dsw-elevation-stroke-color` and the literal alphas inside `gradient-shadow-text.css`, which
re-declares `--dsw-elevation-*` on `body, body *` (see `docs/surface-map.md` §5.3) — so this is a
ship-your-own-CSS change, not a token override. Worth doing; the token-level equivalent is to keep
the composer's ΔL\* step small enough that the shadow is not carrying the whole elevation.

### 3.5 Quantified answers

* **Maximum L\* for a raised light-mode surface: 98.5.** Above that, R4's inequality
  (`L* + 100·C ≤ 99.8` at hue 85°) leaves you at most `C ≈ 0.013`, and any further push is white by
  force. **Minimum chroma for a raised warm surface: 0.008**, and it should be ≥ 0.85 × the canvas
  chroma.
* **Direction: darker** for content surfaces; **lighter, bounded and chroma-preserved** for floating
  surfaces only.
* **Step: ΔL\* 2.0** nominal, 1.5 floor, 3–4 for a separate plane, 6 ceiling.
* **Hairline vs fill:** hairline when ΔL\* < 2; fill when ΔL\* ≥ 2; shadow only when the surface
  floats.

---

## 4. Chroma and hue discipline

### 4.1 How much chroma before a neutral looks dirty or sickly?

Two failure modes, with numbers:

* **Too much → "dirty / sickly / sticky-note".** Above about **OKLCH C 0.035** at near-white L\*, a
  neutral stops reading as *paper* and starts reading as a *tint*. For calibration: Gruvbox
  `#fbf1c7` is `C 0.0555` and Kanagawa Lotus `#f2ecbc` is `C 0.0625` `[computed]` — both are
  *deliberately* vintage and are the ceiling, not the norm. A UI canvas should be well below.
* **Too little → "the warmth vanished".** The warm/cool distinction at near-white is carried by
  ~0.001–0.005 of chroma. Carbon's warm and cool grays differ by **0.0013** at identical L\* 96.1
  (§2.4). Below **C 0.004** at L\* ≥ 96, "warm off-white" and "cool off-white" are the same colour.
  Below **C 0.008** a *raised* warm surface stops reading warm at all.

**Surface chroma table `[computed]` for the five proposals** (canvas / card / composer / overlay /
border):

| theme, light | canvas | card | composer | overlay | border | ink |
| --- | --- | --- | --- | --- | --- | --- |
| modern-classic | 0.0026 | 0.0040 | 0.0027 | 0.0026 | 0.0014 | 0.0097 |
| novel | 0.0261 | 0.0290 | 0.0291 | 0.0163 | 0.0143 | 0.0189 |
| calm | 0.0085 | 0.0102 | 0.0085 | 0.0084 | 0.0052 | 0.0205 |
| deep-work | 0.0013 | 0.0013 | 0.0013 | 0.0013 | 0.0014 | 0.0061 |
| cream | 0.0127 | 0.0144 | 0.0140 | 0.0114 | 0.0072 | 0.0113 |

Note how flat each row is. That is R6 working: **the ramp holds chroma instead of bleeding it.**

**Text chroma: ≤ 0.022, and within ±0.015 of the canvas chroma.** Observed in the wild
`[computed]`: `#37352F` (Notion) 0.0107 · `#21201c` (Radix sand-12) 0.0076 · `#1c1917` (Tailwind
stone-900) 0.0061 · `#222222` (Obsidian, Gruvbox `#282828`) **0.0000** · `#5c6a72` (Everforest fg)
0.0212 · `#545464` (Kanagawa ink1) 0.0259 · `#4c4f69` (Catppuccin Latte text) 0.0430 · `#464261`
(Rosé Pine Dawn text) 0.0519. So 0.000 is fine (pure neutral ink on a warm page — Gruvbox, Obsidian)
and up to ~0.026 is fine; beyond 0.04 the *text itself* becomes a colour and competes with the
accent. Hence ≤ 0.022.

**Border chroma: ≤ 0.7 × canvas chroma**, typically 0.001–0.014. Observed: Radix sand-6 0.0042,
slate-6 0.0095, Tailwind stone-200 0.0026, Carbon warmGray-20 0.0056, Obsidian base-30 0.0000,
Everforest bg3 0.0215 `[computed]`. The reason is mechanical: **a hairline is 0.5–1 px of paint, so
its colour barely registers — but its *value* registers immediately.** Spend the budget on L\*, not
on chroma.

### 4.2 Should all neutrals share the canvas hue?

**Yes — for the surface ramp. Within 8°.** But *not* for text, and *not* for the accent.

* **Surface ramp: hold H exactly if you can.** Every reference that does this looks coherent:
  Catppuccin Latte is 265 throughout its whole ladder; Everforest light is 98–99 throughout;
  Kanagawa Lotus is 98–102; Carbon warmGray runs 17–34 (a 17° drift, but at C ≤ 0.006 it is
  invisible). The five proposals hold H exactly except where OKLCH→hex rounding moves it by 1–3°.
* **Hue drift budget:** `|ΔH| ≤ 8°` when `C ≥ 0.010`; `≤ 20°` when `C ≤ 0.005`. Tailwind `stone`
  drifts 106 → 48 → 73 → 34 across eleven steps and is fine, because C ≤ 0.013 and mostly ≤ 0.005.
* **Text: allowed to break hue deliberately.** Solarized's ink `#657b83` is H 222 on a H 90 page
  (**132° away**); Everforest's `#5c6a72` is H 233 on a H 98 page (**135° away**). A cool ink on warm
  paper is a classic, legible, and intentional pairing — it also gives you free contrast headroom.
  The alternative is a tonal ink (cream proposal: canvas H 87, ink H 85, ΔH 2°; Gruvbox: H 0 both).
  **Both work. Pick one and be consistent.** What fails is a *half-way* ink: 30–60° off, which reads
  as a muddy mismatch.

### 4.3 Accent saturation and count

**Exactly one primary accent, plus four semantic states, plus one monochrome ink.** Total five
chromatic families (ink is achromatic). Not ten, not "a palette of twelve".

Accent targets for a calm reading theme:

* **L\* 42–55 in light mode** — this is what makes it clear 4.5:1 on every paper in §4.4 without
  hand-tuning per theme.
* **OKLCH C 0.08–0.17** for calm; 0.17–0.25 if you want the accent to be a feature rather than a
  signal. For reference `[computed]`: Radix `bronze-11 #7d5e54` C 0.0438 and `gold-11 #71624b`
  C 0.0395 are *very* calm; `blue-11 #0d74ce` C 0.1622, `tomato-11 #d13415` C 0.1978,
  `iris-11 #5753c6` C 0.1739 are mid; Catppuccin `mauve #8839ef` C 0.2503 is loud.
* **Hue ≥ 30° from the canvas hue**, or 0–15° for a deliberate tonal scheme. On a H 85–90 cream
  page, anything in H 30–70 (clay/bronze/ochre/terracotta) or H 200–270 (deep blue/indigo/pine)
  separates cleanly; H 80–100 collides with the paper.

**Concrete accent hexes that sit well on warm paper** — every ratio below is **`[computed]`**
against the five proposal canvases:

| family | hex | source | on `#f7f3ea` (cream) | on `#f6f0e2` | on `#f6f6f5` | on `#fdf6e3` | on `#fffbef` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bronze | `#7d5e54` | Radix bronze-11 *(cited)* | 5.27 ✓ | 5.13 ✓ | 5.39 ✓ | 5.41 ✓ | 5.64 ✓ |
| gold / sepia ink | `#71624b` | Radix gold-11 *(cited)* | 5.34 ✓ | 5.20 ✓ | 5.47 ✓ | 5.48 ✓ | 5.72 ✓ |
| bronze-brown | `#8a6a3b` | *custom* (derived) | 4.51 ✓ | 4.39 | 4.62 ✓ | 4.63 ✓ | 4.83 ✓ |
| ochre | `#8a5a1e` | *custom* (current `deep-work` accent) | 5.32 ✓ | 5.19 ✓ | 5.37 ✓ | 5.47 ✓ | 5.70 ✓ |
| clay / terracotta | `#a04a2a` | *custom* (derived) | 5.41 ✓ | 5.27 ✓ | 5.54 ✓ | 5.55 ✓ | 5.79 ✓ |
| amber (light) | `#ab6400` | Radix amber-11 *(cited)* | 4.16 | 4.06 | 4.26 | 4.27 | 4.46 |
| oxblood | `#7a2e2a` | *custom* (derived) | 8.42 ✓ | 8.21 ✓ | 8.62 ✓ | 8.65 ✓ | 9.01 ✓ |
| tomato | `#d13415` | Radix tomato-11 *(cited)* | 4.50 ✓ | 4.39 | 4.61 ✓ | 4.62 ✓ | 4.82 ✓ |
| faded red | `#9d0006` | Gruvbox *(cited)* | 7.78 ✓ | 7.59 ✓ | 7.85 ✓ | 7.99 ✓ | 8.33 ✓ |
| kanagawa red | `#c84053` | Kanagawa Lotus *(cited)* | 4.24 | 4.14 | 4.33 | 4.34 | 4.55 ✓ |
| sage / moss | `#427b58` | Gruvbox faded_aqua *(cited)* | 4.51 ✓ | 4.39 | 4.62 ✓ | 4.63 ✓ | 4.83 ✓ |
| green | `#218358` | Radix green-11 *(cited)* | 4.26 | 4.15 | 4.29 | 4.37 | 4.56 ✓ |
| grass | `#2a7e3b` | Radix grass-11 *(cited)* | 4.57 ✓ | 4.46 | 4.68 ✓ | 4.70 ✓ | 4.90 ✓ |
| kanagawa green | `#6f894e` | Kanagawa Lotus *(cited)* | 3.35 | 3.26 | 3.37 | 3.38 | 3.53 |
| pine | `#286983` | Rosé Pine Dawn *(cited)* | 5.51 ✓ | 5.37 ✓ | 5.65 ✓ | 5.66 ✓ | 5.90 ✓ |
| kanagawa blue | `#4d699b` | Kanagawa Lotus *(cited)* | 4.98 ✓ | 4.85 ✓ | 5.10 ✓ | 5.11 ✓ | 5.33 ✓ |
| deep indigo | `#2f4b8f` | *custom* (derived) | 7.51 ✓ | 7.32 ✓ | 7.69 ✓ | 7.71 ✓ | 8.04 ✓ |
| iris | `#5753c6` | Radix iris-11 *(cited)* | 5.48 ✓ | 5.34 ✓ | 5.62 ✓ | 5.63 ✓ | 5.87 ✓ |
| primer blue | `#0969da` | Primer *(cited)* | 4.69 ✓ | 4.57 ✓ | 4.80 ✓ | 4.81 ✓ | 5.02 ✓ |
| solarized blue | `#268bd2` | Solarized *(cited)* | 3.32 | 3.24 | 3.40 | 3.41 | 3.56 |
| solarized orange | `#cb4b16` | Solarized *(cited)* | 4.16 | 4.06 | 4.26 | 4.27 | 4.45 |

**Pairings I would actually ship:**

| paper | primary accent | why |
| --- | --- | --- |
| **cream** `#f7f3ea` (H 87, yellow) | **clay `#9a5a2a`** or bronze `#8a6a3b` | H 55/76 — 15–30° off, so it reads as the *same family*, deepened. Warm-on-warm stays calm. |
| **novel** `#fdf6e3` (H 90) | **bronze `#7d5e54`** or oxblood `#7a2e2a` | leather-and-ink. High ratio, low chroma, zero competition with the paper. |
| **calm** `#eef3ee` (H 146, sage) | **moss `#427b58`** or a cool **pine `#286983`** | moss is complementary-adjacent and recedes; pine gives the accent somewhere to go. |
| **deep-work** `#f5f5f4` (H 106, near-neutral) | **sepia-ink gold `#71624b`** | the only chromatic family in a monochrome theme, so it must be quiet. |
| **modern-classic** `#f9f9fb` (H 286, cool) | **deep indigo `#2f4b8f`** or `#0969da` | the cool theme gets the cool accent. Do not put clay on a cool page. |

*(derived)* values above are shifted versions of cited scale steps, adjusted in OKLCH to land at a
target contrast; they are not official.

### 4.4 Semantic colours on warm paper, and the warning trap

**The warning trap.** Amber is intrinsically the *lightest* of the semantic hues and warm paper is
intrinsically light, so warning-on-cream collapses. Measured **`[computed]`**:

| | on `#f7f3ea` | on `#fdf6e3` | on `#fffbef` |
| --- | --- | --- | --- |
| shipped `state-warn-primary` `#f59e0b` | 1.94 ✗ | 1.99 ✗ | 2.08 ✗ |
| shipped `state-warn-label` `#dd8629` | 2.52 ✗ | 2.59 ✗ | 2.70 ✗ |
| Tailwind `amber-600 #d97706` | 2.88 ✗ | 2.95 ✗ | 3.08 |
| Radix `amber-11 #ab6400` | 4.16 | 4.27 | 4.46 |
| Tailwind `amber-700 #b45309` | **4.53 ✓** | 4.66 ✓ | 4.85 ✓ |
| *custom* `#8a5a1e` | **5.32 ✓** | 5.47 ✓ | 5.70 ✓ |
| Gruvbox `faded_yellow #b57614` | 3.41 | 3.50 | 3.65 |

**The fix, in three parts:**

1. **Split "warning" into two tokens that already exist.** `state-warn-primary` /
   `-secondary` / `-tertiary` are **fills** (banner background, badge background). Keep them
   saturated — `#f59e0b` at 1.94:1 is *fine* as a 40 × 40 px badge fill. `state-warn-label` is a
   **text** token. Repoint it to `#b45309` (Tailwind amber-700, *cited*) for a light paper. That one
   change takes warning text from 2.52:1 to 4.53:1.
2. **Always pair a warm fill with a dark warm text.** `#f59e0b` fill + `#8a5a1e` text on it =
   **`[computed]` 3.05:1** — still short. Use `#4f3422` (Radix amber-12, *cited*) on `#fff7c2`
   (Radix amber-3) = **7.9:1** `[computed]`. That is the Notion pattern done right.
3. **Never let warning carry meaning by hue alone.** Add the icon and a text prefix; the warm page
   compresses the perceptual gap between amber, orange and red. The fills `#f59e0b` and `#cb4b16` are
   only **ΔH 27°** apart on a yellow page.

**Error, success and info**, adjusted per paper — recommended replacements and their
**`[computed]`** ratio on each proposal canvas:

| state | shipped (light) | on `#f7f3ea` | **use instead** | on `#f7f3ea` | on `#eef3ee` | on `#f5f5f4` | on `#fdf6e3` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| error | `#ec1313` | 4.06 | `#b3261e` | **5.90 ✓** | 5.95 ✓ | 6.04 ✓ | 6.06 ✓ |
| error (alt) | | | `#9d0006` (Gruvbox) | 7.78 ✓ | 7.85 ✓ | 7.97 ✓ | 7.99 ✓ |
| success | `#22c55e` | 2.06 | `#427b58` (Gruvbox) | **4.51 ✓** | 4.55 ✓ | 4.62 ✓ | 4.63 ✓ |
| success (alt) | | | `#218358` (Radix) | 4.26 | 4.29 | 4.36 | 4.37 |
| warning text | `#dd8629` | 2.52 | `#b45309` | **4.53 ✓** | 4.57 ✓ | 4.64 ✓ | 4.66 ✓ |
| warning text (alt) | | | `#8a5a1e` | 5.32 ✓ | 5.37 ✓ | 5.45 ✓ | 5.47 ✓ |
| info / link | `#4176e6` | 3.45 | `#2f5fa8` | **5.5 ✓** | 5.55 ✓ | 5.63 ✓ | 5.65 ✓ |
| info (alt) | | | `#286983` (Rosé Pine) | 5.51 ✓ | 5.65 ✓ | 5.66 ✓ | 5.66 ✓ |

**Never "warm-tint" a semantic colour by rotating its hue toward the paper.** A green shifted toward
olive (`#8da101`, Everforest) reads as *sick*, not as *success*, and it drops to 2.81:1 on `#fffbef`
`[computed]`. Adjust **L\* and chroma only** — keep the hue where the user's colour vocabulary
expects it. Error at H 25–30, success at H 145–160, warning at H 50–70, info at H 230–260. On a
yellow page (H 85–90) those are all ≥ 55° away, which is exactly what you want.

---

## 5. Text and legibility

### 5.1 The contrast ladder, and why caption may sit below 4.5:1

| tier | role | target vs canvas | absolute floor | WCAG status |
| --- | --- | --- | --- | --- |
| `label-primary` | body, headings, user content | **11–17 : 1** | 7:1 | AAA for normal text |
| `label-secondary` | descriptions, inactive tabs, timestamps users act on | **5.7–6.5 : 1** | 4.5:1 | AA |
| `label-tertiary` | hints, placeholders, keyboard hints | **3.6–4.0 : 1** | 3:1 | AA-large only |
| `label-caption` | **non-essential** metadata (token counts, model badges, "edited") | **2.2–2.5 : 1** | 2:1 | below AA by design |
| `label-dimmed` | disabled / unavailable | **1.3–1.8 : 1** | — | exempt (inactive control) |

**Why `label-caption` is allowed below 4.5:1.** WCAG 1.4.3 exempts "incidental" text — text that is
decoration or that no one needs in order to use the interface. The caption tier exists precisely for
that class of content: it is *deliberately* recede-able, and its job is to be present-but-ignorable.
The rule that keeps this honest is a **promotion rule**, not a ratio:

> If a user must read it to complete a task, it cannot live in the caption tier. Move it to
> `label-tertiary` (≥ 3:1) or `label-secondary` (≥ 4.5:1).

Two corroborating data points from shipping products **`[computed]`**: Obsidian's `text-faint` is
**2.30:1** in light and **2.90:1** in dark; Everforest's `grey0` on `bg0` is **2.17:1**;
Gruvbox's `gray_244` on `light0` is **3.24:1**; Solarized's `base1` on `base3` is **2.48:1**.
Every one of these is a deliberate "faint" tier, and every one is below 4.5:1. Meanwhile the tiers
users *act on* are all comfortably above: Radix `sand-11` **5.73:1**, Primer `fgColor-muted`
**6.11:1**, Obsidian `text-muted` **6.69:1**, Carbon `warmGray-70` **7.08:1**.

**Where the current implementation is right and where it is thin.** The `reach(canvas, ink, target)`
solver is a good idea and the *values* are correct. Two gaps:

1. **Everything is solved against the canvas only.** The composer, card and bubble are all lighter
   than the canvas today, which *raises* text contrast — so it looks fine. Once surfaces go **darker**
   than the canvas (R2), contrast drops. In the cream proposal, `secondary` measures **5.73:1** on
   the canvas but **5.23:1** on the composer and **4.92:1** on the bubble `[computed]`. Solve text
   tiers against the **darkest surface the tier appears on** (usually `bubble` or `higher`), not the
   canvas. Reserve ~0.3 ratio points of margin.
2. **The dark ladder is solved too high.** `5.7 / 3.6 / 2.1` in light is close to the built-in
   palette; the dark targets `12 / 8.4 / 4.8` are chosen to *match* the built-in dark palette, but
   the built-in dark palette's own secondary is 12.11:1 against a canvas at L\* 6.8. Once the warm
   dark canvas moves to L\* 9–11, the same ratios require a *lower* ink L\*, which the solver handles
   — but the **caption tier must stay ≥ 4.5:1 in dark** (it lands at 4.80–4.85 in every proposal
   `[computed]`), because dark-mode captions sit on a low-luminance field where small type is already
   fighting halation.

### 5.2 The warm dark ramp

Given the brief's `#1b1917` canvas. Full proposal **`[computed]`**, with the light-mode pair shown
alongside so the two modes can be checked for symmetry:

| role | light | dark | dark ΔL\* from canvas | dark OKLCH |
| --- | --- | --- | --- | --- |
| canvas | `#f7f3ea` | **`#1b1917`** | 0 | `21.5 % 0.0050 68` |
| sidebar | `#f1ece1` | `#161413` | −2.4 | `19.3 % 0.0038 49` |
| composer | `#ede9df` | `#22201e` | +3.5 | `24.5 % 0.0048 68` |
| card | `#f1ece2` | `#242220` | +4.5 | `25.3 % 0.0048 68` |
| nested / higher | `#ece7dc` | `#2d2b29` | +8.8 | `29.0 % 0.0046 68` |
| overlay / popover | `#fcf8f0` | `#302f2d` | +10.5 | `30.5 % 0.0038 85` |
| code block | `#e9e4d8` | `#201e1c` | +2.5 | `23.6 % 0.0049 68` |
| user bubble | `#e9e2d3` | `#292623` | +6.5 | `27.1 % 0.0071 68` |
| border | `#d1cfca` | `#363431` | +12.9 | `32.6 % 0.0059 78` |
| text primary | `#33302a` (11.87:1) | `#ece5da` (**14.01:1**) | +82.3 | `92.4 % 0.0166 79` |
| text secondary | `#635f59` (5.73:1) | `#d7d1c6` (**11.54:1**) | +75.1 | `86.2 % 0.0164 83` |
| text tertiary | `#827f78` (3.61:1) | `#b4afa6` (**8.03:1**) | +62.7 | `75.6 % 0.0139 82` |
| text caption | `#a9a59e` (2.21:1) | `#8a867f` (**4.84:1**) | +47.2 | `62.1 % 0.0114 82` |
| accent | `#9a5a2a` (4.90:1) | `#d9a273` (**7.82:1**) | +61.8 | `75.3 % 0.0903 61` |

**Dark-mode rules that differ from light:**

* **Direction inverts.** Raised = **lighter** (+2 to +13 L\*). This is universal: Obsidian
  `#1e1e1e → #262626` (+3.9), DSH shipped `#151517 → #232324` (+6.9), Catppuccin Mocha
  `#1e1e2e → #313244` (+9.3), Everforest dark `#272e33 → #374145` `[computed]`.
* **Sidebar goes darker still**, not lighter (cream `#1b1917 → #161413`, −2.4). A dark sidebar is a
  *recessed* column; a light sidebar is an *adjacent plane*. Both are legitimate; going down matches
  the light-mode behaviour and keeps the session list from glowing.
* **Chroma must stay at or below the light-mode chroma.** Warm dark is easy to over-saturate because
  the L\* range is compressed: the entire ramp lives inside L\* 8.9–21.8, i.e. **13 L\***
  `[computed]`, versus 96–98 in light. Keep canvas chroma ≤ 0.020 in dark, and prefer ≤ 0.010 —
  note every proposal's dark canvas is C 0.002–0.010 while its *dark text* runs 0.003–0.029
  `[computed]`, i.e. **in dark mode the warmth lives in the text, not the background.**
* **Text chroma should exceed canvas chroma in dark.** In light mode it is the reverse. The reason:
  a warm ink on a near-neutral dark ground reads as inviting; a warm ground with a neutral ink reads
  as muddy.

### 5.3 Must a warm dark theme raise its text tiers' contrast? — the honest answer

**Partly. The premise needs one correction, and then the answer is yes.**

**Correction:** WCAG contrast ratio is a function of relative luminance, and by definition CIE L\*
is also a function of relative luminance. **Two colours with the same L\* have the same Y and
therefore produce the same contrast ratio regardless of hue or warmth.** A warm ink at L\* 91.2 gives
exactly the same ratio as a cool ink at L\* 91.2. So the common claim "warm text is dimmer" is a
*perceptual* claim about chroma and about how the eye handles warm/cool adaptation, not a
contrast-ratio claim, and it cannot be fixed by raising contrast — raising contrast is what you do
if the ratio is genuinely too low.

But the ratio *is* genuinely lower, for a different and concrete reason:

> **Warm dark themes conventionally use a lighter canvas.** Measured canvases **`[computed]`**:
> GitHub dark `#0d1117` L\* **5.0**, DSH shipped `#151517` L\* **6.8**, Obsidian `#1e1e1e` L\*
> **11.3**, Catppuccin Mocha `#1e1e2e` L\* **12.0**, Kanagawa SumiInk3 `#1F1F28` L\* **12.1**,
> Gruvbox `dark0 #282828` L\* **16.1**, Everforest dark `bg0 #272e33` L\* **18.5**.

Because contrast is `(Y_text + 0.05) / (Y_bg + 0.05)`, and the warm canvases are two to three times
brighter in Y than the cold ones, the same ink yields a markedly lower ratio:

| | ink | canvas | ratio |
| --- | --- | --- | --- |
| cold | `#f9fafb` | `#151517` (L\* 6.8) | **17.45 : 1** |
| warm, same ink | `#f9fafb` | `#1b1917` (L\* 8.9) | 16.2 : 1 |
| warm, Gruvbox canvas | `#fbf1c7` | `#282828` (L\* 16.1) | **12.99 : 1** |
| warm, proposal | `#ece5da` | `#1b1917` (L\* 8.9) | 14.01 : 1 |
| warm ink on a Gruvbox-lightness canvas | `#ece5da` | `#282828` | **11.79 : 1** |

**So the rule is:**

1. **Keep the warm dark canvas at L\* ≤ 11.** That costs you only ~1.5 ratio points versus a cold
   dark theme, and you recover it with a slightly brighter ink. Every proposal obeys this.
2. **Raise the ink's L\*, not the canvas's**, if you want more contrast. Bumping the ink from
   `#e9e0cd`-grade to `#ece5da`-grade is free; bumping the canvas toward Gruvbox brightness costs
   2–3 ratio points. Budget **+2 to +3 L\*** on the ink relative to a cold-dark theme at the same
   canvas.
3. **Do keep at least three text tiers in dark**, and keep the caption tier **≥ 4.5:1**. This is the
   real difference from cold dark: warm dark canvases are lower-contrast *and* low-chroma, so
   mid-tone tiers compress perceptually. Obsidian's dark `text-faint #666666` on `#1e1e1e` is
   **2.90:1** `[computed]` and is widely disliked — do not copy that.
4. **Do not raise contrast by pushing the ink toward pure white.** At L\* ≥ 97 in a warm hue the ink
   loses its chroma (same gamut physics as R4, mirrored), and you get halation on dark backgrounds.
   The proposals' dark inks sit at L\* 88–93, chroma 0.003–0.029 — warm without glowing.

---

## 6. Anti-patterns

Nine ways an amateur warm theme looks cheap, each with the symptom, the mechanism, and the number
that fixes it.

### 6.1 Pure-white (or near-white) surfaces on a cream page
* **Symptom.** The composer, cards and popovers read as cold white patches; the warmth "switches off"
  when your eye crosses the boundary.
* **Why it happens.** Mixing toward `#ffffff`, which has chroma 0, divides the canvas chroma by `(1−w)`.
  At `w = 0.85` you keep **13.4 %** of it `[computed]`. Nothing about the *lightness* is wrong — the
  composer is only 3.4 L\* above the canvas — the *chroma* is gone.
* **Fix.** Surface chroma ≥ **0.85 × canvas chroma**; light-mode L\* ≤ **98.5**; derive by
  re-sampling in OKLCH, never by mixing to white (§1.2).

### 6.2 Pure-black text
* **Symptom.** Harsh, high-halation body text; on a cream page a `#000` glyph looks like a burnt
  hole rather than "ink".
* **Why it happens.** Copying a cold system's `fgColor-default`. Note that **no** paper-like theme
  does this: Notion `#37352F` (L\* 22.2), Radix sand-12 `#21201c` (12.2), Tailwind stone-900
  `#1c1917` (9.0), Gruvbox `#282828` (16.1, C 0), Solarized `#657b83` (50.2), Everforest `#5c6a72`
  (43.9) `[computed]`. The *only* themes that go near-black are the high-contrast ones (Obsidian
  `#222222` L\* 13.2, Primer `#1f2328` L\* 13.5, DSH shipped `#0f1115`).
* **Fix.** Ink at **L\* 8–22** with the theme's hue, **or** a cool ink at L\* 44–50 if you are doing
  the Solarized/Everforest "cool ink on warm paper" thing. The cream proposal's `#33302a` is
  L\* 20.0 / C 0.0113 / H 85 and gives 11.87:1.

### 6.3 Uniform saturation (the "one tint everywhere" look)
* **Symptom.** Every surface — page, card, border, bubble, code block — is the same distance from
  grey. It reads as a monochrome photo with a sepia filter, not as paper with things on it.
* **Why it happens.** One `mix()` parameter for everything.
* **Fix.** Deliberately stagger chroma. Target ratios relative to canvas: **sidebar × 1.3**,
  **card × 1.15**, **composer × 1.10**, **bubble × 1.6–1.8**, **code × 1.35**, **border × 0.55**,
  **text × 0.9–1.7**. Values in §4.1.

### 6.4 "Beige soup"
* **Symptom.** Cover the accent and the whole UI is one flat wash; you cannot tell the composer from
  the page at arm's length.
* **Why it happens.** Elevation was attempted with *the same* small chroma step at *the same*
  lightness — or worse, all surfaces were set to nearly identical hex.
* **Fix.** The elevation step must be **ΔL\* 2.0** (§3.3), and the whole ramp must contain at least
  **a 6 L\* spread** from canvas to the deepest surface (border excluded). Current modern-classic
  light spreads **1.0 L\*** across card→composer→higher `[computed]`. Cream spreads **3.4**. Target
  ~6–9.

### 6.5 Warm-tinting the semantic colours
* **Symptom.** Success that reads as "olive/mould", warning that reads as "the same as the paper",
  error that reads as "brown".
* **Why it happens.** Rotating semantic hues toward the page hue to "harmonise".
* **Fix.** Adjust **L\* and chroma only**; keep hue in band (error H 25–30, success H 145–160,
  warning H 50–70, info H 230–260). Verify with a number: Everforest's `#8da101` green on
  `#fffbef` is **2.81:1** and reads sick; Radix `green-11 #218358` is **4.56:1** and reads correct
  `[computed]`.

### 6.6 Using a shadow where a hairline belongs (and vice versa)
* **Symptom.** Soft grey halos around things that are not floating, or a 1 px line trying to say
  "this floats".
* **Why it happens.** Shadow = "elevated" as a reflex, without checking whether the surface can be
  dismissed or moved.
* **Fix.** Shadow only for **dismissible/floating** surfaces (menu, popover, dialog, tooltip). For
  everything else: **ΔL\* ≥ 2 → fill; ΔL\* < 2 → hairline.** And **never all three** — the composer
  currently has a fill step + a 0.5 px stroke + two shadows (see §3.4). Also **tint the shadow**:
  `#00000008` on cream produces a cool grey halo; use the ink hue at the same alpha.

### 6.7 Overshooting contrast so the page glares
* **Symptom.** Reading fatigue after ten minutes; the page feels like a light box; the user turns
  the brightness down.
* **Why it happens.** "Cream canvas + near-black text" reproduces white-page contrast levels without
  the white page's excuse. A cream canvas at L\* 96 with `#000` ink reaches **~19:1**.
* **Fix.** Cap primary text at **≤ 17:1** on warm paper. Concretely: ink at L\* 8–22 on a canvas at
  L\* 95–98 yields 11–17:1 `[computed]`. If you want a "high contrast" theme (`deep-work`), get the
  contrast from a **whiter canvas**, not a blacker ink: `#f5f5f4` + `#1c1917` = **16.03:1** — as
  high as the cream theme can usefully go, and it is comfortable.

### 6.8 Elevating by going lighter in light mode
* **Symptom.** Cards float above the page like stickers; the composer looks like a separate app.
* **Why it happens.** Porting the dark-mode convention to light mode, which is exactly what `up()`
  does. The doc comment in `client.js` even claims "raised surfaces go toward white in dark mode but
  toward ink in light mode" — the code does no such thing; `bg-layer-1/2/3` and `specific-input-major`
  all call `up()` in **both** modes.
* **Fix.** §3.1–3.4. Down for content, up (bounded) only for floating.

### 6.9 A three-level ladder whose levels are identical
* **Symptom.** `--dsw-alias-bg-layer-2` and `-layer-3` are the same colour; nesting is invisible.
* **Why it happens.** Successive `mix()` calls with growing weights converge to the same near-white.
  In modern-classic light: `+0.7, +0.3, +0.0, +0.0`; layer-2 and layer-3 are literally `#fefefe`
  and `#fefeff` `[computed]`.
* **Fix.** R8: absolute offsets from the canvas, never cumulative mixes. Assert in a test that
  `|L*(layer3) − L*(layer1)| ≥ 3.0`.

---

## 7. Five theme directions

Each is grounded in a §2 reference. All values are **`[computed]`** from the stated seeds by the
§1.2 recipe with gamut clamping, so they are internally consistent — every contrast and ΔL\* below
is machine-derived. Where two roles round to the same hex I say so.

### 7.1 `modern-classic` — cool neutral paper, deep indigo
**Character.** A cool, near-neutral sheet with the warmth turned almost off; high clarity, high
contrast, an institutional blue. Grounded in **Catppuccin Latte**'s ladder shape and **Radix
`slate`**'s values, with a **Radix Iris / custom indigo** accent.
**Light canvas** `#f9f9fb` (= Radix `slate-2`, *cited*). **Dark canvas** `#14161a`.

| role | light | dark | light L\* / C | dark L\* / C |
| --- | --- | --- | --- | --- |
| canvas | `#f9f9fb` | `#14161a` | 98.0 / 0.0026 | 7.2 / 0.0086 |
| sidebar | `#f2f2f5` | `#101114` | 95.6 / 0.0040 | 5.1 / 0.0064 |
| card (= raised surface) | `#f2f2f5` | `#1d1f23` | 95.6 / 0.0040 | 11.7 / 0.0082 |
| composer | `#efeff1` | `#1b1d21` | 94.5 / 0.0027 | 10.7 / 0.0083 |
| higher surface | `#ededef` | `#26282c` | 93.8 / 0.0027 | 16.1 / 0.0079 |
| popover / overlay | `#fbfbfd` | `#292b2f` | 98.7 / 0.0026 | 17.5 / 0.0078 |
| code block | `#eaeaec` | `#191b1f` | 92.7 / 0.0027 | 9.7 / 0.0084 |
| border | `#d5d5d6` | `#2e3035` | 85.3 / 0.0014 | 19.8 / 0.0094 |
| primary text | `#1c2024` | `#e9ecf0` | 12.0 / 0.0097 | 93.3 / 0.0063 |
| secondary text | `#616367` | `#cccfd3` | 41.9 / 0.0068 | 83.0 / 0.0064 |
| tertiary text | `#818387` | `#aaadb1` | 54.7 / 0.0065 | 70.6 / 0.0067 |
| caption text | `#a9aaad` | `#818488` | 69.6 / 0.0044 | 55.0 / 0.0070 |
| accent | `#2f4b8f` | `#8fa7e0` | 33.2 / 0.1173 | 68.6 / 0.0875 |
| user bubble | `#e8e8ec` | `#202328` | 92.1 / 0.0054 | 13.6 / 0.0104 |

Ratios **`[computed]`**: primary 15.58:1 / 15.28:1 · secondary 5.72 / 11.59 · tertiary 3.61 / 8.04 ·
caption 2.21 / 4.82 · accent 7.91 / 7.57 · accent on the card 7.45 / 13.9.
*Caveat:* the light card and sidebar land on the same hex because the canvas chroma is only 0.0026;
nudge by ±1 in any channel if the distinction matters to you.

### 7.2 `novel` — aged sepia paper, bronze ink
**Character.** A yellowed, deliberately vintage sheet with ink that is brown rather than black; the
"old book" direction, turned all the way up but held back from Gruvbox's saturation. Grounded in
**Solarized `base3 #fdf6e3`** (identical to **Everforest material `bg0`**), **Everforest material
`bg2 #efebd4`** for the raised plane, **Radix `gold-12 #3b352b`** for ink and **Radix `bronze-11
#7d5e54`** for the accent.
**Light canvas** `#fdf6e3` (*cited*, twice). **Dark canvas** `#1c1a15`.

| role | light | dark | light L\* / C | dark L\* / C |
| --- | --- | --- | --- | --- |
| canvas | `#fdf6e3` | `#1c1a15` | 97.0 / 0.0261 | 9.3 / 0.0099 |
| sidebar | `#f8efd7` | `#161512` | 94.6 / 0.0330 | 6.8 / 0.0061 |
| card | `#f7efda` | `#25231e` | 94.6 / 0.0290 | 13.8 / 0.0096 |
| composer | `#f4ecd7` | `#23211c` | 93.5 / 0.0291 | 12.8 / 0.0097 |
| higher surface | `#f3ead2` | `#2e2c27` | 92.8 / 0.0331 | 18.0 / 0.0093 |
| popover / overlay | `#fffbef` | `#32302b` | 98.6 / 0.0163 | 19.9 / 0.0092 |
| code block | `#f0e7cd` | `#211f1b` | 91.7 / 0.0357 | 11.8 / 0.0080 |
| border | `#d6d2c8` | `#37352f` | 84.3 / 0.0143 | 22.2 / 0.0107 |
| primary text | `#3b352b` | `#e6dcc8` | 22.5 / 0.0189 | 88.1 / 0.0289 |
| secondary text | `#676154` | `#dbd2be` | 41.3 / 0.0215 | 84.4 / 0.0287 |
| tertiary text | `#878073` | `#b8af9f` | 53.8 / 0.0210 | 71.8 / 0.0246 |
| caption text | `#aea798` | `#8c8679` | 68.7 / 0.0226 | 56.1 / 0.0204 |
| accent | `#7d5e54` | `#c99a80` | 42.8 / 0.0438 | 67.3 / 0.0673 |
| user bubble | `#f1e5c5` | `#2a2720` | 91.1 / 0.0441 | 15.7 / 0.0132 |

Ratios **`[computed]`**: primary 11.25:1 / 12.78:1 · secondary 5.70 / 11.57 · tertiary 3.63 / 8.01 ·
caption 2.22 / 4.80 · accent 5.41 / 6.97 · accent on the card 5.09.
Note the `overlay #fffbef` — that hex is Everforest light-hard `bg0` (*cited*), so the popover is
literally a brighter sheet of the same paper. Chroma retention **62 %**, which is above the 0.85 × R6
floor only because the popover is allowed to be a different plane; if you want it stricter, use
`#fdf8e9`.

### 7.3 `calm` — low-contrast sage, muted moss
**Character.** A desaturated green-grey paper with a moss accent; the quietest of the five, and the
one designed to be looked at for hours. Grounded in **Everforest Light** (`bg_blue #ecf5ed`, `aqua
#35a77c`, `grey0 #a6b0a0`) and **Gruvbox `faded_aqua #427b58`** for the accent — the one accent in
this document that is simultaneously calm and legible (**4.51:1**).
**Light canvas** `#eef3ee`. **Dark canvas** `#121816`.

| role | light | dark | light L\* / C | dark L\* / C |
| --- | --- | --- | --- | --- |
| canvas | `#eef3ee` | `#121816` | 95.4 / 0.0085 | 7.6 / 0.0099 |
| sidebar | `#e6ede6` | `#0f1311` | 93.1 / 0.0119 | 5.5 / 0.0075 |
| card | `#e7ede7` | `#1b211f` | 93.2 / 0.0102 | 12.1 / 0.0095 |
| composer | `#e4e9e4` | `#191f1d` | 91.9 / 0.0085 | 11.1 / 0.0096 |
| higher surface | `#e1e8e1` | `#242a28` | 91.3 / 0.0120 | 16.4 / 0.0092 |
| popover / overlay | `#f3f8f3` | `#282d2b` | 97.1 / 0.0084 | 17.9 / 0.0079 |
| code block | `#dee4de` | `#171d1b` | 90.0 / 0.0103 | 10.1 / 0.0097 |
| border | `#cbcecb` | `#2b3330` | 82.5 / 0.0052 | 20.4 / 0.0122 |
| primary text | `#26332d` | `#dbe6e0` | 19.9 / 0.0205 | 90.3 / 0.0142 |
| secondary text | `#56615c` | `#c7d2cc` | 40.1 / 0.0158 | 83.2 / 0.0145 |
| tertiary text | `#77807b` | `#a6b0ab` | 52.7 / 0.0130 | 70.9 / 0.0132 |
| caption text | `#9ea6a1` | `#7e8682` | 67.4 / 0.0115 | 55.2 / 0.0111 |
| accent | `#417a57` | `#7fae91` | 47.0 / 0.0823 | 67.1 / 0.0658 |
| user bubble | `#dbe4db` | `#1d2523` | 89.7 / 0.0154 | 13.9 / 0.0120 |

Ratios **`[computed]`**: primary 11.73:1 / 14.05:1 · secondary 5.73 / 11.57 · tertiary 3.62 / 8.06 ·
caption 2.22 / 4.81 · accent **4.51 / 7.16** (Gruvbox `#427b58` gives 4.44:1 on this canvas — one
tick short; `#417a57` is the same colour darkened by 0.4 L\*) · accent on the card 4.75.
**This is the one theme where the accent is barely above AA — that is the point of the direction.**
If you need it safer, use `#3c7252` (≈5.0:1).

### 7.4 `deep-work` — near-monochrome stone, sepia-ink accent
**Character.** Almost colourless; a high-contrast neutral sheet whose only chromatic event is a
muted sepia-gold accent. The "no distractions" direction, and the only one that legitimately reaches
16:1. Grounded in **Tailwind `stone-100 #f5f5f4`** (canvas), **Tailwind `stone-900 #1c1917`** (ink),
**Tailwind `stone-200 #e7e5e4`** (bubble) and **Radix `gold-11 #71624b`** (accent) — all *cited*.
**Light canvas** `#f5f5f4`. **Dark canvas** `#0f0f0e`.

| role | light | dark | light L\* / C | dark L\* / C |
| --- | --- | --- | --- | --- |
| canvas | `#f5f5f4` | `#0f0f0e` | 96.5 / 0.0013 | 4.3 / 0.0020 |
| sidebar | `#eeeeed` | `#0a0a0a` | 94.1 / 0.0013 | 2.7 / 0.0000 |
| card | `#eeeeed` | `#181817` | 94.1 / 0.0013 | 8.2 / 0.0019 |
| composer | `#ebebea` | `#161615` | 93.0 / 0.0013 | 7.2 / 0.0020 |
| higher surface | `#e9e9e8` | `#20201f` | 92.3 / 0.0013 | 12.2 / 0.0019 |
| popover / overlay | `#fafaf9` | `#242423` | 98.2 / 0.0013 | 14.2 / 0.0018 |
| code block | `#e6e6e4` | `#141413` | 91.2 / 0.0027 | 6.3 / 0.0020 |
| border | `#d1d1d0` | `#282827` | 83.8 / 0.0014 | 16.1 / 0.0018 |
| primary text | `#1c1917` | `#e7e5e4` | 9.0 / 0.0061 | 91.1 / 0.0026 |
| secondary text | `#63605f` | `#cac8c7` | 41.0 / 0.0042 | 80.7 / 0.0026 |
| tertiary text | `#82807f` | `#a9a7a6` | 53.7 / 0.0029 | 68.6 / 0.0027 |
| caption text | `#a8a7a6` | `#817f7e` | 68.5 / 0.0018 | 53.3 / 0.0029 |
| accent | `#71624b` | `#c2ac8b` | 42.4 / 0.0395 | 71.4 / 0.0518 |
| user bubble | `#e4e4e3` | `#1b1b1a` | 90.6 / 0.0013 | 9.7 / 0.0019 |

Ratios **`[computed]`**: primary **16.03:1** / 15.27:1 · secondary 5.71 / 11.50 · tertiary 3.60 / 8.00 ·
caption 2.20 / 4.81 · accent 5.42 / 8.74 · accent on the card 5.09.
Note the sidebar and card coincide in light mode (chroma 0.0013 leaves no room) — acceptable here,
because in this direction "the card is the page, only the text matters". The dark canvas at L\* 4.3
is the darkest of the five, which is what buys 15.27:1.

### 7.5 `cream` — warm off-white 米白, clay accent
**Character.** The literal 米白: warm but restrained, closer to Carbon's `warmGray` band than to
Gruvbox; a clay accent that reads as the same family as the paper, deepened. Grounded in **Carbon
`warmGray-10 #f7f3f2`** *(cited — the industry's canonical warm off-white)*, **Rosé Pine Dawn**
(chroma-preserving ramp shape, and the pink-warm alternative), and **Radix `amber-11` / `gold`** for
the accent family.
**Light canvas** `#f7f3ea` (hue 87 — a yellow cream; Carbon's `#f7f3f2` at hue 34 is the pink-leaning
alternative, and the two are both defensible 米白). **Dark canvas** `#1b1917` (the brief's own value).

| role | light | dark | light L\* / C | dark L\* / C |
| --- | --- | --- | --- | --- |
| canvas | `#f7f3ea` | `#1b1917` | 95.9 / 0.0127 | 8.9 / 0.0050 |
| sidebar | `#f1ece1` | `#161413` | 93.5 / 0.0156 | 6.5 / 0.0038 |
| card | `#f1ece2` | `#242220` | 93.5 / 0.0144 | 13.4 / 0.0048 |
| composer | `#ede9df` | `#22201e` | 92.4 / 0.0140 | 12.4 / 0.0048 |
| higher surface | `#ece7dc` | `#2d2b29` | 91.8 / 0.0157 | 17.7 / 0.0046 |
| popover / overlay | `#fcf8f0` | `#302f2d` | 97.7 / 0.0114 | 19.4 / 0.0038 |
| code block | `#e9e4d8` | `#201e1c` | 90.7 / 0.0169 | 11.4 / 0.0049 |
| border | `#d1cfca` | `#363431` | 83.1 / 0.0072 | 21.8 / 0.0059 |
| primary text | `#33302a` | `#ece5da` | 20.0 / 0.0113 | 91.2 / 0.0166 |
| secondary text | `#635f59` | `#d7d1c6` | 40.5 / 0.0107 | 84.0 / 0.0164 |
| tertiary text | `#827f78` | `#b4afa6` | 53.3 / 0.0110 | 71.6 / 0.0139 |
| caption text | `#a9a59e` | `#8a867f` | 67.9 / 0.0110 | 56.1 / 0.0114 |
| accent | `#9a5a2a` | `#d9a273` | 44.7 / 0.1047 | 70.8 / 0.0903 |
| user bubble | `#e9e2d3` | `#292623` | 90.1 / 0.0215 | 15.4 / 0.0071 |

Ratios **`[computed]`**: primary 11.87:1 / 14.01:1 · secondary 5.73 / 11.54 · tertiary 3.61 / 8.03 ·
caption 2.21 / 4.84 · accent 4.90 / 7.82 · accent on the card 4.61.
This is the reference implementation of §1–§3: canvas chroma survives the whole light ramp within
**0.0072–0.0215** (never below 0.55 × canvas), the darkest light surface is **9.7 L\*** below the
canvas, and no light surface exceeds L\* 97.7.

### 7.6 How the five compare, and where the current instincts go wrong

| | canvas OKLCH C (light) | canvas hue | L\* spread canvas→deepest | primary text ratio | accent |
| --- | --- | --- | --- | --- | --- |
| modern-classic | 0.0026 | 286 | 5.9 | 15.58 | `#2f4b8f` |
| novel | 0.0261 | 90 | 5.9 | 11.25 | `#7d5e54` |
| calm | 0.0085 | 146 | 5.7 | 11.73 | `#417a57` |
| deep-work | 0.0013 | 106 | 5.9 | 16.03 | `#71624b` |
| cream | 0.0127 | 87 | 5.9 | 11.87 | `#9a5a2a` |
| **current `cream`** | 0.0127 | 87 | **0 (all surfaces lighter)** | 12.83 | `#a8703f` |
| **current `novel`** | 0.0196 | 88 | **0** | 11.85 | `#8f4632` |

Where the current implementation's instincts go wrong, in priority order:

1. **`up()` is the whole problem.** `up(0.55/0.72/0.85)` mixes toward `#ffffff` in light mode, so all
   four raised surfaces are *lighter* than the canvas and 57–87 % of the canvas chroma is destroyed
   (§6.1, §6.8). The composer is `#fefdfc` at chroma 0.0017 against a canvas at 0.0127.
2. **The ladder converges instead of stepping.** `bg-layer-2` and `bg-layer-3` are ΔL\* 0.0 apart in
   every light theme (§6.9). The three-level hierarchy does not exist in light mode.
3. **The dark ladder is the right shape at the wrong scale.** `up(0.035/0.07/0.105)` in dark gives
   +4.0 / +3.9 / +3.9 ΔL\* — correct direction, but *fixed fractions of the canvas* rather than fixed
   L\* offsets, so the steps vary between themes (cream +4.0/+3.8/+3.7, deep-work +3.3/+4.4/+4.0).
   Use absolute offsets.
4. **`bg-layer-*` and `specific-input-major` are the same colour as `button-elevated-fill` and
   `switch-thumb`** in light mode — five distinct semantic roles collapse onto two nearly-white
   hexes.
5. **The seed colours carry all the theme's character and the derived surfaces carry none.** Every
   light theme's charisma is in the 6 seeds; the ~100 derived tokens are grey-white. The fix is to
   move the charisma into the *recipe* (§1.2), not into more seeds.
6. **The semantic colours are explicitly inherited from a cool palette** (the `buildTokens` comment
   says so), which is the §6.5 anti-pattern by construction. `state-warn-label #dd8629` is 2.52:1 on
   the cream canvas.
7. **Hairlines are correct.** `alpha(ink, w)` is the right construction and matches the shipped
   palette and Radix. Leave `border-l1..l4` and `border-l2-darkmode-thin` alone apart from the
   `l2`-equals-`l1`-in-light collision noted in `docs/token-inventory.md` §4.4.
8. **The `reach()` text solver is correct.** Keep it, but re-solve against the darkest surface each
   tier appears on, not the canvas (§5.1).

---

## 8. Corrections to the live seeds

**Supersedes §7's hex tables for implementation.** §7 remains the reference-grounded derivation and
the reasoning still holds; §8 is measured against the seeds the code actually uses now
(`canvas / surface / sidebar / bubble / ink / accent`, surface = top of the interpolated ramp).
Every number below is **`[computed]`** with exact CIE L\* targeting.

### 8.1 (a) Light `surface` — what it should be

Measured state of the current seeds:

| theme | canvas | L\* | C | current `surface` | ΔL\* | chroma retained | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cream | `#f7f3ea` | 95.9 | 0.0127 | `#fdfbf5` | **+2.7** | **0.65 ×** | ΔL\* ok, chroma fail, L\* 98.6 over the wall |
| novel | `#f6f0e2` | 94.9 | 0.0196 | `#fcf8ec` | **+2.7** | 0.83 × | ΔL\* ok, chroma marginal |
| calm | `#f2f5f2` | 96.2 | 0.0051 | `#fafcfa` | +2.5 | **0.66 ×** | chroma fail, L\* 98.8 over the wall |
| modern-classic | `#fbfbfc` | **98.6** | 0.0013 | `#ffffff` | **+1.4** | **0.00 ×** | step below the JND floor **and** the canvas is too light to lift |
| deep-work | `#f6f6f5` | 96.9 | 0.0013 | `#ffffff` | +3.1 | **0.00 ×** | pure white |

**Direction is right for the three warm themes** — going up is permissible on paper (§3.2, Rosé Pine
Dawn does the same). The magnitudes are mostly right too. **Two things are wrong:**

1. **Every one of the five loses chroma on the way up** (0.65×, 0.83×, 0.66×, 0.00×, 0.00×). R6's
   floor is 0.85×. That is the whole remaining defect — see §8.5.
2. **The L\* ceiling is being crossed.** cream's `#fdfbf5` (98.6) and calm's `#fafcfa` (98.8) are past
   R4's L\* ≤ 98.5 wall; `#ffffff` is literally at the wall.

**Corrected light `surface` seeds — canvas unchanged:**

| theme | canvas | **`surface`** | L\* | ΔL\* | chroma retained | `L*+100C` vs 99.8 |
| --- | --- | --- | --- | --- | --- | --- |
| cream | `#f7f3ea` | **`#fcf8f0`** | 97.7 | **+1.8** | **0.90 ×** | 98.8 ✓ |
| novel | `#f6f0e2` | **`#fcf6e9`** | 97.0 | **+2.1** | **0.93 ×** | 98.9 ✓ |
| calm | `#f2f5f2` | **`#f7f9f7`** | 97.7 | **+1.5** | 0.66 × *(see below)* | 98.1 ✓ |
| modern-classic | `#fbfbfc` | **`#f4f5f7`** *(darker)* **or** lower the canvas — see 8.2 | 96.5 | −2.1 | 2.2 × | — |
| deep-work | `#f6f6f5` | **`#f9f9f8`** | 97.9 | **+1.0** | 1.00 × | 98.0 ✓ |

Three notes on that table:

* **calm cannot reach 0.85 ×.** Its canvas chroma is only 0.0051, and above L\* 97.5 the sRGB 8-bit
  grid quantises chroma in steps of **~0.0006–0.0013** `[computed]` — that is 12–25 % of calm's
  entire canvas chroma per channel step. The nearest achievable values are `#f7f9f7` (0.0034),
  `#f6faf6` (0.0051) and `#f5fbf5` (0.0068); there is nothing in between. **If you want a warm
  surface to hold its chroma, put it at L\* ≤ 97.0, where the 8-bit grid is finer.** `#f6faf6`
  (ΔL\* +1.0, chroma 1.00 ×, hue 146) is the R6-clean answer for calm if you accept a smaller step.
* **modern-classic's canvas is the problem, not its surface.** At L\* 98.6 the only place left to go
  is 99–100, i.e. white. There are exactly two honest fixes, and I recommend the first:
  **(i) lower the canvas to L\* 97.0** → `#f4f5f7` canvas (that is also the value its `sidebar` seed
  already uses, so pick a new sidebar, e.g. `#ecedf1`) and surface `#f9fafc` (L\* 98.0, ΔL\* +1.0) —
  a perceptible step with real chroma; or **(ii) keep the canvas and accept `surface` darker than the
  canvas** (`#f4f5f7`), which contradicts the ramp's direction but is visually correct.
* **deep-work's +3.1 L\* to pure white is the wrong kind of step.** `#f9f9f8` (ΔL\* +1.0) is
  conservative; if you want a bigger step on a near-neutral paper you must **lower the canvas**:
  `#f2f2f1` (L\* 95.2) with surface `#fafaf9` (L\* 98.2, ΔL\* +3.0) both holds chroma and steps
  clearly. That is the trade: **on the two near-white themes, step size and chroma retention are in
  direct competition, and chroma should win.**

**If you want a genuine three-stop lightness ladder,** you must drop the canvas ~1 L\* and spend the
whole headroom. Computed `[computed]`:

| theme | lowered canvas | card (+2.0) | surface top (+4.0) | top's L\* | `L*+100C` |
| --- | --- | --- | --- | --- | --- |
| cream | `#f4f0e7` (94.9) | `#faf6ed` | `#fffbf3` | 98.7 | 99.9 ✗ marginal |
| novel | `#f3eddf` (93.9) | `#faf3e4` | `#fef8eb` | 97.7 | 99.5 ✓ |
| calm | `#f0f3f0` (95.2) | `#f5f9f5` | `#fbfdfb` | 99.1 | 99.4 ✗ |
| modern-classic | `#f8f8f9` (97.6) | `#fdfdfe` | `#ffffff` | **100.0** | 100.0 ✗ |
| deep-work | `#f4f4f3` (95.9) | `#f9f9f8` | `#fffffe` | **100.0** | 100.1 ✗ |

**Only `novel` supports a clean three-stop lighter ladder.** For cream, calm, modern-classic and
deep-work: **use two lightness stops (canvas → surface) and express the card / composer / nested
distinction with chroma and hairlines instead of more lightness** — otherwise you re-create the
0.0-ΔL\* collapse described in §6.9.

### 8.2 (a) direction and magnitude — the direct answers

* **Wrong direction:** none of the five, *as a choice*. Lifting the surface is defensible on paper.
* **Wrong magnitude (too shallow):** `modern-classic` at **ΔL\* +1.4** — below the 1.5 perceptual
  floor, so the raised plane is invisible. Its surface is also `#ffffff`, i.e. the ladder terminates
  at the wall.
* **Wrong magnitude (too deep for the canvas):** `deep-work` at **+3.1** to pure white. Reduce to
  +1.0 or lower the canvas to buy the step back.
* **Past the ceiling:** `cream` 98.6, `calm` 98.8, `modern-classic` 100.0, `deep-work` 100.0.
  Only `novel` (97.6) is inside the wall.
* **Chroma loss on the way up:** all five, 0.00 ×–0.83 ×. This is the one systematic error.

### 8.3 (b) Dark `surface`

Measured:

| theme | canvas | L\* | current `surface` | ΔL\* | chroma | hue shift |
| --- | --- | --- | --- | --- | --- | --- |
| cream | `#1b1917` | 8.9 | `#3d3831` | **+14.9** | 2.77 × | 68° → 76° |
| novel | `#1d1a15` | 9.4 | `#3d372c` | **+13.9** | 1.92 × | 81° → 83° |
| calm | `#111614` | 6.7 | `#2c352f` | **+14.4** | 1.87 × | 169° → **156°** |
| modern-classic | `#15171b` | 7.7 | `#35393f` | **+16.1** | 1.38 × | 264° → 258° |
| deep-work | `#0c0e11` | 3.9 | `#2b3037` | **+15.7** | 2.02 × | 258° → 257° |

**Magnitude is correct.** These are top-of-ramp values, and the band is right: M3's dark
`surfaceContainerHighest` is tone 22 against a tone-6 surface, i.e. **+16** *(cited)*; the old
implementation's `bg-layer-3` topped out at **+11.8** `[computed]`. **+14 ± 1.5 is the right target,
and 4 of your 5 are inside it.** `modern-classic` at +16.1 and `deep-work` at +15.7 are a touch high
but acceptable; if you want them calmer, pull to +14.5.

**Two things to fix:**

1. **Chroma is over-boosted and the hue drifts.** 1.87 ×–2.77 × is 1.5–2 × past the recommended
   1.3 ×, and `calm` shifts **13°** (169° → 156°) — over the 8° budget at C ≥ 0.010. Build the dark
   surface by holding the canvas hue and raising chroma **~1.3 ×**, don't pick it by eye.
2. **`deep-work`'s dark sidebar is only −1.2 L\*** — below the JND floor. Either go to **−2.2** or
   deliberately make it *lighter* than the canvas; −1.2 is the one value that is neither.

Corrected dark `surface` seeds **`[computed]`**:

| theme | canvas | **`surface`** | L\* | ΔL\* | chroma | hue held |
| --- | --- | --- | --- | --- | --- | --- |
| cream | `#1b1917` | **`#393633`** | 22.8 | **+13.9** | 1.34 × | 68° ✓ |
| novel | `#1d1a15` | **`#3b3730`** | 23.3 | **+13.8** | 1.25 × | 82° ✓ |
| calm | `#111614` | **`#2c3431`** | 20.9 | **+14.2** | 1.40 × | 171° ✓ |
| modern-classic | `#15171b` | **`#313439`** | 21.6 | **+13.9** | 1.14 × | 261° ✓ |
| deep-work | `#0c0e11` | **`#292c30`** | 17.9 | **+13.9** | 1.18 × | 256° ✓ |

Intermediate dark stops at the same chroma policy: **card `+4.9 … +5.2`**, **bubble `+6.9 … +7.4`**,
**sidebar `−2.0 … −2.5`**.

**Warning about the dark top-of-ramp:** because it sits ~14 L\* above the canvas, **a text tier solved
against the canvas will fail on it.** Measured **`[computed]`**, with the caption tier solved to
4.8:1 against the canvas:

| theme | caption on canvas | caption on the +14 surface |
| --- | --- | --- |
| cream | 4.84 : 1 | **3.31 : 1** ✗ |
| novel | 4.81 : 1 | **3.28 : 1** ✗ |
| calm | 4.82 : 1 | **3.37 : 1** ✗ |
| modern-classic | 4.85 : 1 | **3.38 : 1** ✗ |
| deep-work | 4.81 : 1 | **3.49 : 1** ✗ |

**In dark mode, solve every text tier against the top of the ramp, not the canvas** — or reduce the
top of the ramp. This is the dark-mode version of §5.1's point.

### 8.4 (c) `sidebar` and `bubble`

**Light `sidebar`: keep all five.** They are all 2.1–3.1 L\* darker than the canvas with chroma
raised 1.3–2.2 ×, which is exactly right — a sidebar is a recessed column, and the value step alone
reads clearly.

| theme | current | ΔL\* | chroma | verdict |
| --- | --- | --- | --- | --- |
| cream | `#f2ece0` | −2.4 | 1.36 × | ✓ |
| novel | `#efe7d5` | −3.1 | 1.30 × | ✓ (a touch deep; −2.5 is calmer) |
| calm | `#eaefea` | −2.3 | 1.68 × | ✓ |
| modern-classic | `#f4f5f7` | −2.1 | 2.18 × | ✓ (but collides with the canvas if you adopt 8.1's fix — use `#ecedf1`) |
| deep-work | `#eeeeec` | −2.8 | 2.01 × | ✓ |

**Light `bubble`: all five are acceptable**, none too far or too close. The two I would nudge are
`calm` (−3.4) and `modern-classic` (−3.6) toward **−4.7**, so the bubble separates from the *sidebar*
as well as from the canvas; as it stands, sidebar and bubble sit on nearly the same L\*, and in a chat
transcript the bubble needs to read as a distinct object.

| theme | current | ΔL\* | chroma | recommended | ΔL\* |
| --- | --- | --- | --- | --- | --- |
| cream | `#f0e7d6` | −4.0 | 1.94 × | `#ece5d6` | −4.8 |
| novel | `#ede2cc` | −4.7 | 1.61 × | `#ece2ca` | −4.8 |
| calm | `#e6ece7` | −3.4 | 1.82 × | `#e3e8e3` | −4.7 |
| modern-classic | `#eef1f6` | −3.6 | 5.64 × | `#ededef` | −4.8 |
| deep-work | `#e9e9e6` | −4.6 | 3.03 × | `#e9e9e7` | −4.6 |

**Dark `sidebar`: fix `deep-work` only.** cream −2.5 ✓ · novel −2.5 ✓ · calm −1.7 (borderline;
−2.0 is better) · modern-classic −1.9 ✓ · **deep-work −1.2 ✗ → −2.2** (`#050607`).

**Dark `bubble`: all five are good** (+5.2 to +7.9, chroma 1.3–2.1 ×).

**Text safety on the bubble** (light), solving the secondary tier to 4.9:1 **against the bubble**
since the bubble is the darkest surface the transcript's text sits on **`[computed]`**:

| theme | ink-on-bubble | secondary solved on the bubble |
| --- | --- | --- |
| cream | 11.33 : 1 | `#666158` (4.90:1) |
| novel | 10.45 : 1 | `#655f53` (4.92:1) |
| calm | 9.94 : 1 | `#5b6460` (4.92:1) |
| modern-classic | 15.22 : 1 | `#65666a` (4.90:1) |
| deep-work | 15.55 : 1 | `#636363` (4.94:1) |

### 8.5 (d) Accents

Two of the five fail 4.5:1 on their own paper. Measured against the **actual** canvases
**`[computed]`**:

| theme | current | ratio | verdict | **use** | ratio |
| --- | --- | --- | --- | --- | --- |
| cream | `#a8703f` | **3.75 : 1** | ✗ fails AA for text/links | **`#9a5a2a`** | **4.90 : 1** |
| cream (alt) | | | more saturated clay | `#a3521f` | 5.01 : 1 |
| novel | `#8f4632` | **5.98 : 1** | ✓ **keep — the best of the five** | `#8f4632` | 5.98 : 1 |
| calm | `#4f7d68` | **4.28 : 1** | ✗ just short | **`#3f7059`** | **5.20 : 1** |
| calm (alt) | | | if you want a cooler accent | `#38687f` (pine) | 5.53 : 1 |
| modern-classic | `#2f4b8f` | **8.05 : 1** | ✓ safe, slightly heavy | `#3a5aa8` if you want it lighter | 6.33 : 1 |
| deep-work | `#8a5a1e` | 5.45 : 1 | ✓ ratio fine, but **hue 68° is the most orange accent of the five on the least colourful paper** | **`#71624b`** (Radix gold-11) | 5.47 : 1 |

On taste, with the numbers to back it:

* **cream → `#9a5a2a`.** Hue 55° against a 87° page: 32° apart, so it reads as *the same warm family
  deepened* rather than as a foreign colour. `#a3521f` (hue 49°) is punchier and also passes; the
  current `#a8703f` at hue 60° is the right *idea* but 25 % too light — that is the whole failure.
* **novel → keep `#8f4632`.** Hue 36°, chroma 0.1042, 5.98:1. This is the one accent that is
  simultaneously the most saturated and the most safely legible, and it is exactly the "oxblood on
  aged paper" note. Don't touch it.
* **calm → `#3f7059`.** Hueline 162° vs a 146° page, so it is tonal rather than contrasting, which is
  what "calm" means. The current `#4f7d68` is the same colour 5.4 L\* lighter — again the *idea* is
  right and only the lightness is wrong. (A cooler `#38687f` pine is the alternative if you want the
  accent to have somewhere to go on hover.)
* **modern-classic → `#2f4b8f` is correct and I would keep it.** 8.05:1 is safe but darker than
  needed; `#3a5aa8` (6.33:1, hue 265°) is the same colour with less weight and I mildly prefer it —
  it leaves the near-black ink as the only "heavy" element, which suits a cool-neutral theme.
* **deep-work → `#71624b`.** The theme is near-monochrome by intent; `#8a5a1e` at chroma 0.0969 is
  **2.5 × more chromatic** than any other surface or text in that theme
  (`[computed]` — its ink is 0.0026 and its canvas 0.0013). Radix `gold-11 #71624b` at chroma
  0.0395 is still 30 × the canvas chroma but reads as sepia ink rather than as orange. This is the
  single largest taste improvement available in the set.
* **Dark accents: all five pass comfortably** — cream `#d9a273` 7.82:1, novel `#c98a70` 6.07:1,
  calm `#82b79d` 8.02:1, modern-classic `#8aa7e8` 7.50:1, deep-work `#c9974a` 7.37:1. Leave them.

### 8.6 (e) The single most important thing still wrong

> **The `surface` seed is still being treated as "a lighter page" instead of "the same paper with its
> warmth held".** Every one of the five loses chroma when it lifts — cream 0.65 ×, novel 0.83 ×,
> calm 0.66 ×, modern-classic **0.00 ×**, deep-work **0.00 ×** — against an R6 floor of 0.85 ×.

The magnitude is small enough on cream and novel that it may look acceptable in a screenshot, which
is exactly why it will survive review. But it is the *same* failure that made the composer
`#fefdfc`: the raised plane is colder than the page. Cream's `#fdfbf5` is 35 % less warm than
`#f7f3ea`; it reads as a paler, greyer sheet. And for modern-classic and deep-work it is total —
`#ffffff` has **OKLCH chroma exactly 0**, so those two themes ship a warm page with a colourless
raised plane, and their ladders terminate at the L\* 100 wall with only +1.4 and +3.1 L\* of travel
(modern-classic's +1.4 is below the perceptual floor, so its card/composer step is not visible at
all).

**The fix is one change of intent, not an architecture change:**

* When you move a surface up, **hold the hue exactly and raise the chroma toward the canvas's, never
  away from it.** A lifted surface should keep **≥ 0.90 ×** the canvas chroma, not 0.65 ×.
* **Cap the top of the light ramp at L\* 97.0–97.5**, not 98.5, because above 97.5 the 8-bit grid
  quantises chroma in ~0.001 steps and a low-chroma canvas like calm's (0.0051) can no longer hit its
  target at all.
* **Where chroma retention and step size conflict, chroma wins** — and if you need the step back,
  lower the *canvas*, never raise the surface past 97.5.

Concretely, that is `#fcf8f0` instead of `#fdfbf5` for cream, `#fcf6e9` instead of `#fcf8ec` for
novel, `#f9f9f8` instead of `#ffffff` for deep-work, and a lowered canvas for modern-classic.

### 8.7 The six rules that justify the corrected seeds

1. **Cap the top of the light ramp at L\* 97.0–97.5** (not 98.5). Below 97.5 the sRGB 8-bit grid
   resolves chroma finely enough to hit a target; above it, steps are ~0.001 and low-chroma themes
   lose control. Also keeps `L* + 100·C ≤ 99.8`.
2. **Light elevation step: ΔL\* +1.5 to +2.5** for the top of the ramp, **+1.0 to +2.0** for
   intermediate stops. Below 1.5 is imperceptible; above 2.5 on a canvas already at L\* ≥ 95 runs you
   into the wall.
3. **Chroma retention on lift: ≥ 0.90 ×** the canvas chroma, hue unchanged. Never let a lifted
   surface fall below 0.85 ×, and never let it hit 0.
4. **Dark ramp top: ΔL\* +14 ± 1.5**, chroma **~1.3 ×** the canvas, hue unchanged (≤ 8° drift). Solve
   every dark text tier against that top surface, not the canvas.
5. **Sidebar: −2.2 to −2.6 L\* in both modes**, chroma 1.25–1.7 × in light, 0.75–0.85 × in dark.
   Below 1.5 L\* of separation the column vanishes.
6. **Bubble: −4.5 to −5.0 L\* in light** (so it clears both the canvas *and* the sidebar),
   **+6.5 to +7.5 in dark**, chroma 1.6–1.9 × light / 1.3 × dark. Solve the secondary text tier
   against the bubble, not the canvas.

### 8.8 Final corrected seed table

Both modes, all five themes. Canvas / bubble / ink / accent are yours (with the two accent fixes
applied); `surface` and `sidebar` are corrected. **Bold = changed from your current seeds.**

**Light**

| theme | canvas | `surface` | `sidebar` | `bubble` | ink | accent |
| --- | --- | --- | --- | --- | --- | --- |
| cream | `#f7f3ea` | **`#fcf8f0`** | `#f2ece0` | `#f0e7d6` | `#2f2a24` | **`#9a5a2a`** |
| novel | `#f6f0e2` | **`#fcf6e9`** | `#efe7d5` | `#ede2cc` | `#332e26` | `#8f4632` |
| calm | `#f2f5f2` | **`#f6faf6`** | `#eaefea` | `#e6ece7` | `#2c3733` | **`#3f7059`** |
| modern-classic | **`#f4f5f8`** | **`#f9fafc`** | **`#ecedf1`** | `#eef1f6` | `#15181d` | **`#3a5aa8`** |
| deep-work | `#f6f6f5` | **`#f9f9f8`** | `#eeeeec` | `#e9e9e6` | `#101112` | **`#71624b`** |

**Dark**

| theme | canvas | `surface` | `sidebar` | `bubble` | ink | accent |
| --- | --- | --- | --- | --- | --- | --- |
| cream | `#1b1917` | **`#393633`** | `#161412` | `#2a2622` | `#ece5da` | `#d9a273` |
| novel | `#1d1a15` | **`#3b3730`** | `#181510` | `#2b261e` | `#e9e0cd` | `#c98a70` |
| calm | `#111614` | **`#2c3431`** | **`#0d1211`** | `#1d2622` | `#dde7e1` | `#82b79d` |
| modern-classic | `#15171b` | **`#313439`** | `#111316` | `#232730` | `#eceef2` | `#8aa7e8` |
| deep-work | `#0c0e11` | **`#292c30`** | **`#050607`** | `#171a1e` | `#e8eaec` | `#c9974a` |

Derived token consequences of this table — build them with §1.2's `resample()`, not with `mix()`:

* **Light**: `bg-layer-1` / `bg-layer-2` / `bg-layer-3` = 0.45 / 0.75 / 1.0 of the way from canvas to
  `surface`, each with chroma ×1.10 / ×1.05 / ×0.95 relative to the canvas — **three distinguishable
  stops is not achievable by lightness alone on these canvases; the chroma ladder carries the
  nesting.**
* **Light**: `bg-overlay` (= `surface × 0.92` chroma, L\* +1.0 above surface) — popovers must still
  clear the L\* 97.5 ceiling.
* **Dark**: `bg-layer-1` / `bg-layer-2` / `bg-layer-3` = 0.35 / 0.70 / 1.0 of the way from canvas to
  `surface`, hue held.
* **Borders**: leave the existing `alpha(ink, 0.04/0.10/0.12/0.16)` alone. That construction is
  already correct (§6.7 of the anti-pattern list is about the *consumer* stacking a fill and a
  stroke, not about the token).
* **Semantic colours**: still need the §4.4 / §1 R13 treatment. `state-warn-label` in particular is
  `#dd8629` = **2.52:1** on cream's canvas; use `#b45309` (**4.53:1**).

**Verification suite this table enables.** Five assertions worth adding to
`tests/plugin.test.mjs`, all expressible with the `luminance`/`contrast` helpers already in
`client.js` plus a small OKLab converter:

1. For every theme and mode: `oklchChroma(surface) ≥ 0.85 × oklchChroma(canvas)`.
2. For every light theme: `cieLstar(surface) ≤ 97.5` and `cieLstar(surface) + 100·oklchChroma(surface) ≤ 99.8`.
3. For every light theme: `cieLstar(surface) − cieLstar(canvas) ≥ 1.5`.
4. For every dark theme: `cieLstar(surface) − cieLstar(canvas) ∈ [12.5, 15.5]`, and
   `contrast(captionTier, surface) ≥ 4.5`.
5. For every theme and mode: `contrast(accent, canvas) ≥ 4.5` and `contrast(accent, surface) ≥ 4.5`.

---

## Appendix A — reproducing every number

All figures marked **`[computed]`** came from three scripts. The maths is standard:

**sRGB → CIE L\*** (D65):
`linearise per channel (0.04045 threshold) → XYZ via the sRGB D65 matrix → Y → f(t) → L* = 116·f(Y/Yn) − 16`, with `Yn = 1`.

**sRGB → OKLab → OKLCH**: standard Björn Ottosson matrices; `C = hypot(a,b)`, `H = atan2(b,a)`.
Inverse: cube the LMS, apply the inverse matrix, `linearToSrgb`.

**sRGB gamut ceiling at `(L, H)`**: bisect `C ∈ [0, 0.42]` for 36–40 iterations, accepting the
largest `C` whose inverse-OKLab sRGB triple stays inside `[−0.5, 255.5]³`.

**WCAG contrast**: `(Y_hi + 0.05) / (Y_lo + 0.05)` with the standard 0.2126/0.7152/0.0722 weights.

**Alpha composite** (for `menu-surface` and the shipped translucent tokens): `parse` the 8-digit hex,
mix against the canvas at `a/255`.

**`reach(anchor, toward, target)`**: bisection on `mix(anchor, toward, x)` for 24–26 iterations;
`mix` is component-wise sRGB interpolation, matching `client.js`.

## Appendix B — sources

Every URL below was fetched during this task.

**Reading / writing**
* Obsidian default theme — extracted from `/Applications/Obsidian.app/Contents/Resources/obsidian.asar` (local, primary)
* Obsidian Minimal — https://raw.githubusercontent.com/kepano/obsidian-minimal/master/theme.css
* Obsidian Things — https://raw.githubusercontent.com/colineckert/obsidian-things/main/theme.css
* Notion colour tokens — https://docs.super.so/notion-colors
* Bear `.theme` schema — https://community.bear.app/t/definition-of-terms-used-in-the-theme-files/18306
* Apple Books — `xcrun assetutil --info /System/Applications/Books.app/Contents/Resources/Assets.car` (204 colour assets, none matching a reading theme)
* Kindle sepia, iA Writer, Ulysses, Craft, Typora, Atom, Roam, Logseq — **no primary source found**

**Developer palettes**
* Solarized — https://raw.githubusercontent.com/altercation/solarized/master/xresources/solarized
* Rosé Pine — https://raw.githubusercontent.com/rose-pine/rose-pine-palette/main/palette.json
* Gruvbox — https://raw.githubusercontent.com/morhetz/gruvbox/master/colors/gruvbox.vim
* Everforest — https://raw.githubusercontent.com/sainnhe/everforest/master/autoload/everforest.vim
* Catppuccin — https://raw.githubusercontent.com/catppuccin/palette/main/palette.json
* Kanagawa (palette) — https://raw.githubusercontent.com/rebelot/kanagawa.nvim/master/lua/kanagawa/colors.lua
* Kanagawa (roles) — https://raw.githubusercontent.com/rebelot/kanagawa.nvim/master/lua/kanagawa/themes.lua
* Nord — https://raw.githubusercontent.com/nordtheme/nord/develop/src/nord.css
* GitHub Primer light — https://unpkg.com/@primer/primitives/dist/css/functional/themes/light.css

**Design systems**
* Radix Colors (light) — https://raw.githubusercontent.com/radix-ui/colors/main/src/light.ts
* Radix Colors (dark) — https://raw.githubusercontent.com/radix-ui/colors/main/src/dark.ts
* Tailwind v3 hex ladders — https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/public/colors.js
* Tailwind v4 OKLCH — https://raw.githubusercontent.com/tailwindlabs/tailwindcss/main/packages/tailwindcss/theme.css
* IBM Carbon colours — https://raw.githubusercontent.com/carbon-design-system/carbon/main/packages/colors/tokens/colors.tokens.json
* Salesforce SLDS colours — https://unpkg.com/@salesforce-ux/design-system/design-tokens/dist/colors.json
* Material 3 colour specs — https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/dynamiccolor/color_spec_2021.ts
* Material 3 schemes — https://raw.githubusercontent.com/material-foundation/material-color-utilities/main/typescript/dynamiccolor/dynamic_scheme.ts

**Standards**
* WCAG 2.1 §1.4.3 — https://www.w3.org/TR/WCAG21/#contrast-minimum
* WCAG 2.1 §1.4.11 — https://www.w3.org/TR/WCAG21/#non-text-contrast

**In-repo**
* `docs/token-inventory.md` — the 107-token surface, the shipped light/dark values, the border-level asymmetries, and the dead-reference list.
* `docs/surface-map.md` — which component paints which token; the macOS sidebar vibrancy composite; the `--dsw-elevation-*` shadow recipes and their `body, body *` scoping.
