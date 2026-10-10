# DSH Web client — painted-surface → CSS custom property map

Read-only reverse engineering of `/Applications/DeepSeek Harness.app/Contents/Resources/app.asar`
(11,480 entries). Inner paths are relative to the archive root. Every rule quoted below was read out
of a file in that archive; nothing was modified and the app was not started.

Scope of the question: **which CSS custom property paints each large surface, and can an inline
custom property written on `document.body` by `ThemePresenter.apply()`
(`dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js`) change it?**

Live verification was **not possible**: `cordis_inspect_query` against the running client
(`platform: client`, providers `Theme`, `Builtin`) timed out twice with
`Client inspect query … timed out after 10000ms`, so no computed-style readback from the live page
was obtained. Everything here is static evidence from the archive, plus one **UNVERIFIED** item
called out inline.

---

## 0. How stylesheets actually reach the page (three different mechanisms)

This matters, because "grep the bundle" and "grep the CSS asset" find different halves of the UI.

| mechanism | where it lives | example |
| --- | --- | --- |
| **A. Inlined theme sheets** — one JS string per sheet, injected as `<style data-plugin="@deepseek-ai/dsh-client-ui-theme" data-plugin-css="…/<name>.css">` | `dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js` (regions `\0dsh-inline-css:`) | `var design_platform_css_default = "body{--dsw-static-amber-100:#fef5e7;…"` (line 1148) |
| **B. Compiled CSS-module strings** — one JS string per component sheet, injected as `<style data-plugin="<pkg>" data-plugin-css="<pkg>/<Name>.module.css">` | `lib/client.js` of `dsh-client-ui-conversation`, `-sidebar`, `-layout`, `-chat`, `-approval`, `-user-questions`, `-workspace`, … (regions `\0dsh-css:`) | `const css$1 = ".yhfFVG_card{…background:var(--dsw-specific-input-major)…}"` |
| **C. Real `.module.css` assets compiled by the web-frontend build** — shipped as source files next to `lib/index.js`, hashed and emitted into the shell CSS asset | sources: `dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/*.module.css`; output: `dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BPHePDI_.css` | `MenuSurface.module.css` `.material{background:var(--dsw-menu-surface-fill)}` → `._backing_ri079_2{…}` |

`dsh-client-ui-primitives/lib/index.js` contains **zero** CSS strings and **zero** hashed class names
(verified: `grep -c '_backing_ri079_2\|dsh-css'` → `0`); it does `import css from "./MenuSurface.module.css"`.
So ui-primitives' rules are only findable in `index-BPHePDI_.css`, whose class names are hashed
(`._backing_ri079_2`, `._float_6nhg2_156`, `._paneBody_6nhg2_318`). Every other client-ui package
inlines its sheet as a JS string.

The presenter itself writes only inline properties on `body`:

```js
// dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js:536-545
const body = document.body;
…
body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`);
for (const name of this.appliedTokens) body.style.removeProperty(name);
this.appliedTokens = [];
for (const [name, value] of Object.entries(snapshot.active.tokens)) {
    body.style.setProperty(name, value);
    this.appliedTokens.push(name);
}
```

**Reachability rule used in the table**: a surface is *reachable* when the declaration that paints it
reads a custom property that is **not re-declared on the painted element or on `body *`**. Inline
declarations beat every selector, so specificity/`!important` is almost never the reason a
`body`-level override loses — an *own declaration on a descendant* is (`body,body *{…}`, or a
per-component rebind).

---

## 1. Surface table

| surface | exact selector (file) | token / literal it reads | re-declared locally? | reachable from a `body` override? |
| --- | --- | --- | --- | --- |
| Browser document canvas | `body{…background:var(--dsw-alias-bg-base, #fff)}` (web-frontend `index-BPHePDI_.css`) and `body{…background-color:var(--dsw-alias-bg-base)}` (ui-theme `design-platform.css`) | `--dsw-alias-bg-base` | no | **YES** (opaque) |
| **macOS window backdrop** | `html[data-platform=darwin],html[data-platform=darwin] body{background:transparent}` (web-frontend `index-BPHePDI_.css`) | none — literal `transparent`, showing the Electron **native vibrancy** material (`lib/main.js`: `vibrancy:"sidebar"`, `visualEffectState:"active"`, `backgroundColor:"#00000000"`) | yes (literal) | **NO** |
| App frame | `._6Qf49G_frame{background:var(--dsw-alias-bg-base);…}` (ui-layout `AppFrame.module.css`) | `--dsw-alias-bg-base`; on darwin `[data-platform=darwin] ._6Qf49G_frame{background:0 0}` | no (but transparent on macOS) | YES (Windows/Linux/browser); NO on macOS (transparent) |
| Main (centre) column | `[data-platform=darwin] ._6Qf49G_centerCol{background:var(--dsw-alias-bg-base);border-left:.5px solid var(--dsw-alias-border-l3)}`; `[data-windows-titlebar] ._6Qf49G_centerCol{background:var(--dsw-alias-bg-base);…}` (ui-layout) | `--dsw-alias-bg-base` | no | YES |
| Right column | `[data-platform=darwin] ._6Qf49G_rightbarCol{background:var(--dsw-alias-bg-base)}`; otherwise `._6Qf49G_rightbarCol{min-width:0;position:relative;overflow:visible}` (no background) | `--dsw-alias-bg-base` (macOS) / paint owned by occupants | no | YES |
| Conversation shell | `.ST7X_W_root{background:var(--dsw-alias-bg-base);…}` (ui-conversation `ConversationRoot.module.css`) | `--dsw-alias-bg-base` | no | YES |
| Chat/panel scroll region | `.ST7X_W_scrollBody{…}` — no background; shows `--dsw-alias-bg-base` from `_root` | — | — | (inherited surface) |
| **Sidebar column** | `._6Qf49G_sidebarCol{background:var(--dsw-specific-sidebar-fill);border-right:.5px solid var(--dsw-alias-border-l3);min-width:0;overflow:hidden}` (ui-layout) | `--dsw-specific-sidebar-fill` | no — but the darwin override below **replaces** the value with a `color-mix()` | **YES on Windows/Linux/browser; diluted on macOS** — see §2 |
| Sidebar column (macOS) | `[data-platform=darwin] ._6Qf49G_sidebarCol{background:linear-gradient(to bottom, #7a9bf01a, #7a9bf000 35%, #8f89b800 68%, #8f89b817), color-mix(in srgb, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, #7a9bf0) 40%, transparent);border-right:none}` | `--dsw-specific-sidebar-fill` at **0.4 × 0.97 = 38.8 %** weight; rest is `#7a9bf0` and transparent → native vibrancy | yes (`color-mix`, opacity 40 %) | **YES but weak** (≈39 % of the composite) |
| Sidebar column (macOS, dark) | `[data-platform=darwin] [data-ds-dark-theme] ._6Qf49G_sidebarCol{background:linear-gradient(to bottom, #7a9bf014, #7a9bf000 35%, #8f89b800 68%, #8f89b812), color-mix(in srgb, var(--dsw-specific-sidebar-fill) 50%, transparent)}` | `--dsw-specific-sidebar-fill` at **50 %** | yes | YES but weak |
| Sidebar column (reduced transparency) | `@media (prefers-reduced-transparency:reduce){[data-platform=darwin] ._6Qf49G_sidebarCol,[data-platform=darwin] [data-ds-dark-theme] ._6Qf49G_sidebarCol{background:color-mix(in srgb, var(--dsw-specific-sidebar-fill) 90%, transparent)}}` | `--dsw-specific-sidebar-fill` at 90 % | yes | YES (strongest macOS case) |
| Sidebar package root (inside the column) | `._3WPZCG_root{--dsh-sidebar-inline-padding:12px;…;background:var(--dsw-specific-sidebar-fill);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);…}`; **`[data-platform=darwin] ._3WPZCG_root{background:0 0}`** (ui-sidebar `SidebarRoot.module.css`) | `--dsw-specific-sidebar-fill`, then literal `transparent` on darwin | yes (darwin literal) | YES on Windows/Linux/browser; **NO on macOS** (paint removed) |
| Sidebar header / title row | `._3WPZCG_topStrip{…}` and `._3WPZCG_logoRow{…}` have **no** `background` → the column shows through | — | — | (no own paint) |
| Windows caption / title row | `[data-windows-titlebar] ._6Qf49G_frame{…;background:var(--dsw-specific-sidebar-fill);…}` and `[data-windows-titlebar] ._6Qf49G_frame:before{content:"";height:var(--dsh-windows-titlebar-height);background:var(--dsw-specific-sidebar-fill);-webkit-app-region:drag;…}` (ui-layout) | `--dsw-specific-sidebar-fill` | no | YES (Windows only) |
| Session-list bottom fade | `._7514NG_fade{left:0;right:var(--dsh-session-list-edge-inset);background:linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill));pointer-events:none;height:24px;position:absolute;bottom:0}` (ui-workspace) | `--dsw-specific-sidebar-fill` at **full strength** | no | YES (on macOS this is the one place the raw token is painted) |
| Sidebar panel/nav rows | `._3WPZCG_panelRow:hover{background:var(--dsw-alias-interactive-bg-hover)}` and `._3WPZCG_panelRow._3WPZCG_panelActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}` (ui-sidebar) | `--dsw-alias-interactive-bg-hover` | no | YES |
| Sidebar icon buttons | `._3WPZCG_iconButton{…background:0 0;…}` / `._3WPZCG_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}` (ui-sidebar); `.DL-xwG_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}` (ui-sidebar `HeaderLeadingControls.module.css`) | `--dsw-alias-interactive-bg-hover` | no | YES |
| Sidebar New Session button | `._3WPZCG_newSession{…;background:var(--dsw-alias-button-elevated-fill);…}` / `:hover{background:var(--dsw-alias-button-floating-hover)}` | `--dsw-alias-button-elevated-fill` | **yes on macOS:** `[data-platform=darwin] ._3WPZCG_newSession{background:#ffffff8c}`, `:hover{background:#ffffff4d}`, dark `{background:#ffffff26}`, dark hover `{background:#fff3}` | YES off macOS; **NO on macOS** (literal) |
| Session rows (session list) | `.jJkEga_projectRow:hover,.jJkEga_sessionRow:hover,.jJkEga_sessionRow.jJkEga_selected{background:var(--dsw-alias-interactive-bg-hover)}`, `.jJkEga_menuOpen{background:var(--dsw-alias-interactive-bg-hover)}` (ui-workspace) | `--dsw-alias-interactive-bg-hover` | no | YES |
| Settings nav cells (only consumers of the `-hover` / `-active` nav-item tokens) | `.Dws9Sa_navCell:hover{background:var(--dsw-specific-sidebar-nav-item-hover)}` and `.Dws9Sa_navCell.Dws9Sa_active{background:var(--dsw-specific-sidebar-nav-item-active)}` (ui-settings-general) | `--dsw-specific-sidebar-nav-item-hover` / `-active` | no | YES |
| Question card **"Recommended"** chip — the only consumer of the `-accent` nav-item token, and the one place it is spent as a *background under accent-coloured text* | `.y21zpG_badge{border-radius:var(--dsw-radius-xs);background:var(--dsw-specific-sidebar-nav-item-active-accent);color:var(--dsw-alias-button-info-fill);padding:0 4px;font-size:11px;font-weight:600;line-height:18px}` (ui-user-questions) | `--dsw-specific-sidebar-nav-item-active-accent` (background) under `--dsw-alias-button-info-fill` (text; shipped `#4176e6` light / `#7aaaff` dark) | no | YES |
| **Composer card (main + takeover)** | `.yhfFVG_card{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-panel);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-soft);…}` — element carries `data-composer-card="true"` (ui-conversation `InputBar.module.css`) | **`--dsw-specific-input-major`** | **no** — the name is declared only in the ui-theme palette (`body` and `body[data-ds-dark-theme]`); archive-wide grep for `--dsw-specific-input-major:` finds no component declaration | **YES — opaque, direct, no trap** |
| Composer takeover cards (approval / user questions) | `.gOeFyG_card{…background:var(--dsw-specific-input-major);box-shadow:var(--dsw-shadow-lv2);…}` (ui-approval), `.R7PCuq_card{…background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-panel);…}` and `.y21zpG_card{…background:var(--dsw-specific-input-major);…}` (ui-user-questions) | `--dsw-specific-input-major` | no | YES |
| Attachment / file cards | `.OnRn_q_card{…background:var(--dsw-specific-input-major,transparent);…}` (ui-attachment), `.IzP3Va_fileCard{…background:var(--dsw-specific-input-major,transparent);…}` (ui-chat) | `--dsw-specific-input-major` (with `transparent` fallback) | no | YES |
| Composer footer band ("seat") | `.ST7X_W_root[data-phase=active] .ST7X_W_composerSeat,.ST7X_W_embeddedBody[data-content-phase=active] .ST7X_W_composerSeat{z-index:7;background:linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0px, var(--dsw-alias-bg-base) 36px);position:sticky;bottom:0}` (ui-conversation) | `--dsw-alias-bg-base` | no (via `color-mix`) | YES — **this is the band around the card; it does not follow `--dsw-specific-input-major`** |
| Queue / Todo dock panels | `.w9rwOa_root{…background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-panel);…}` (ui-conversation `QueueDock`/`TodoPanel`) | `--dsw-specific-menu` | no | YES |
| Menus / popovers / dropdowns | `.y0jqnG_panel`, `.mCH5Qa_panel`, `.cJtk3a_menu`, `.Fw9vfq_menu`, `.tki__G_menu`, `.cl2Rlq_menu`, `.Z0Zh9q_menu`, `.-Fl-UW_panel`, `.bC-RcG_panel:before`, `._2tNPVa_panel:before` — all `{…background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);…}` | `--dsw-specific-menu` (→ `--dsw-menu-surface-fill`) | no | YES (note: on macOS the palette itself re-points it: `html[data-platform=darwin] body{--dsw-specific-menu:#f8f9faf0}` — still a `body` rule, so an inline override still wins) |
| Menu surface (ui-primitives) | `.material{position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--dsw-menu-surface-fill);backdrop-filter:var(--dsw-menu-backdrop-filter);pointer-events:none}` (compiled into `index-BPHePDI_.css`) | `--dsw-menu-surface-fill` | no | YES |
| Menu opaque backing (macOS blur support) | `html[data-platform=darwin] ._backing_ri079_2{display:block;position:fixed;…;background:var(--dsw-alias-bg-base);pointer-events:none}` (from `MenuSurface.module.css`: `:global(html[data-platform='darwin']) .backing`) | `--dsw-alias-bg-base` | no | YES |
| Shell floating panel | `._float_6nhg2_156{position:fixed;…;background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-panel);--dsw-elevation-stroke-color: var(--dsw-alias-border-l2)}` (web-frontend `index-BPHePDI_.css`) | `--dsw-alias-bg-layer-2` | no | YES |
| Modal / dialog masks | `._mask_o6lrb_18:after{…background:var(--dsw-alias-bg-mask-1);…}`, `._mask_1hos8_11{…background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}`, `.Dws9Sa_mask{inset:var(--dsh-frame-chrome-top,0px) 0 0;background:var(--dsw-alias-bg-mask-1);…}` | `--dsw-alias-bg-mask-1` (mask-2/3 elsewhere) | no | YES |
| Settings cards | `.FfBBxq_card`, `.FNfifq_card`, `.FNfifq_skeletonCard`, `._6fYtdq_rowCard`, `.B10aXW_card,.B10aXW_balanceCard` — all `{border:.5px solid var(--dsw-alias-settings-card-stroke);…;background:var(--dsw-alias-settings-card-fill);…}` | `--dsw-alias-settings-card-fill` (declared `body{--dsw-alias-settings-card-fill:var(--dsw-alias-bg-layer-2)}` in ui-theme `base.css`) | no | YES |
| Right-panel panes | `.Dws9Sa_panel{…background:var(--dsw-alias-bg-layer-2)}`, `.T1tA0G_panel{…background:var(--dsw-alias-bg-layer-2)}`, `._0rqS-a_root{…background:var(--dsw-alias-bg-layer-1)}`, `._22xwLW_frame{…background:var(--dsw-alias-bg-layer-1)}`, `.iGvAsW_root` / `.iGvAsW_frame{background:var(--dsw-alias-bg-base)}` | `--dsw-alias-bg-layer-1/2`, `--dsw-alias-bg-base` | no | YES |
| Document preview body | `.AhTMVW_body:has([data-pdf-preview]){background:var(--dsw-alias-bg-document-preview)}`, `.vLRxma_body{…background:var(--dsw-alias-bg-document-preview)}` | `--dsw-alias-bg-document-preview` | no | YES |
| Chat user bubble | `.IzP3Va_bubble{background:var(--dsw-specific-bubble)}` (ui-chat) | `--dsw-specific-bubble` | no | YES |
| Markdown code blocks | `.Bpi2Dq_body{background:var(--dsw-alias-markdown-code-block)}`, `.YS3v9W_body{background:var(--dsw-alias-markdown-code-block)}`, `.yj_sLW_root{background:var(--dsw-alias-markdown-code-block)}` | `--dsw-alias-markdown-code-block` | no | YES |
| Terminal block | `.xterm .xterm-viewport{cursor:default;background-color:#000;position:absolute;…}` | literal `#000` | yes (literal) | **NO** |
| Boot / loading screen | `._boot_u7vgf_3{--dsh-boot-label-primary: #0f1115;…;height:100%;display:grid;place-items:center;background:var(--dsw-alias-bg-base, var(--dsh-boot-bg, Canvas))}` (web-frontend `index-BPHePDI_.css`) | `--dsw-alias-bg-base` with `--dsh-boot-bg` fallback | no | YES for the shell phase; the pre-plugin bootstrap paints before ui-theme's sheets exist, so it can show the *default* palette first (see the workbench README) |
| Sidebar hover scrollbar reveal | `._3WPZCG_root._3WPZCG_quietBars{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}` (ui-sidebar) | `--dsh-scrollbar-*` rebound to a literal | yes | NO for the thumb (intended) |
| Trajectory summary scroll region | `.rkta1W_summaryScrollRegion{--dsh-scrollbar-thumb:transparent;…}` / `:hover,:focus-within{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);…}` | rebind | yes | NO for the thumb (intended) |

---

## 2. Why the two reported overrides "did nothing"

### 2.1 `--dsw-specific-sidebar-fill` → sidebar column

The token is **the** paint, and on macOS it is deliberately diluted:

```css
/* dsh-client-ui-layout/lib/client.js — AppFrame.module.css */
._6Qf49G_sidebarCol{background:var(--dsw-specific-sidebar-fill);border-right:.5px solid var(--dsw-alias-border-l3);min-width:0;overflow:hidden}
[data-platform=darwin] ._6Qf49G_sidebarCol{background:linear-gradient(to bottom, #7a9bf01a, #7a9bf000 35%, #8f89b800 68%, #8f89b817), color-mix(in srgb, color-mix(in srgb, var(--dsw-specific-sidebar-fill) 97%, #7a9bf0) 40%, transparent);border-right:none}
[data-platform=darwin] [data-ds-dark-theme] ._6Qf49G_sidebarCol{background:linear-gradient(to bottom, #7a9bf014, #7a9bf000 35%, #8f89b800 68%, #8f89b812), color-mix(in srgb, var(--dsw-specific-sidebar-fill) 50%, transparent)}
@media (prefers-reduced-transparency:reduce){[data-platform=darwin] ._6Qf49G_sidebarCol,[data-platform=darwin] [data-ds-dark-theme] ._6Qf49G_sidebarCol{background:color-mix(in srgb, var(--dsw-specific-sidebar-fill) 90%, transparent)}}
```

Three independent reasons the change reads as "nothing happened" on the macOS desktop:

1. **Opacity.** `color-mix(… 40%, transparent)` (light) / `50%` (dark) means the token contributes
   only **38.8 %** (light: `0.4 × 0.97`) or **50 %** (dark) of the painted pixels; the rest is the
   `#7a9bf0` tint plus **whatever is behind**, which on macOS is not CSS at all — see §3.1.
   A ΔRGB of `(7, 14, 27)` between `#f9fafb` and a warm `#f2ece0` therefore lands as roughly
   `(3, 5, 10)` of visible shift.
2. **A hardcoded gradient layer sits on top** of it (`#7a9bf01a`, `#8f89b817` — see §3.2).
3. **The ui-sidebar package's own paint of the same token is switched off on macOS:**
   `[data-platform=darwin] ._3WPZCG_root{background:0 0}` — so the sidebar's own container shows the
   column, and the only remaining full-strength uses of the raw token in the sidebar are the
   session-list fade `._7514NG_fade` and the Windows caption strip.

On Windows/Linux or in a plain browser (`html` without `data-platform`) the darwin rules do not
match and `._6Qf49G_sidebarCol{background:var(--dsw-specific-sidebar-fill)}` and
`._3WPZCG_root{background:var(--dsw-specific-sidebar-fill)}` are both opaque and fully reachable.
If the override produced no visible change *there* either, the cause is not CSS scoping (§4) and the
override probably never reached `body`.

### 2.2 `--dsw-specific-input-major` → composer card

The token is correct and the path is clean. Archive-wide, `--dsw-specific-input-major` is

* **declared** exactly twice — `body{…--dsw-specific-input-major:var(--dsw-static-neutral-bluish-00);…}`
  and `body[data-ds-dark-theme]{…--dsw-specific-input-major:var(--dsw-static-neutral-bluish-850);…}`
  in `dsh-client-ui-theme/lib/client.js` (the `design_platform_css_default` string), i.e. **only on
  `body`**, which is exactly where the presenter writes; and
* **read** by `.yhfFVG_card`, `.gOeFyG_card`, `.R7PCuq_card`, `.y21zpG_card`, `.OnRn_q_card`,
  `.IzP3Va_fileCard` — none of which re-declare it.

No component declares it, nothing declares it on `:root`/`html`, no `!important` is involved, and no
rule with a competing background targets the composer card:

* `data-composer-card` is never *styled*: archive-wide it appears only as a JS anchor —
  `anchor: document.querySelector("[data-composer-card]")` (ui-agent-preset),
  `listRef.current?.closest("[data-composer-card]")?.contains(ev.target)` (ui-input-trigger),
  `probeRef.current?.closest("[data-composer-card]") ?? null` (ui-message-feedback) — which
  independently confirms that marker *is* the composer card element;
* `.yhfFVG_card` appears only in `InputBar.module.css` (`ui-conversation/lib/client.js`).

```css
/* dsh-client-ui-conversation/lib/client.js — InputBar.module.css (element: data-composer-card="true") */
.yhfFVG_card{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-panel);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-soft);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;gap:12px;padding-top:8px;display:flex;position:relative}
```

**Conclusion: a `body`-level override of `--dsw-specific-input-major` DOES repaint the composer card.**
So the report cannot be explained by scoping. The explanations that remain, in order of likelihood:

1. **The value is imperceptibly close to the shipped one.** The shipped light value is literally
   `#fff`. The theme workbench derives `'--dsw-specific-input-major': up(dark ? 0.06 : 0.85)`
   (`dsh-plugin-theme-workbench/client.js:475`) with `up = (w) => mix(canvas, '#ffffff', w)`
   (`client.js:309`). On the workbench's Cream canvas `#f7f3ea` that resolves to
   `r = 247 + 8×0.85 = 253.8`, `g = 243 + 12×0.85 = 253.2`, `b = 234 + 21×0.85 = 251.85` →
   **`#fefdfc`** versus a shipped **`#ffffff`**: ΔRGB ≈ `(1, 2, 3)`. That is invisible by
   construction, and it matches the report's phrasing ("near-white").
2. **Only the card moves, not the visible band.** The composer's surrounding footer band is a
   different surface — `.ST7X_W_composerSeat` paints
   `linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0px, var(--dsw-alias-bg-base) 36px)`
   over `--dsw-alias-bg-base`. A "recolour the composer area" intent must move `bg-base` (or both),
   not only `input-major`.
3. **The override never landed on `body`.** Any of: the value was supplied as a bare string rather
   than `{ light, dark }` (`overrideTokens` throws on that form); a `body{…}` rule injected by a
   plugin sheet, written *before* the ui-theme sheets, lost on source order at equal specificity; or
   `:root`/`html` was written instead of `body`, in which case the palette's own
   `body{--dsw-specific-input-major:…}` declaration still wins for the body subtree.
   I could not test the live page (inspect queries timed out), so this is **UNVERIFIED**.

---

## 3. Surfaces a `body`-level override can never reach

### 3.1 The macOS window backdrop (not CSS at all) — **definitively unreachable**

```js
// lib/main.js:11094-11098
vibrancy: "sidebar",
visualEffectState: "active",
backgroundColor: "#00000000"
```

```css
/* dsh-web-frontend/dist/assets/index-BPHePDI_.css */
html[data-platform=darwin],html[data-platform=darwin] body{background:transparent}
```

`html` and `body` are made transparent on macOS specifically so the native `NSVisualEffectView`
("sidebar" material) shows through, and the window background colour is `#00000000`. The material is
drawn by AppKit below the page: no custom property, on `body` or anywhere else, can change it. This
is the dominant colour behind the sidebar column (§2.1) and behind every translucent menu
(`backdrop-filter: blur(40px) saturate(150%)` samples it). The only CSS-side tint for desktop
surfaces is `--dsw-desktop-window-tint`, declared on `:root` in
`renderer/assets/window-material.css`:

```css
:root { --dsw-desktop-window-tint: color-mix(in srgb, rgb(255 255 255) 40%, transparent); }
body[data-ds-dark-theme] { --dsw-desktop-window-tint: color-mix(in srgb, rgb(24 25 28) 50%, transparent); }
```

Its only consumers are `renderer/welcome.css` and its own file (verified by grep), i.e. it belongs to
the Electron welcome/credential windows, not to the Web GUI sheets — **UNVERIFIED** whether the Web
GUI ever renders it.

### 3.2 Hardcoded literals in component sheets

| surface | rule | literal |
| --- | --- | --- |
| macOS sidebar gradient (over the column fill) | `[data-platform=darwin] ._6Qf49G_sidebarCol{background:linear-gradient(to bottom, #7a9bf01a, #7a9bf000 35%, #8f89b800 68%, #8f89b817), …}` and the dark twin | `#7a9bf01a`, `#7a9bf000`, `#8f89b800`, `#8f89b817` / `#7a9bf014`, `#8f89b812`; plus the `#7a9bf0` mixed into the fill |
| macOS sidebar New Session button | `[data-platform=darwin] ._3WPZCG_newSession{background:#ffffff8c}`, `:hover{background:#ffffff4d}`, dark `{background:#ffffff26}`, dark hover `{background:#fff3}` | `#ffffff8c`, `#ffffff4d`, `#ffffff26`, `#fff3` |
| Sidebar rail brand wordmark / build badge | `._3WPZCG_buildVersion{…background:var(--dsw-alias-label-primary);…}` (token, fine); brand uses `color:inherit` | — |
| Embedded terminal | `.xterm .xterm-viewport{background-color:#000}`, `.xterm .composition-view{background:#000;color:#fff}` | `#000`, `#fff` (third-party sheet, not themable) |
| Spreadsheet preview (`luckysheet`/`fortune` sheets) | dozens of `background-color:#fff` / `#f5f5f5` / `#0188fb` rules | literals (third-party) |
| Provider/account onboarding art | `--dsw-gradient-onboarding-*-stops` and `--dsw-alias-onboarding-accent:#3964fe` | declared on `body` (reachable) but the literal hue is baked into the shipped sheet's own default |
| Boot label colours | `._boot_u7vgf_3{--dsh-boot-label-primary:#0f1115;--dsh-boot-label-secondary:#61666b;--dsh-boot-label-tertiary:#81858c;--dsh-boot-border:rgb(0 0 0 / 10%);--dsh-boot-brand:#0f1115;…}` with a dark twin under `body[data-ds-dark-theme]` | literals; **not** part of the `--dsw-*` palette, and the boot screen paints before plugins mount |

### 3.3 Declaration sites the presenter never touches (`:root` / `html` / non-inheritable)

These are the tokens *declared* outside `body`. Note the nuance: because custom properties inherit,
a `body`-level declaration **still wins for every descendant of `body`** even when the shipped
declaration sits on `:root`. They are therefore not automatically lost — but the presenter never
writes them unless a third-party theme adds them, and `html`-level consumers (if any) stay unaffected.

| token | declared at | consumer | reachable from `body`? |
| --- | --- | --- | --- |
| `--dsw-font-family`, `--dsw-font-family-brand`, `--ds-font-family-code`, `--ds-ease-in-out`, `--ds-transition-duration*`, `--dsw-radius-xs…panel` | `:root` — ui-theme `base.css` (`design_platform_css_default`'s sibling string, `client.js:1142`) | everywhere | YES for body descendants (inherits), but not part of the palette |
| `--dsw-focus-ring-width` | `:root` — ui-theme `focus.css` (`client.js:1151`) | `:focus-visible` outline | YES for body descendants |
| `--dsw-corner-shape` | `:root` — ui-theme `corner-shape.css` (`client.js:1145`, inside `@supports (corner-shape:superellipse(1.5))`) | `*,:before,:after{corner-shape:var(--dsw-corner-shape)}` | YES for body descendants |
| `--shiki-foreground`, `--shiki-background`, `--shiki-token-*` | `:root` — ui-theme `shiki.css` (`client.js:1163`); dark token set under `body[data-ds-dark-theme]` | code blocks | YES for body descendants (nothing validates token names, so an `overrideTokens` layer can set them) |
| `--dsw-desktop-window-tint` | `:root` + `body[data-ds-dark-theme]` — `renderer/assets/window-material.css` | `renderer/welcome.css` only | n/a for the Web GUI (UNVERIFIED) |
| `--dsh-onboarding-border-angle` | `@property --dsh-onboarding-border-angle{syntax:"<angle>";inherits:false;initial-value:90deg}` — ui-settings-account (`client.js:3355`) | onboarding ring animation | **NO** — `inherits:false` registration means the value can never come from an ancestor; only a declaration on the consuming element (or an animated one) applies. This is the cleanest true "cannot be themed from body" token in the archive. |
| `--dsw-hovercard-bg` | **on the card element** — ui-primitives `HoverCard.module.css .card{--dsw-hovercard-bg:#2C2C2E}` and the compiled `._card_38jqx_9` | the floating hover card's own `background` | **NO** — never declared at `body` or `:root` anywhere in the archive, so an inline `body` write can never win. It is also a literal, identical in both modes: the card is dark in light mode too, deliberately, and the inks on it (`.jJkEga_hoverTitle`, `.GY4FdW_taskName`…) are white for that reason. |
| `--dsw-focus-ring-color` | **on the focus target** — ui-theme `focus.css`: `html[data-input-modality=pointer] body :focus-visible:not(:read-write){--dsw-focus-ring-color:transparent}` | the element's own `outline` | **NO** in pointer modality (and *deliberately*: keyboard focus shows the ring). Keyboard modality never hits that rule, so the outline falls back to `--dsw-alias-state-business-primary`, which is themed. |
| `--dsw-elevation-stroke`, `--dsw-elevation-panel`, `--dsw-elevation-prominent`, `--dsw-elevation-soft` | **`body,body *`** — ui-theme `gradient-shadow-text.css` (`client.js:1160`) | every elevated surface's `box-shadow` | **NO** — re-declared on **every element**, so a `body`-level override is shadowed on every descendant. Only `--dsw-elevation-stroke-color` (declared on `body` alone) is themeable, and individual surfaces rebind it (§4). |

The full `body,body *` block, quoted:

```css
/* dsh-client-ui-theme/lib/client.js:1160 — gradient-shadow-text.css */
body{--dsw-linear-gradient-think:…;--dsw-shadow-lv1:…;--dsw-shadow-lv2:…;--dsw-shadow-lv3:…;--dsw-elevation-stroke-color:var(--dsw-alias-border-l4);--dsw-mask-blur:none;--dsw-menu-backdrop-filter:blur(40px) saturate(150%)}
body[data-ds-dark-theme] [data-menu-material]{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3)}
body,body *{--dsw-elevation-stroke:0 0 0 .5px var(--dsw-elevation-stroke-color);--dsw-elevation-panel:var(--dsw-elevation-stroke), 0 3px 8px 0 #00000008, 0 0 16px 0 #00000005;--dsw-elevation-prominent:var(--dsw-elevation-stroke), 0 3px 8px 0 #0000000a, 0 0 20px 0 #0000000d;--dsw-elevation-soft:var(--dsw-elevation-stroke), 0 4px 16px 0 #00000008, 0 0 24px 0 #00000008}
```

Consequence: the composer's `box-shadow:var(--dsw-elevation-soft)` and a menu's
`box-shadow:var(--dsw-elevation-panel)` use each element's own copy of the shadow recipe, but the
*colour* inside it comes from that element's `--dsw-elevation-stroke-color` plus literal
`#00000008`/`#0000000a`/`#0000000d` alphas that no theme can reach. The `--dsw-alias-border-l4`
default for `--dsw-elevation-stroke-color` is on `body` alone, so recolouring it at `body` works
**except** on the ~30 containers that rebind it (§4).

---

## 4. `!important` / specificity traps (and the one real trap)

* **No `!important` on any custom property anywhere in the archive.** Grep for
  `--[a-z0-9-]*:[^;}]*!important` across all 5,199 extracted CSS blobs returns nothing. The only
  `!important` background in a DSH sheet is a third-party markdown/terminal one
  (`background:var(--dsl-code-block-background)!important`, `background-color:var(--terminal-cursor)!important`).
  So an inline custom property on `body` cannot lose to `!important` for any `--dsw-*`/`--dsh-*` name.
* **Inline beats every selector.** Even `html[data-platform=darwin] body{--dsw-specific-menu:#f8f9faf0}`
  (the palette's own darwin override) loses to an inline `body` declaration.
* **The real trap is an own declaration on a descendant**, and it appears in three shapes:
  1. `body,body *{--dsw-elevation-*}` — every element re-declares the shadow recipes (§3.3).
  2. per-surface rebinds — `--dsw-elevation-stroke-color`, `--dsh-scrollbar-thumb*` (§5).
  3. a `color-mix()`/literal that *replaces* the token expression rather than reading it
     (`[data-platform=darwin] ._6Qf49G_sidebarCol`, `[data-platform=darwin] ._3WPZCG_root`,
     `[data-platform=darwin] ._3WPZCG_newSession`, `[data-platform=darwin],
     [data-platform=darwin] body{background:transparent}`).
* **Source order matters only for non-inline writes.** A plugin that injects its own
  `body{--dsw-specific-input-major:…}` stylesheet has the *same* specificity as the palette's own
  `body{…}` rule, so the winner is whichever `<style>` was appended last. ui-theme injects its sheets
  from a `ctx.effect` at mount; a plugin sheet appended earlier loses. Writing through
  `ctx.theme.overrideTokens()` (inline on `body` via the presenter) avoids this entirely.
* **`var()` inside an inline declaration resolves against `body`.** An inline
  `--dsw-alias-x: var(--dsw-alias-y)` on `body` is substituted with *body's* computed `--dsw-alias-y`,
  never with a descendant's rebinding of it. Alias chains that must follow a local rebind will not.
* **`@property … {inherits:false}`** (`--dsh-onboarding-border-angle`) is a hard, spec-level
  unreachability (§3.3).

---

## 5. The rebinding contract — every place a component re-declares a `--dsw-*` / `--dsh-*` token

### 5.1 The base bindings the rebinding contract modifies

```css
/* dsh-client-ui-theme/lib/client.js:1157 — scrollbar.css */
body{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l1);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l1);--dsh-scrollbar-thumb-border:0px;--dsh-scrollbar-track-margin:0px;--dsh-scrollbar-width:5px}
@supports not selector(::-webkit-scrollbar){body,body *{scrollbar-width:thin;scrollbar-color:var(--dsh-scrollbar-thumb) transparent}}
::-webkit-scrollbar{width:var(--dsh-scrollbar-width);height:var(--dsh-scrollbar-width)}
::-webkit-scrollbar-thumb{border:var(--dsh-scrollbar-thumb-border) solid transparent;corner-shape:round;background:var(--dsh-scrollbar-thumb);background-clip:content-box;border-radius:999px}
```

Because `--dsh-scrollbar-thumb` is declared on `body` **only** (it is not in the `body *` block),
overriding the alias it points at *does* work globally — the rebinds below are the exceptions.

### 5.2 Rebind to the **l2** (elevated) scrollbar pair

Every one of these sits on the elevated container itself, by design
(`ui-theme/README.md:86`: "an elevated surface (menu, popover, dialog) rebinds them to the l2 tokens
on its own container"):

| package | selector |
| --- | --- |
| ui-primitives | `.list, .submenu` (compiled `MenuSurface` / Menu list; `index-BPHePDI_.css` `._list_4ub78_7`), `.media` (`HoverCard`/`HoverCard.module.css`) |
| ui-conversation | `.yhfFVG_card` (composer card), `.w9rwOa_root` (Todo/Queue dock) |
| ui-approval | `.gOeFyG_card` |
| ui-user-questions | `.y21zpG_card` |
| ui-attachment | `.hKoVwa_rail` |
| ui-chat | stat dialog panel |
| ui-commands | popup-select card |
| ui-cordis | `.bC-RcG_panel` |
| ui-experimental-agent-team | `._2tNPVa_panel` |
| ui-goal | `.WLW48G_bar` (elevation stroke only) |
| ui-input-trigger | `.tki__G_menu` |
| ui-jobs | `.Fw9vfq_menu` |
| ui-model-selection | `.cl2Rlq_menu` |
| ui-plugin-manager | `.ZVcBiW_card` |
| ui-schedule | `.cJtk3a_menu`, `.mCH5Qa_panel`, `.Z4FT6a_list` |
| ui-settings-models | `._6fYtdq_fetchDialog` |
| ui-shortcuts | `.WRoRwG_list` |
| ui-sidebar-browser | `.iGvAsW_addressUnknown` |
| ui-sidebar-documentpreview | `.AhTMVW_body`, `.T1tA0G_panel` |
| ui-subagent | `.Z0Zh9q_menu` |
| ui-agent-preset | `.ZwjoKq_guidePanel`, `.FfBBxq_viewerCode` |
| ui-directory-picker-browser | `.knyi1a_dialog.knyi1a_dialog` |
| web-frontend shell | `._media_38jqx_80`, `._paneBody_6nhg2_318`, `._floatBody_6nhg2_795` |
| **ui-sidebar** | `._3WPZCG_root` — the *whole column* takes l2 (`--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2)`) |

### 5.3 Rebind to `transparent` (pointer-affordance scrollbars)

```css
/* ui-sidebar — SidebarRoot.module.css */
._3WPZCG_root._3WPZCG_quietBars{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}
/* ui-trajectory */
.rkta1W_summaryScrollRegion{--dsh-scrollbar-thumb:transparent;--dsh-scrollbar-thumb-hover:transparent}
.rkta1W_summaryScrollRegion:hover,.rkta1W_summaryScrollRegion:focus-within{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
```

(`ui-sidebar/README.md:56` documents the same contract in prose. The class is applied while the
pointer is outside the column.)

### 5.4 `--dsw-elevation-stroke-color` rebinds (≈30 rules)

Default is `body{--dsw-elevation-stroke-color:var(--dsw-alias-border-l4)}`; components override it so
the 0.5 px hairline matches their surface. Observed rebinds: `var(--dsw-alias-border-l1)` ×15
(menus, popovers, docks), `var(--dsw-alias-border-l2)` (composer card, `.R7PCuq_card`,
`._float_6nhg2_156`, `._2tNPVa_member`), `var(--dsw-alias-border-l2-darkmode-thin)`
(`.hKoVwa_arrow`, `.y21zpG_card`), `var(--dsw-alias-border-l3)` (`.icaHSq_toBottom`,
`._2tNPVa_member:hover`, `body[data-ds-dark-theme] [data-menu-material]`),
`transparent` (`.yhfFVG_cardWorkspaceTrigger`), `color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent)`
(`._2tNPVa_memberCurrent`).

Implication for a theme: overriding `--dsw-elevation-stroke-color` at `body` changes only the
elements that do **not** rebind it. To move every hairline you must also override
`--dsw-alias-border-l1/l2/l3/l4` and `--dsw-alias-border-l2-darkmode-thin`.

### 5.5 Other alias rebinds (whole-app semantic decouplings)

These are the places where overriding an alias at `body` will *not* affect a specific component,
because the component points that name at a different alias on its own container:

```css
/* ui-chat — running flow */
.icaHSq_running{--dsh-chat-flow-gap:12px;--dsw-alias-label-shimmer:var(--dsw-alias-label-deep-diving-shimmer)}
/* ui-plugin-manager — danger zone */
.ZVcBiW_danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 30%, transparent);--dsw-alias-interactive-bg-hover:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent)}
.ZVcBiW_dangerButton{--dsw-alias-button-primary-fill:var(--dsw-alias-state-error-primary);--dsw-alias-button-primary-hover:var(--dsw-alias-state-error-primary)}
/* ui-experimental-agent-team */
._2tNPVa_memberCurrent{--dsw-elevation-stroke-color:color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, transparent)}
```

Also note that the **palette itself** rebinds on darwin, inside a `body` rule
(`html[data-platform=darwin] body{--dsw-specific-menu:#f8f9faf0}`, dark `#303136f0`) — a `body`-level
inline override still wins there.

---

## 6. Practical summary for a theme plugin

1. **Composer box → `--dsw-specific-input-major`.** Direct opaque paint on `.yhfFVG_card`; a `body`
   inline override reaches it. Pick a value visibly different from `#fff`/`#2c2c2e`, and remember the
   surrounding footer band follows `--dsw-alias-bg-base`, not this token.
2. **Sidebar column → `--dsw-specific-sidebar-fill`.** Full strength off macOS; on macOS the column
   is ~39 % (light) / 50 % (dark) of a `color-mix` over an AppKit vibrancy material, so expect a
   tint, not a recolour. Use `@media (prefers-reduced-transparency:reduce)` (90 %) or the Windows/Linux
   path as the honest upper bound. The `ui-sidebar` root's own paint of this token is disabled on
   macOS (`background:0 0`).
3. **Never expect to move**: the macOS window backdrop (native vibrancy), the darwin sidebar gradient
   literals (`#7a9bf0…`), the darwin New Session fill (`#ffffff8c` etc.), the `--dsw-elevation-*`
   recipes (`body,body *`, with literal shadow alphas), `--dsh-onboarding-border-angle`
   (`inherits:false`), and the third-party terminal/spreadsheet sheets.
4. **Hairlines**: `--dsw-elevation-stroke-color` at `body` covers only the components that do not
   rebind it; override `--dsw-alias-border-l1/l2/l3/l4` + `-l2-darkmode-thin` as well.
5. **Scrollbars**: overriding `--dsw-alias-scrollbar-bg-l1/-hover-l1` moves the base scrollbars;
   every elevated container (menus, dialogs, the composer card, the whole sidebar column) has already
   pinned itself to the `-l2` variants, and two regions pin themselves to `transparent`.

---

### Reproduction notes (scratch, `/tmp`, nothing under `/Applications` was touched)

* `node tools/asar.mjs list|cat <archive> <regex|path>` — the read-only ASAR reader at
  `dsh-plugin-theme-workbench/tools/asar.mjs`.
* `/tmp/dshreas/harvest.mjs` — walks the whole archive once and writes every CSS-looking string
  literal plus every `.css` asset into `/tmp/dshreas/all/` (5,199 blobs) with `_INDEX.tsv`.
  Restrict with the path regex `@deepseek-ai/dsh-[^/]*/lib/.*\.js$` or `\.css$`; binaries are skipped
  by a NUL sniff in the first 4 KiB.
* `/tmp/dshreas/rules.mjs <dir> [pathFilter]` — re-parses those blobs into `selector { decls }` and
  prints every rule containing `background`, which is how the table above was assembled.
* `/tmp/dshreas/*.js` — verbatim dumps of the five key bundles (`dsh-client-ui-conversation`,
  `-sidebar`, `-chat`, `-theme`, `-layout`) and of `lib/main.js`, `dsh-client-ui-primitives/lib/index.js`.
* `/tmp/dshreas/README-{theme,sidebar,layout,conversation,chat}.md` — the packages' own READMEs, used
  for the prose half of the rebinding contract.
