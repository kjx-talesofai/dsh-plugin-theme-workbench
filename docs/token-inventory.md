# Theme Workbench — token inventory (DSH 0.2.0-rc.2 desktop bundle)

Read-only inspection of `/Applications/DeepSeek Harness.app/Contents/Resources/app.asar`
(11,480 entries, 121,387,457 bytes). Every claim below is quoted from a file actually read out of
that archive. Inner paths are relative to the archive root and start with `dsh/`.

**Headline facts**

| | |
| --- | --- |
| Authoritative palette stylesheet | `dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js` (one 19,120-char inlined string, `design_platform_css_default`, line 1148) |
| Selector — light | `body` (+ `html[data-platform=darwin] body` for one override) |
| Selector — dark | `body[data-ds-dark-theme]` (+ `html[data-platform=darwin] body[data-ds-dark-theme]`) |
| `--dsw-alias-*` names defined for the palettes | **107** (101 in `design-platform.css`, 2 in `base.css`, 4 in `onboarding.css`) |
| `--dsw-static-*` raw palette entries | 77 |
| `--dsw-specific-*` (+ `--dsw-menu-surface-fill`) | 12 |
| DOM application | `ui-layout`'s `ThemePresenter.apply()` writes every `snapshot.active.tokens` entry as an **inline custom property on `document.body`** via `body.style.setProperty()`, and retracts the previous set first |

---

## 1. Where the built-in light/dark palettes actually live

### 1.1 The palette is not a `.css` file — it is an inlined JS string

There is **no** `design-platform.css` entry in the archive. The ui-theme client bundle embeds eight
stylesheets as string literals and registers them in a `STYLES` table:

`dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js`

```js
//#region \0dsh-inline-css:/Users/hrsonion/Developer/harness/dsh-macos-arm64/packages/client/ui-theme/src/styles/design-platform.css.mjs
var design_platform_css_default = "body{--dsw-static-amber-100:#fef5e7;--dsw-static-amber-400:#f7ad31;…";
//#endregion
…
const PLUGIN_ID = "@deepseek-ai/dsh-client-ui-theme";
const STYLES = [
    ["base.css", base_css_default],
    ["corner-shape.css", corner_shape_css_default],
    ["design-platform.css", design_platform_css_default],
    ["focus.css", focus_css_default],
    ["onboarding.css", onboarding_css_default],
    ["scrollbar.css", scrollbar_css_default],
    ["gradient-shadow-text.css", gradient_shadow_text_css_default],
    ["shiki.css", shiki_css_default]
];
```

and injects each one as a plugin-owned global `<style>`:

```js
function installThemeStyles(ctx) {
    if (typeof document === "undefined") return;
    for (const [name, css] of STYLES) ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = PLUGIN_ID;
        tag.dataset.pluginCss = `${PLUGIN_ID}/${name}`;
        tag.textContent = css;
        document.head.appendChild(tag);
        return () => {
            tag.remove();
        };
    }, `ui-theme: ${name} stylesheet`);
}
```

The six top-level rules of `design-platform.css`, in source order
(`body`×3, `body[data-ds-dark-theme]`×3), are:

| # | selector | contents |
| --- | --- | --- |
| 0 | `body` | 77 `--dsw-static-*` raw palette entries (light) |
| 1 | `body[data-ds-dark-theme]` | 77 `--dsw-static-*` raw palette entries (dark) |
| 2 | `body` | 101 custom props: the **light alias/specific layer**, plus `background-color:var(--dsw-alias-bg-base)` |
| 3 | `body[data-ds-dark-theme]` | 101 custom props: the **dark alias/specific layer** |
| 4 | `html[data-platform=darwin] body` | `--dsw-specific-menu:#f8f9faf0` |
| 5 | `html[data-platform=darwin] body[data-ds-dark-theme]` | `--dsw-specific-menu:#303136f0` |

Verbatim head of rule 2 (light alias layer) — note the token starts on the selector `body`, and the
only non-custom-property declaration in the whole sheet sits at its **end**:

```css
body{--dsw-alias-bg-base:var(--dsw-static-neutral-bluish-00);--dsw-alias-bg-document-preview:var(--dsw-static-neutral-bluish-100);--dsw-alias-bg-document-selection:color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent);…--dsw-specific-tip:var(--dsw-static-neutral-bluish-60);background-color:var(--dsw-alias-bg-base)}
```

Verbatim head of rule 3 (dark alias layer):

```css
body[data-ds-dark-theme]{--dsw-alias-bg-base:var(--dsw-static-neutral-bluish-950);--dsw-alias-bg-document-preview:var(--dsw-static-neutral-bluish-950);--dsw-alias-bg-document-selection:color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent);--dsw-alias-label-document-preview:v…}
```

Verbatim head of rules 0 and 1:

```css
body{--dsw-static-amber-100:#fef5e7;--dsw-static-amber-400:#f7ad31;--dsw-static-amber-500:#f59e0b;…}
body[data-ds-dark-theme]{--dsw-static-amber-100:#fef5e7;--dsw-static-amber-400:#f7ad31;--dsw-static-amber-500:#f59e0b;…}
```

The dark static layer is **not** simply an inverted copy; exactly one entry differs between the two
raw palettes:

```css
/* light */ --dsw-static-neutral-bluish-60:#f5f6f7
/* dark  */ --dsw-static-neutral-bluish-60:#f9fafb
```

### 1.2 Answers to the specific questions

* **Selector for the light palette:** `body` — *not* `:root`/`html`. The style element is appended to
  `document.head`, but the custom properties are declared on `body`, so `html`-level consumers cannot
  see them (only inheriting descendants of `body` can).
* **Selector for the dark palette:** `body[data-ds-dark-theme]` — there is **no**
  `html[data-ds-dark-theme]` rule anywhere. The attribute is set on `<body>` by the layout presenter
  (§2), and the pre-plugin bootstrap also sets it before scripts run (see the ui-theme README:
  "A body script then sets `body[data-ds-dark-theme]` and `--dsh-content-font-size` before the
  loading page and application scripts").
* **Is the alias layer for both modes in `design-platform.css`?** Yes — both the light and the dark
  alias layers are the two `body`-scoped rules inside that single sheet. They are *not* in
  `dsh-client-ui-layout` (which contains no palette at all) and *not* in a frontend CSS asset.
* **Frontend assets define nothing.** `dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/`
  holds only `index-BPHePDI_.css` (76,338 B) and `vendor-BNsW4eBh.css` (29,288 B).
  `index-BPHePDI_.css` *consumes* 55 distinct `--dsw-alias-*` names via `var(…)` but defines zero.
  `vendor-BNsW4eBh.css` contains zero `--dsw-*` references.
  Archive-wide, a *definition* (`--dsw-alias-<name>:`) appears in only these places: the ui-theme
  `lib/client.js` bundle, `lib/welcome/welcome.css`, `renderer/welcome.css`,
  `renderer/assets/welcome-brand.svg` (inlined SVG CSS), and two one-off component-sheet overrides
  (`dsh-client-ui-chat/lib/client.js` rebinds `--dsw-alias-label-shimmer`;
  `dsh-client-ui-plugin-manager/lib/client.js` rebinds three button/interactive tokens to the error
  colour for its danger zone).
* **Additional alias declarations elsewhere** (all inside the same plugin bundle, all also `body` /
  `body[data-ds-dark-theme]`):
  * `base.css` (same `client.js`, line 1163) — 2 aliases: `--dsw-alias-settings-card-fill`,
    `--dsw-alias-settings-card-stroke`, both plain `var()` indirections, declared once (mode-agnostic):
    ```css
    body{--dsw-alias-settings-card-fill:var(--dsw-alias-bg-layer-2);--dsw-alias-settings-card-stroke:var(--dsw-alias-border-l4)}
    ```
  * `onboarding.css` (same `client.js`, line 1154) — 4 aliases with their own light/dark pair:
    ```css
    body{--dsw-alias-onboarding-accent:#3964fe;…;--dsw-alias-onboarding-card-fill:color-mix(in srgb, var(--dsw-static-neutral-bluish-00) 80%, transparent);--dsw-alias-onboarding-secondary-fill:var(--dsw-static-neutral-bluish-00);--dsw-alias-onboarding-checkbox-border:color-mix(in srgb, var(--dsw-static-neutral-bluish-1000) 20%, transparent)}
    body[data-ds-dark-theme]{--dsw-alias-onboarding-card-fill:color-mix(in srgb, var(--dsw-static-neutral-bluish-850) 80%, transparent);--dsw-alias-onboarding-secondary-fill:#48494c;--dsw-alias-onboarding-checkbox-border:var(--dsw-alias-border-l2)}
    ```
  * `onboarding.css` also declares 3 mode-independent gradient stop lists
    (`--dsw-gradient-onboarding-{violet,blue,cyan}-stops`) and `design-platform.css` one extra
    non-prefixed token, `--dsw-menu-surface-fill`.
* **A second, plain-CSS copy of the palette exists for the Electron welcome window**, with identical
  names and *values* but `rgb(r, g, b)` notation instead of hex:
  `lib/welcome/welcome.css` (36,978 B).
  It has the same 6-rule structure (`body`, `body[data-ds-dark-theme]`,
  `html[data-platform=darwin] …`) and the same counts (101 alias / 77 static / 11 specific). It is
  not the sheet the running Web GUI uses; the Web GUI gets `design_platform_css_default`. (The SVG
  asset `renderer/assets/welcome-brand.svg` embeds a fourth, tiny hardcoded copy — 2 aliases in an
  inlined `<style>`.)
* **`renderer/welcome.css` is a third, independent mini-palette** for the native credential window:
  11 hardcoded aliases (`--dsw-alias-label-primary: #0f1115`, `--dsw-alias-border-l2: #0000001a`, …)
  switched by `@media (prefers-color-scheme: dark)`, **not** by `body[data-ds-dark-theme]`. That
  window follows the OS scheme and ignores the in-app theme preference.

---

## 2. How the active theme's tokens reach the DOM

**File:** `dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js`
**Class:** `ThemePresenter` (lines 512–563), wired up at lines 674–684.

* **DOM target:** `document.body` — every token becomes an **inline custom property on `<body>`**.
  `document.documentElement` receives only `style.colorScheme` and the `data-ds-theme-source`
  attribute; `<head>` receives one owned `<meta name="theme-color">`.
* **Mechanism:** direct inline `element.style.setProperty(name, value)` / `removeProperty(name)`.
  No generated `<style>` tag, no `CSSStyleSheet`/`adoptedStyleSheets`, no stylesheet rewriting.
  (The token *stylesheets* themselves are injected separately by ui-theme as `<style>` tags — §1.1 —
  but that is fixed text, not the active theme.)
* **Cleanup:** **yes, there is explicit retraction.** `appliedTokens` records what the last `apply()`
  wrote and every name is `removeProperty`-ed before the new set is written, so nothing leaks or
  accumulates across theme switches, and a token that disappears from the new theme is removed
  rather than left stale. `dispose()` repeats the removal.
* **Applied for which themes:** unconditionally, for **all** themes, built-ins included — the loop
  walks `snapshot.active.tokens` regardless of `active.id`. For the built-in `light`/`dark` themes
  that map is `Object.freeze({})`, so the loop is a no-op and the stylesheet palettes win. It is not
  gated on "is this a third-party theme".

Verbatim, `dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js:498-563`:

```js
/** Body attribute selecting the dark base palette in the token stylesheets. */
const DARK_ATTRIBUTE = "data-ds-dark-theme";
const THEME_SOURCE_ATTRIBUTE = "data-ds-theme-source";
/** Body variable carrying the user's content font size in px. */
const CONTENT_FONT_SIZE_VARIABLE = "--dsh-content-font-size";
/** Applies theme snapshots to the document; one instance per plugin fiber. */
var ThemePresenter = class {
    /** Token names this presenter wrote in the last apply (its retraction set). */
    appliedTokens = [];
    /** The single metadata node this presenter inserts and removes. */
    themeColorMeta;
    constructor() {
        this.themeColorMeta = document.createElement("meta");
        this.themeColorMeta.name = "theme-color";
    }
    apply(snapshot) {
        const scheme = snapshot.active.colorScheme;
        document.documentElement.style.colorScheme = scheme;
        document.documentElement.setAttribute(THEME_SOURCE_ATTRIBUTE, snapshot.preference === "system" ? "system" : scheme);
        const body = document.body;
        if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");
        else body.removeAttribute(DARK_ATTRIBUTE);
        body.style.setProperty(CONTENT_FONT_SIZE_VARIABLE, `${snapshot.fontSize}px`);
        for (const name of this.appliedTokens) body.style.removeProperty(name);
        this.appliedTokens = [];
        for (const [name, value] of Object.entries(snapshot.active.tokens)) {
            body.style.setProperty(name, value);
            this.appliedTokens.push(name);
        }
        this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
        if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
    }
    dispose() {
        document.documentElement.style.removeProperty("color-scheme");
        document.documentElement.removeAttribute(THEME_SOURCE_ATTRIBUTE);
        const body = document.body;
        body.removeAttribute(DARK_ATTRIBUTE);
        body.style.removeProperty(CONTENT_FONT_SIZE_VARIABLE);
        for (const name of this.appliedTokens) body.style.removeProperty(name);
        this.appliedTokens = [];
        this.themeColorMeta.remove();
    }
};
```

Verbatim, the effect that owns it (`…ui-layout/lib/client.js:674-684`):

```js
ctx.effect(() => {
    const presenter = new ThemePresenter();
    presenter.apply(ctx.theme.getTheme());
    const off = ctx.on("theme/change", (snapshot) => {
        presenter.apply(snapshot);
    });
    return () => {
        off();
        presenter.dispose();
    };
}, "ui-layout: theme presenter");
```

`dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/README.md:45` states the same contract:

> The presenter consumes resolved theme snapshots and projects them onto the document:
> `html { color-scheme }` for native UA chrome, `body[data-ds-dark-theme]` from the active color
> scheme, the theme's alias tokens and `--dsh-content-font-size` as inline variables on body, and one
> owned `<meta name="theme-color">` whose content follows the computed body background.

### 2.1 How a third-party theme's tokens get *into* the snapshot

`dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js` (`ThemeRuntime`):

* `register({ id, colorScheme, tokens })` only rejects `id === "system"` and duplicate ids — it does
  **not** validate token names or completeness (README: "no validation exists that an override set is
  complete").
* `overrideTokens(source, tokens)` requires `Record<name, { light, dark }>`; a bare string throws a
  teaching error, and the message explicitly warns "a single value goes illegible when the user
  switches color scheme".
* `composeActive(active)` folds override layers in `seq` order, later layers winning per token, and
  picks `modes[active.colorScheme]` so the presenter never sees override bookkeeping:

```js
composeActive(active) {
    if (this.overrides.size === 0) return active;
    const tokens = { ...active.tokens };
    for (const layer of [...this.overrides.values()].sort((a, b) => a.seq - b.seq)) for (const [name, modes] of Object.entries(layer.tokens)) tokens[name] = modes[active.colorScheme];
    return Object.freeze({ ...active, tokens: Object.freeze(tokens) });
}
```

* The built-ins really are empty:

```js
const BUILTIN_THEMES = Object.freeze([Object.freeze({
    id: "light", colorScheme: "light", tokens: Object.freeze({})
}), Object.freeze({
    id: "dark", colorScheme: "dark", tokens: Object.freeze({})
})]);
```

* **There is also a hardcoded, deliberately small "inspect" inventory** that tooling sees —
  `BUILTIN_INSPECT_TOKENS` (`…ui-theme/lib/client.js:1234-1333`): 14 entries
  (`bg-base`, `bg-layer-1`, `bg-layer-2`, `bg-overlay`, `border-l1`, `border-l2`, `brand-primary`,
  `label-primary`, `label-secondary`, `state-error-primary`, `state-idle-primary`,
  `state-success-primary`, `state-warn-primary`, `specific-sidebar-fill`), each with a
  `description` and `requiresLightAndDark: true`. `exportInspectTokens()` unions this list with
  whatever registered themes/overrides add, filling gaps with `dynamicToken(name)`
  (`description: "Theme token registered by the current Client composition."`). **This list is not the
  themeable surface** — it is 14 of the 107 palette names, and a Theme Workbench UI that shows only
  `exportInspectTokens()` will hide 93 real tokens unless it merges them in itself.
---

## 3. The complete themeable token inventory

**Definition of the surface used here** — every `--dsw-alias-*` variable that the built-in light/dark
palettes actually define. A third-party theme can only meaningfully override names that already
exist, because every consumer in the bundle is a `var(--dsw-alias-…)` reference to a name the
palettes declare. That set is:

| source | file (inlined into `dsh-client-ui-theme/lib/client.js`) | `--dsw-alias-*` count |
| --- | --- | --- |
| `design-platform.css` | line 1148, `body` + `body[data-ds-dark-theme]` | 101 |
| `base.css` | line 1163, `body` (mode-agnostic `var()` indirections) | 2 |
| `onboarding.css` | line 1154, `body` + `body[data-ds-dark-theme]` | 4 |
| **total** | | **107** |

**107 is the authoritative count** — 101 names have both a light and a dark declaration; 6 are the
`base.css`/`onboarding.css` additions above. All 107 are listed below, none sampled or truncated.

**Notation.** The *light* / *dark* cell shows the value exactly as declared, and — when the
declaration is a `var(--dsw-static-…)` indirection — the concrete colour it resolves to in that same
mode (`declared` → `resolved`, following `var()` chains inside the mode's own static layer).
`color-mix()` and other functional values are shown verbatim because they resolve at use time.

### Backgrounds & surfaces

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-bg-base` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-950)` → `#151517` | Application canvas. Painted on `body` itself (`body{background-color:var(--dsw-alias-bg-base)}`), so it also becomes the `<meta name="theme-color">` value. |
| `--dsw-alias-bg-layer-1` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-875)` → `#232324` | First raised surface (cards, panels, composer) above the canvas. |
| `--dsw-alias-bg-layer-2` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-850)` → `#2c2c2e` | Second nested surface (settings cards, nested panels). |
| `--dsw-alias-bg-layer-3` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | Third nested surface (controls inside an already-raised surface). |
| `--dsw-alias-bg-overlay` | `var(--dsw-static-neutral-bluish-150)` → `#e9ecf2` | `var(--dsw-static-neutral-bluish-700)` → `#61666b` | Popover / overlay background. |
| `--dsw-alias-bg-module-platform` | `var(--dsw-static-neutral-bluish-60)` → `#f5f6f7` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | Platform (login / account) module background blocks. |
| `--dsw-alias-bg-multi-select` | `var(--dsw-static-neutral-bluish-60)` → `#f5f6f7` | `var(--dsw-static-neutral-850)` → `#212123` | Multi-select row fill. |
| `--dsw-alias-bg-skeleton` | `#0000000a` | `#ffffff14` | Loading skeleton fill (translucent, sits on any surface). |
| `--dsw-alias-bg-document-preview` | `var(--dsw-static-neutral-bluish-100)` → `#ebeef2` | `var(--dsw-static-neutral-bluish-950)` → `#151517` | Backdrop behind an original-document preview; pair with `label-document-preview`. |
| `--dsw-alias-bg-document-selection` | `color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent)` | `color-mix(in srgb, var(--dsw-static-blue-500) 40%, transparent)` | Selection highlight drawn over original document colors; blue-500 at 40% in **both** palettes. |
| `--dsw-alias-bg-mask-1` | `#0000003d` | `#00000080` | Lightest scrim (e.g. behind a lightbox). |
| `--dsw-alias-bg-mask-2` | `#0000001f` | `#0003` | Medium scrim. |
| `--dsw-alias-bg-mask-3` | `#0000007a` | `#0000007a` | Modal mask; identical in both palettes. |
| `--dsw-alias-bg-mask-photo` | `#000000e0` | `#000000e0` | Photo / media lightbox mask; identical in both palettes. |
| `--dsw-alias-bg-mask-drop` | `#ffffffb3` | `#272730b3` | Drop-target veil over the app while dragging a file. |

### Borders

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-border-l1` | `#0000000a` | `#ffffff0f` | Subtle hairline (dark menus use l3; light menus use l1). |
| `--dsw-alias-border-l2` | `#0000001a` | `#ffffff1f` | Default border for inputs, cards, separators (most-used border). |
| `--dsw-alias-border-l2-darkmode-thin` | `#0000001a` | `#ffffff0f` | Per-mode "thin l2": equals l2 in light and the lighter l1 in dark. |
| `--dsw-alias-border-l3` | `#0000001f` | `#ffffff29` | Stronger border / elevated-surface stroke, dark-mode menu stroke. |
| `--dsw-alias-border-l4` | `#00000029` | `#fff3` | Strongest border; also the settings-card stroke. |
| `--dsw-alias-border-inverted` | `#0000` | `#ffffff0f` | Border that reads as the inverse of the surface (transparent in light). |
| `--dsw-alias-border-inverted2` | `#0000` | `#ffffff14` | Second inverted border step (transparent in light). |

### Labels & text

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-label-primary` | `var(--dsw-static-neutral-bluish-1000)` → `#0f1115` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | Primary body/heading text. |
| `--dsw-alias-label-primary-foreground` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-1000)` → `#0f1115` | Text/icon colour to place **on** brand-primary (inverse of label-primary). |
| `--dsw-alias-label-primary-inverted` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | Inverse-of-surface text for inverted chips (not the same as *-foreground). |
| `--dsw-alias-label-primary-dimmed` | `var(--dsw-static-neutral-bluish-950)` → `#151517` | `var(--dsw-static-neutral-bluish-100)` → `#ebeef2` | Slightly dimmed primary text (also the dark-mode menu icon). |
| `--dsw-alias-label-primary-bluish` | `var(--dsw-static-blue-900)` → `#0e3074` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | Bluish primary text (light: blue-900; dark: neutral-bluish-50). |
| `--dsw-alias-label-secondary` | `var(--dsw-static-neutral-bluish-700)` → `#61666b` | `var(--dsw-static-neutral-bluish-300)` → `#cfd3d6` | Secondary text, descriptions, inactive tab labels. |
| `--dsw-alias-label-tertiary` | `var(--dsw-static-neutral-bluish-600)` → `#81858c` | `var(--dsw-static-neutral-bluish-400)` → `#adb2b8` | Tertiary / hint / placeholder-scale text (most-used token in the bundle: 350 refs). |
| `--dsw-alias-label-caption` | `var(--dsw-static-neutral-bluish-400)` → `#adb2b8` | `var(--dsw-static-neutral-bluish-600)` → `#81858c` | Caption and metadata text (smallest tier). |
| `--dsw-alias-label-dimmed` | `var(--dsw-static-neutral-bluish-200)` → `#e1e5ee` | `var(--dsw-static-neutral-bluish-750)` → `#43454a` | Dimmed text for unavailable content. |
| `--dsw-alias-label-shimmer` | `color-mix(in srgb, var(--dsw-static-neutral-1000) 30%, transparent)` | `color-mix(in srgb, var(--dsw-static-neutral-00) 45%, transparent)` | Shimmer sweep overlay: black 30% in light, white 45% in dark. |
| `--dsw-alias-label-deep-diving` | `color-mix(in srgb, var(--dsw-static-deepseek-500) 70%, var(--dsw-static-blue-950))` | `color-mix(in srgb, var(--dsw-static-deepseek-450) 55%, var(--dsw-static-neutral-bluish-400))` | Blue "deep diving" activity label (color-mix of deepseek + blue/neutral). |
| `--dsw-alias-label-deep-diving-shimmer` | `color-mix(in srgb, var(--dsw-static-deepseek-500) 30%, var(--dsw-static-blue-950))` | `color-mix(in srgb, var(--dsw-static-blue-300) 65%, var(--dsw-static-deepseek-400))` | Sweep colour for the deep-diving label. |
| `--dsw-alias-label-document-preview` | `var(--dsw-static-neutral-bluish-700)` → `#61666b` | `var(--dsw-static-neutral-bluish-300)` → `#cfd3d6` | Status text over `bg-document-preview`. |
| `--dsw-alias-link` | `var(--dsw-static-deepseek-500)` → `#4176e6` | `var(--dsw-static-deepseek-400)` → `#7aaaff` | Hyperlink / inline link text. |

### Brand

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-brand-primary` | `var(--dsw-static-neutral-bluish-1000)` → `#0f1115` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | Primary brand accent — a monochrome near-black in light / near-white in dark, **not** the blue. |
| `--dsw-alias-brand-primary-invert` | `var(--dsw-static-neutral-bluish-1000)` → `#0f1115` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | Inverse of brand-primary (current light/dark values happen to match brand-primary). |
| `--dsw-alias-brand-primary-new-colorprimary-new-color` | `#4176e6` | `var(--dsw-static-deepseek-450)` → `#5686fe` | The real blue brand accent (`#4176e6` light / deepseek-450 dark). Odd duplicated name — see gotchas. |
| `--dsw-alias-brand-text` | `var(--dsw-static-neutral-bluish-1000)` → `#0f1115` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | Brand wordmark text colour. |

### State

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-state-business-primary` | `var(--dsw-static-deepseek-500)` → `#4176e6` | `var(--dsw-static-deepseek-400)` → `#7aaaff` | Primary "business / info / running" blue; also the focus-ring fallback colour. |
| `--dsw-alias-state-business-tertiary` | `var(--dsw-static-deepseek-100)` → `#e4edfd` | `var(--dsw-static-deepseek-800)` → `#34415b` | Tinted business background. |
| `--dsw-alias-state-error-primary` | `var(--dsw-static-red-600)` → `#ec1313` | `var(--dsw-static-red-400)` → `#f25a5a` | Primary error red. |
| `--dsw-alias-state-error-secondary` | `var(--dsw-static-red-400)` → `#f25a5a` | `var(--dsw-static-red-400)` → `#f25a5a` | Secondary error red (identical in light and dark). |
| `--dsw-alias-state-idle-primary` | `var(--dsw-static-neutral-300)` → `#d4d4d4` | `var(--dsw-static-neutral-600)` → `#545557` | Idle / inactive status dot. |
| `--dsw-alias-state-success-primary` | `var(--dsw-static-green-500)` → `#22c55e` | `var(--dsw-static-green-500)` → `#22c55e` | Primary success green (identical in light and dark). |
| `--dsw-alias-state-success-secondary` | `var(--dsw-static-green-400)` → `#4ed17e` | `var(--dsw-static-green-400)` → `#4ed17e` | Secondary success green (identical in light and dark). |
| `--dsw-alias-state-success-tertiary` | `var(--dsw-static-green-100)` → `#e6faed` | `var(--dsw-static-green-900)` → `#233c2c` | Tinted success background. |
| `--dsw-alias-state-warn-primary` | `var(--dsw-static-amber-500)` → `#f59e0b` | `var(--dsw-static-amber-500)` → `#f59e0b` | Primary warning amber (identical in light and dark). |
| `--dsw-alias-state-warn-secondary` | `var(--dsw-static-amber-400)` → `#f7ad31` | `var(--dsw-static-amber-400)` → `#f7ad31` | Secondary warning amber (identical in light and dark). |
| `--dsw-alias-state-warn-tertiary` | `var(--dsw-static-amber-100)` → `#fef5e7` | `var(--dsw-static-amber-900)` → `#27241f` | Tinted warning background. |
| `--dsw-alias-state-warn-label` | `var(--dsw-static-amber-600)` → `#dd8629` | `var(--dsw-static-amber-600)` → `#dd8629` | Warning *text* colour — amber-600 in both palettes (dark-mode legibility gotcha). |

### Buttons, controls & interactive

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-button-primary-fill` | `var(--dsw-alias-brand-primary)` → `#0f1115` | `var(--dsw-alias-brand-primary)` → `#f9fafb` | Primary button fill; derived from `brand-primary`, not from the blue accent. |
| `--dsw-alias-button-primary-hover` | `var(--dsw-static-neutral-bluish-750)` → `#43454a` | `var(--dsw-static-neutral-bluish-100)` → `#ebeef2` | Primary button hover fill. |
| `--dsw-alias-button-primary-dimmed` | `var(--dsw-static-neutral-bluish-100)` → `#ebeef2` | `var(--dsw-static-neutral-bluish-750)` → `#43454a` | Primary button disabled/dimmed fill. |
| `--dsw-alias-button-contrast-fill` | `var(--dsw-static-neutral-bluish-700)` → `#61666b` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | High-contrast (dark-on-light / light-on-dark) button fill. |
| `--dsw-alias-button-elevated-fill` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-750)` → `#43454a` | Fill of a button raised on a raised surface. |
| `--dsw-alias-button-floating-fill` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-850)` → `#2c2c2e` | Floating / ghost-circular button fill. |
| `--dsw-alias-button-floating-hover` | `var(--dsw-static-neutral-bluish-75)` → `#f1f3f5` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | Floating button hover fill. |
| `--dsw-alias-button-ghost-active-fill` | `var(--dsw-static-neutral-bluish-100)` → `#ebeef2` | `var(--dsw-static-neutral-bluish-750)` → `#43454a` | Active (pressed/selected) ghost button fill. |
| `--dsw-alias-button-ghost-active-border` | `var(--dsw-static-neutral-bluish-500)` → `#979da6` | `var(--dsw-static-neutral-bluish-600)` → `#81858c` | Active ghost button border. |
| `--dsw-alias-button-ghost-active-hover` | `var(--dsw-static-neutral-bluish-150)` → `#e9ecf2` | `var(--dsw-static-neutral-bluish-700)` → `#61666b` | Hover fill on an already-active ghost button. |
| `--dsw-alias-button-info-fill` | `var(--dsw-static-deepseek-500)` → `#4176e6` | `var(--dsw-static-deepseek-400)` → `#7aaaff` | Info (blue) button fill. |
| `--dsw-alias-button-info-hover` | `var(--dsw-static-deepseek-400)` → `#7aaaff` | `var(--dsw-static-deepseek-500)` → `#4176e6` | Info button hover fill. |
| `--dsw-alias-button-tool-bar-fill` | `#54555780` | `#54555780` | Translucent toolbar button fill; **identical in light and dark**. |
| `--dsw-alias-button-tool-bar-fill-invisible` | `#1f1f1f5c` | `#1f1f1f5c` | Resting toolbar button fill (nearly invisible); identical in both palettes. |
| `--dsw-alias-button-tool-bar-hover` | `#54555799` | `#54555799` | Toolbar button hover fill; identical in both palettes. |
| `--dsw-alias-interactive-bg-hover` | `#2631480f` | `#ffffff14` | Generic hover wash (153 refs) — the default hover overlay. |
| `--dsw-alias-interactive-bg-hover-solid` | `var(--dsw-static-neutral-bluish-75)` → `#f1f3f5` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | Opaque hover fill for surfaces that must not show through. |
| `--dsw-alias-interactive-bg-hover-accent` | `#26314824` | `#ffffff3d` | Stronger accent hover wash. |
| `--dsw-alias-interactive-bg-hover-danger` | `#ec13130d` | `#f25a5a26` | Danger hover wash (destructive rows/buttons). |
| `--dsw-alias-interactive-bg-active` | `#2631481a` | `#ffffff24` | Pressed / selected wash, one step stronger than hover. |
| `--dsw-alias-switch-thumb` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-400)` → `#adb2b8` | Switch knob: white in light, neutral-bluish-400 in dark (never pure white in dark). |

### Markdown & code

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-markdown-code-block` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | `var(--dsw-static-neutral-bluish-900)` → `#1b1b1c` | Code-block background; also the shiki `--shiki-background`. |
| `--dsw-alias-markdown-code-block-banner` | `var(--dsw-static-neutral-bluish-50)` → `#f9fafb` | `var(--dsw-static-neutral-bluish-850)` → `#2c2c2e` | Code-block title/banner strip. |
| `--dsw-alias-markdown-inline-code` | `var(--dsw-static-neutral-50)` → `#fafafa` | `var(--dsw-static-neutral-800)` → `#292929` | Inline `code` background. |
| `--dsw-alias-markdown-citation` | `var(--dsw-static-neutral-bluish-100)` → `#ebeef2` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | Citation chip background. |
| `--dsw-alias-markdown-tag` | `var(--dsw-static-neutral-bluish-75)` → `#f1f3f5` | `var(--dsw-static-neutral-bluish-850)` → `#2c2c2e` | Markdown tag / label chip background. |
| `--dsw-alias-markdown-placeholder` | `var(--dsw-static-neutral-bluish-60)` → `#f5f6f7` | `var(--dsw-static-neutral-bluish-850)` → `#2c2c2e` | Placeholder block background inside markdown. |
| `--dsw-alias-markdown-code-segment-selected` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | Selected segment in a multi-file code card. |
| `--dsw-alias-markdown-code-segment-unselected` | `var(--dsw-static-neutral-bluish-75)` → `#f1f3f5` | `var(--dsw-static-neutral-bluish-900)` → `#1b1b1c` | Unselected segment in a multi-file code card. |
| `--dsw-alias-turn-trigger-bg` | `var(--dsw-alias-markdown-code-block)` → `#f9fafb` | `var(--dsw-alias-interactive-bg-hover)` → `#ffffff14` | Turn-trigger notice resting background. **Derived differently per mode.** |
| `--dsw-alias-turn-trigger-bg-hover` | `var(--dsw-alias-interactive-bg-hover)` → `#2631480f` | `var(--dsw-alias-interactive-bg-active)` → `#ffffff24` | Turn-trigger notice hover background. |

### Diff & file comparison

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-code-diff-added` | `var(--dsw-static-green-500-a08)` → `#22c55e14` | `var(--dsw-static-green-500-a12)` → `#22c55e1f` | Inline added-line tint (translucent). |
| `--dsw-alias-code-diff-deleted` | `var(--dsw-static-red-600-a08)` → `#ec131314` | `var(--dsw-static-red-400-a12)` → `#f25a5a1f` | Inline deleted-line tint (translucent). |
| `--dsw-alias-file-diff-added-bg` | `#e6f4e7` | `#1f3124` | File-comparison added row background (opaque, hardcoded per mode). |
| `--dsw-alias-file-diff-added-gutter` | `#edf7ed` | `#132016` | File-comparison added gutter background (hardcoded per mode). |
| `--dsw-alias-file-diff-added-marker` | `#01a241` | `#41c977` | File-comparison added marker/glyph (hardcoded per mode). |
| `--dsw-alias-file-diff-deleted-bg` | `#fce6e2` | `#3c1f1b` | File-comparison deleted row background (hardcoded per mode). |
| `--dsw-alias-file-diff-deleted-gutter` | `#fdece9` | `#28130e` | File-comparison deleted gutter background (hardcoded per mode). |
| `--dsw-alias-file-diff-deleted-marker` | `#ba2723` | `#fa423e` | File-comparison deleted marker/glyph (hardcoded per mode). |

### Scrollbar

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-scrollbar-bg-l1` | `var(--dsw-static-neutral-200)` → `#e5e5e5` | `var(--dsw-static-neutral-700)` → `#3c3c3d` | Scrollbar thumb on base surfaces (bound to `--dsh-scrollbar-thumb`). |
| `--dsw-alias-scrollbar-bg-l2` | `var(--dsw-static-neutral-200)` → `#e5e5e5` | `var(--dsw-static-neutral-600)` → `#545557` | Scrollbar thumb on elevated surfaces (menus, popovers, dialogs). |
| `--dsw-alias-scrollbar-hover-l1` | `var(--dsw-static-neutral-300)` → `#d4d4d4` | `var(--dsw-static-neutral-600)` → `#545557` | Base-surface scrollbar thumb hover. |
| `--dsw-alias-scrollbar-hover-l2` | `var(--dsw-static-neutral-300)` → `#d4d4d4` | `var(--dsw-static-neutral-550)` → `#65676b` | Elevated-surface scrollbar thumb hover. |

### Menu, overlay, toast & tooltip

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-menu-icon` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | `var(--dsw-alias-label-primary-dimmed)` → `#ebeef2` | Menu row icon colour. Light hardcodes neutral-bluish-800; dark derives from `label-primary-dimmed`. |
| `--dsw-alias-menu-group-header-fill` | `#f8f9faf0` | `#303136f0` | Sticky menu group heading fill (94% opaque). |
| `--dsw-alias-toast-bg` | `var(--dsw-static-neutral-bluish-800)` → `#353638` | `var(--dsw-static-neutral-bluish-750)` → `#43454a` | System toast background. |
| `--dsw-alias-toast-label` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | System toast text (white in both palettes). |
| `--dsw-alias-tooltip-bg` | `var(--dsw-static-neutral-bluish-850)` → `#2c2c2e` | `var(--dsw-static-neutral-bluish-750)` → `#43454a` | Tooltip background. |
| `--dsw-alias-tooltip-key-bg` | `color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%)` | `color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%)` | Tooltip keycap fill, derived from `tooltip-bg` with `white 18%`. |

### Settings & onboarding (extension sheets)

| token | light | dark | what it's for |
| --- | --- | --- | --- |
| `--dsw-alias-settings-card-fill` | `var(--dsw-alias-bg-layer-2)` → `#fff` | `var(--dsw-alias-bg-layer-2)` → `#2c2c2e` | Settings card fill; declared in `base.css` as `var(--dsw-alias-bg-layer-2)`. |
| `--dsw-alias-settings-card-stroke` | `var(--dsw-alias-border-l4)` → `#00000029` | `var(--dsw-alias-border-l4)` → `#fff3` | Settings card stroke; declared in `base.css` as `var(--dsw-alias-border-l4)`. |
| `--dsw-alias-onboarding-accent` | `#3964fe` | — (none) | Onboarding accent blue `#3964fe`; declared only on `body` (no dark override). |
| `--dsw-alias-onboarding-card-fill` | `color-mix(in srgb, var(--dsw-static-neutral-bluish-00) 80%, transparent)` | `color-mix(in srgb, var(--dsw-static-neutral-bluish-850) 80%, transparent)` | Onboarding card fill, `color-mix` of a neutral over transparent. |
| `--dsw-alias-onboarding-secondary-fill` | `var(--dsw-static-neutral-bluish-00)` → `#fff` | `#48494c` | Onboarding secondary-action fill. |
| `--dsw-alias-onboarding-checkbox-border` | `color-mix(in srgb, var(--dsw-static-neutral-bluish-1000) 20%, transparent)` | `var(--dsw-alias-border-l2)` → `#ffffff1f` | Onboarding checkbox border; light mixes neutral-bluish-1000 20%, dark reuses `border-l2`. |

---

> Totals: **107 `--dsw-alias-*` tokens**, 15 families. Reference counts quoted in the
> "what it's for" column come from a 2,847-file scan of the bundle.
---

## 4. Gotchas for theme authors

### 4.1 Prefer `--dsw-alias-*` overrides; `--dsw-static-*` overrides cascade

Most aliases are one-step indirections to a raw palette entry
(`--dsw-alias-bg-base: var(--dsw-static-neutral-bluish-00)`). Overriding an alias is local and safe.
Overriding a `--dsw-static-*` entry is a blunt instrument: because the presenter writes on `body`,
one inline `--dsw-static-neutral-bluish-00` recolours *every* alias that references it. Useful for a
wholesale re-tint, dangerous otherwise. Note also that `--dsw-static-*` is **not** validated
anywhere; the palette is only a convention.

### 4.2 Aliases derived from other aliases (must stay consistent)

These reference another *alias*, so overriding only one side of the pair silently breaks it:

| derived token | expression (light) | expression (dark) |
| --- | --- | --- |
| `--dsw-alias-settings-card-fill` | `var(--dsw-alias-bg-layer-2)` | same |
| `--dsw-alias-settings-card-stroke` | `var(--dsw-alias-border-l4)` | same |
| `--dsw-alias-button-primary-fill` | `var(--dsw-alias-brand-primary)` | `var(--dsw-alias-brand-primary)` |
| `--dsw-alias-tooltip-key-bg` | `color-mix(in srgb, var(--dsw-alias-tooltip-bg), white 18%)` | same |
| `--dsw-alias-menu-icon` | `var(--dsw-static-neutral-bluish-800)` (hardcoded static) | `var(--dsw-alias-label-primary-dimmed)` |
| `--dsw-alias-turn-trigger-bg` | `var(--dsw-alias-markdown-code-block)` | `var(--dsw-alias-interactive-bg-hover)` |
| `--dsw-alias-turn-trigger-bg-hover` | `var(--dsw-alias-interactive-bg-hover)` | `var(--dsw-alias-interactive-bg-active)` |
| `--dsw-alias-onboarding-checkbox-border` | `color-mix(in srgb, var(--dsw-static-neutral-bluish-1000) 20%, transparent)` | `var(--dsw-alias-border-l2)` |

Two of them are **mode-asymmetric derivations**, i.e. the same token is bound to a *different* source
in each mode: `--dsw-alias-menu-icon` (static 800 in light, `label-primary-dimmed` in dark — the
ui-theme README calls this out explicitly) and both `--dsw-alias-turn-trigger-*` tokens ("Dark
notices use brighter interactive layers so the resting card remains distinct from the transcript
background"). A theme that overrides `markdown-code-block` but not `turn-trigger-bg` therefore gets
an unexpected light-mode change only.

Also remember the `var()`-in-a-custom-property rule: an inline
`--dsw-alias-x: var(--dsw-alias-y)` written on `body` is substituted against **body's** computed
values, so it will not pick up a *descendant*'s rebinding of `--dsw-alias-y`.

### 4.3 `color-mix()` and alpha usage

* `color-mix(in srgb, …)` is used by: `--dsw-alias-bg-document-selection` (blue-500 40%,
  **identical in both modes**), `--dsw-alias-label-shimmer`, both `--dsw-alias-label-deep-diving*`,
  `--dsw-alias-tooltip-key-bg` (mixes toward literal `white`, in both modes), and
  `--dsw-alias-onboarding-{card-fill,checkbox-border}`.
* Many borders/surfaces are 8-digit hex alphas (`#0000000a`, `#ffffff1f`, `#fff3` …). A theme value
  may be any CSS colour, but the alpha is what makes these read as "hairlines" on any surface; an
  opaque replacement changes visual weight noticeably.
* `--dsw-alias-bg-mask-3` (`#0000007a`), `--dsw-alias-bg-mask-photo` (`#000000e0`) and
  `--dsw-alias-button-tool-bar-fill` (`#54555780`) / `-fill-invisible` (`#1f1f1f5c`) /
  `-tool-bar-hover` (`#54555799`) are **byte-identical in light and dark**. If your theme supplies a
  single value for them via `overrideTokens`, nothing breaks — but a dark-only theme that forgets
  them will keep the light-mode translucency.

### 4.4 Border levels are not parallel between modes

```
light : l1 #0000000a   l2 #0000001a   l2-darkmode-thin #0000001a   l3 #0000001f   l4 #00000029
dark  : l1 #ffffff0f   l2 #ffffff1f   l2-darkmode-thin #ffffff0f   l3 #ffffff29   l4 #fff3
```

`--dsw-alias-border-l1` and `--dsw-alias-border-l3` differ in *direction*: l3 is stronger than l2 in
dark, while in light l3 (`#0000001f`) is only marginally above l2 (`#0000001a`). The dedicated
`--dsw-alias-border-l2-darkmode-thin` exists precisely because dark mode wants the *thinner* l1
value where light keeps l2 — do not "simplify" it into l2. Per the ui-theme README: "Dark menus use a
45%-opaque gray fill and the `border-l3` stroke; light menus retain their `border-l1` stroke."
`--dsw-alias-border-inverted` / `-inverted2` are fully transparent (`#0000`) in light and
`#ffffff0f` / `#ffffff14` in dark.

### 4.5 State colours that do not change with the mode

`--dsw-alias-state-success-primary` (green-500), `-secondary` (green-400),
`--dsw-alias-state-error-secondary` (red-400), `--dsw-alias-state-warn-primary` (amber-500),
`-secondary` (amber-400) and **`--dsw-alias-state-warn-label` (amber-600)** are identical in both
palettes. `state-warn-label` is a *text* colour at amber-600 on a dark canvas — the obvious
dark-mode legibility trap, and a good target for a theme's dark override.

### 4.6 Syntax highlighting is outside the alias layer

`shiki.css` (inlined at `…ui-theme/lib/client.js:1160`) hardcodes `--shiki-token-*` per mode under
`:root` / `body[data-ds-dark-theme]`:

```css
:root{--shiki-foreground:var(--dsw-alias-label-primary);--shiki-background:var(--dsw-alias-markdown-code-block);--shiki-token-constant:#1c7ed6;--shiki-token-string:#2f9e44;--shiki-token-comment:#868e96;--shiki-token-keyword:#d6336c;--shiki-token-parameter:#e8590c;--shiki-token-function:#6741d9;…}
body[data-ds-dark-theme]{--shiki-token-constant:#4dabf7;--shiki-token-string:#69db7c;--shiki-token-comment:#adb5bd;--shiki-token-keyword:#faa2c1;--shiki-token-parameter:#ffa94d;--shiki-token-function:#b197fc;…}
```

Only `--shiki-foreground` and `--shiki-background` follow the alias layer (they map to
`--dsw-alias-label-primary` and `--dsw-alias-markdown-code-block`). A theme that darkens
`markdown-code-block` therefore keeps the default syntax hues; recolouring syntax means overriding
`--shiki-token-*` from an `overrideTokens()` layer (legal — nothing validates names) or shipping your
own CSS.

### 4.7 `--dsw-static-neutral-bluish-60` is the one per-mode static entry

`#f5f6f7` in light, `#f9fafb` in dark — the reverse of what the numbering implies. It feeds
`--dsw-alias-bg-module-platform`, `--dsw-alias-markdown-placeholder`, `--dsw-specific-selector` and
`--dsw-specific-tip`. Every other `--dsw-static-*` entry is shared by both modes.

### 4.8 Consumed-but-undefined aliases (dead references)

Ten `--dsw-alias-*` names are **used by component CSS but never declared by any palette**, so they
resolve to nothing (the declaration is invalid at computed-value time and the property falls back to
its initial/inherited value). A theme cannot "fix" them by overriding them unless it also declares
them — which `overrideTokens()`/`register()` will happily do:

| undefined token | referenced from | has a fallback? |
| --- | --- | --- |
| `--dsw-alias-bg-layer-4` | `dsh-client-ui-primitives/lib/settings-form/fields.module.css`, `dsh-client-ui-settings-subagent/lib/client.js`, frontend `index-BPHePDI_.css` | no |
| `--dsw-alias-label-error` | `dsh-client-ui-primitives/lib/settings-form/SettingsForm.module.css`, frontend `index-BPHePDI_.css` | no |
| `--dsw-alias-label-quaternary` | `dsh-client-ui-agent-preset/lib/client.js`, `dsh-client-ui-sidebar-browser/lib/client.js` | no |
| `--dsw-alias-fill-l1` | `dsh-client-ui-jobs/lib/client.js` | no |
| `--dsw-alias-fill-l2` | `dsh-client-ui-jobs/lib/client.js` | no |
| `--dsw-alias-fill-tsp-secondary` | `dsh-client-ui-agent-preset/lib/client.js` | no |
| `--dsw-alias-fill-tertiary` | `dsh-client-ui-attachment/lib/client.js` | yes — `var(--dsw-alias-fill-tertiary,#00000014)` |
| `--dsw-alias-separator-primary` | `dsh-client-ui-chat/lib/client.js` | no |
| `--dsw-alias-bg-l1` | `dsh-client-ui-sidebar-terminal/lib/client.js` | no |
| `--dsw-alias-bg-l2` | `dsh-client-ui-sidebar-terminal/lib/client.terminal.js` | no |

Conversely `--dsw-alias-onboarding-accent` is declared but effectively unused outside the
onboarding sheet, and it is the only alias with **no dark declaration** (its light rule is `body`,
and the dark rule omits it, so it stays `#3964fe` in dark).

### 4.9 Other traps

* **`--dsw-alias-brand-primary` is not blue.** It is near-black `#0f1115` in light and near-white
  `#f9fafb` in dark (it is the *contrast* accent). The blue brand accent is the awkwardly named
  `--dsw-alias-brand-primary-new-colorprimary-new-color` (`#4176e6` light / deepseek-450 `#5686fe`
  dark, 15 refs). A theme that treats `brand-primary` as "the brand colour" will invert the whole UI.
* **`--dsw-alias-brand-primary-invert`** currently resolves to the *same* value as `brand-primary` in
  both modes — a trap if you assume "invert" means the opposite.
* **`--dsw-alias-label-primary-foreground`** is the text colour for *on-brand* content (white in
  light, `#0f1115` in dark), which is the **inverse of `label-primary`**, whereas
  `--dsw-alias-label-primary-inverted` is a *different* token (white in light, `#353638` in dark) used
  for chips on inverted surfaces. They are not interchangeable.
* **Scrollbar level pairs collapse in light**: `scrollbar-bg-l1 == l2` (`#e5e5e5`) and
  `scrollbar-hover-l1 == hover-l2` (`#d4d4d4`) in light, but in dark they differ
  (`#3c3c3d`/`#545557` and `#545557`/`#65676b`). The l1/l2 distinction only exists in dark by design
  (l1 = base surfaces, l2 = elevated surfaces rebound by menus/popovers/dialogs).
* **`--dsw-alias-bg-document-selection` must stay blue-500 at 40% in both modes** (README: "uses
  blue-500 at 40% opacity in both themes for selections over original document colors") because it is
  composited over un-themed document pixels.
* **Overrides win over the sheet by construction** (inline `body` style beats the `body{}` rule), and
  in the *other* direction a theme can only reach what inherits from `body`. Anything declared on
  `:root`/`html` — the `--shiki-*` set, `--dsw-font-family*`, radii, `--dsw-focus-ring-width` — is
  outside the presenter's reach unless the consumer happens to be a descendant of `body` that
  re-resolves the `var()`.
* **`--dsw-specific-*` is not the alias surface but is equally themeable** (12 names; see appendix).
  `--dsw-alias-bg-base` is special-cased: it is both a token and the literal `background-color` of
  `body`, and the presenter reads that computed background into `<meta name="theme-color">` right
  after writing tokens. Setting `bg-base` to a non-colour or a gradient therefore also corrupts the
  theme-color metadata.
---

## Appendix A — `--dsw-static-*` raw palette (77 entries)

Declared on `body` (light, rule 0) and `body[data-ds-dark-theme]` (dark, rule 1). Shown compactly as
`name value`; the only entry whose value differs between modes is annotated inline.

**amber** (5)

```
amber-100                 #fef5e7
amber-400                 #f7ad31
amber-500                 #f59e0b
amber-600                 #dd8629
amber-900                 #27241f
```

**blue** (12)

```
blue-100                  #dbeafe
blue-300                  #93c5fd
blue-400                  #60a5fa
blue-450                  #4d93f8
blue-50                   #eff6ff
blue-500                  #3b82f6
blue-50p                  #eaf3ff
blue-600                  #2563eb
blue-75                   #e5f0ff
blue-800                  #1e40af
blue-900                  #0e3074
blue-950                  #172554
```

**deepseek** (11)

```
deepseek-100              #e4edfd
deepseek-200              #d3e2ff
deepseek-300              #b7c8fe
deepseek-400              #7aaaff
deepseek-450              #5686fe
deepseek-50               #edf3fe
deepseek-500              #4176e6
deepseek-600              #4868b2
deepseek-700-delete       #2f4c8f
deepseek-800              #34415b
deepseek-900              #283142
```

**green** (6)

```
green-100                 #e6faed
green-400                 #4ed17e
green-500                 #22c55e
green-500-a08             #22c55e14
green-500-a12             #22c55e1f
green-900                 #233c2c
```

**neutral** (35)

```
neutral-00                #fff
neutral-100               #f5f5f5
neutral-1000              #000
neutral-150               #ededed
neutral-200               #e5e5e5
neutral-250               #dcdcdc
neutral-300               #d4d4d4
neutral-400               #a2a4a6
neutral-50                #fafafa
neutral-500               #7f8287
neutral-550               #65676b
neutral-600               #545557
neutral-700               #3c3c3d
neutral-800               #292929
neutral-850               #212123
neutral-900               #0f0f0f
neutral-bluish-00         #fff
neutral-bluish-100        #ebeef2
neutral-bluish-1000       #0f1115
neutral-bluish-150        #e9ecf2
neutral-bluish-200        #e1e5ee
neutral-bluish-300        #cfd3d6
neutral-bluish-400        #adb2b8
neutral-bluish-50         #f9fafb
neutral-bluish-500        #979da6
neutral-bluish-60         #f5f6f7   (dark: #f9fafb)
neutral-bluish-600        #81858c
neutral-bluish-700        #61666b
neutral-bluish-75         #f1f3f5
neutral-bluish-750        #43454a
neutral-bluish-800        #353638
neutral-bluish-850        #2c2c2e
neutral-bluish-875        #232324
neutral-bluish-900        #1b1b1c
neutral-bluish-950        #151517
```

**red** (8)

```
red-100                   #fee2e2
red-400                   #f25a5a
red-400-a12               #f25a5a1f
red-50                    #fef2f2
red-500                   #ef4444
red-600                   #ec1313
red-600-a08               #ec131314
red-900                   #570c0c
```

---

## Appendix B — `--dsw-specific-*` (+ `--dsw-menu-surface-fill`) — 12 entries

Same sheet and same mode selectors as the alias layer. Not part of the `--dsw-alias-*` surface, but
they respond to `body[data-ds-dark-theme]` exactly the same way and are safe override targets.

| token | light | dark | note |
| --- | --- | --- | --- |
| `--dsw-menu-surface-fill` | `#f8f9fa94` | `#43454a73` | Not `--dsw-specific-*`-prefixed but part of the same extension sheet. |
| `--dsw-specific-bubble` | `var(--dsw-static-deepseek-50)` | `var(--dsw-static-neutral-bluish-850)` | Declared in `design-platform.css`. |
| `--dsw-specific-bubble-highlight` | `var(--dsw-static-deepseek-200)` | `var(--dsw-static-neutral-bluish-750)` | Declared in `design-platform.css`. |
| `--dsw-specific-input-major` | `var(--dsw-static-neutral-bluish-00)` | `var(--dsw-static-neutral-bluish-850)` | Declared in `design-platform.css`. |
| `--dsw-specific-login-input` | `var(--dsw-static-neutral-bluish-50)` | `var(--dsw-static-neutral-bluish-900)` | Declared in `design-platform.css`. |
| `--dsw-specific-menu` | `#f8f9faf0` | `#303136f0` | Declared in `design-platform.css`. |
| `--dsw-specific-selector` | `var(--dsw-static-neutral-bluish-60)` | `var(--dsw-static-neutral-bluish-800)` | Declared in `design-platform.css`. |
| `--dsw-specific-sidebar-fill` | `var(--dsw-static-neutral-bluish-50)` | `var(--dsw-static-neutral-bluish-900)` | Declared in `design-platform.css`. |
| `--dsw-specific-sidebar-nav-item-active` | `var(--dsw-static-neutral-bluish-100)` | `var(--dsw-static-neutral-bluish-750)` | Declared in `design-platform.css`. |
| `--dsw-specific-sidebar-nav-item-active-accent` | `var(--dsw-static-deepseek-100)` | `var(--dsw-static-neutral-bluish-800)` | Declared in `design-platform.css`. |
| `--dsw-specific-sidebar-nav-item-hover` | `var(--dsw-static-neutral-bluish-75)` | `var(--dsw-static-neutral-bluish-850)` | Declared in `design-platform.css`. |
| `--dsw-specific-tip` | `var(--dsw-static-neutral-bluish-60)` | `var(--dsw-static-neutral-bluish-800)` | Declared in `design-platform.css`. |

`--dsw-specific-menu` is additionally overridden per platform — the two Darwin-only rules in
`design-platform.css`:

```css
html[data-platform=darwin] body{--dsw-specific-menu:#f8f9faf0}
html[data-platform=darwin] body[data-ds-dark-theme]{--dsw-specific-menu:#303136f0}
```

---

## Appendix C — non-`--dsw-alias/static/specific` colour tokens in the same sheet (4)

| token | light | dark |
| --- | --- | --- |
| `--dsw-menu-surface-fill` | `#f8f9fa94` | `#43454a73` |
| `--dsw-gradient-onboarding-violet-stops` | `#2a2fb6 33.102%, #8b76f6 50.954%, #c5c0ff 85.326%, #2a2fb6` | *(declared once on `body`; inherited unchanged in dark)* |
| `--dsw-gradient-onboarding-blue-stops` | `#3964fe 18.75%, #398efe 51.78%, #6dccff 86.252%, #3964fe` | *(same)* |
| `--dsw-gradient-onboarding-cyan-stops` | `#0293b4 21.154%, #2dc8eb 50.954%, #aff0ff 85.326%, #0293b4` | *(same)* |

`--dsw-menu-surface-fill` is the shared translucent menu material; the ui-theme README warns that
"platform code must preserve those token values."

---

## Appendix D — method / reproduction

All facts above were derived with a read-only ASAR reader against
`/Applications/DeepSeek Harness.app/Contents/Resources/app.asar`:

* `list <archive> <regex>` enumerates entries; `cat` streams one entry; `grep` is line-based with a
  40-hit default cap (`LIMIT=<n>` to raise it) and skips files > 4 MiB and files with a NUL byte in
  the first 4 KiB.
* The palette string was decoded by extracting every `var <name> = "<string>"` literal from
  `…/dsh-client-ui-theme/lib/client.js` with `JSON.parse` (8 sheets recovered) and splitting each on
  top-level braces (brace-depth scan, not a regex) into rules and declarations.
* Light/dark values were taken respectively from the `body` and `body[data-ds-dark-theme]` rules;
  `base.css` and `onboarding.css` were merged in; the two `html[data-platform=darwin] body…` rules
  were applied last as platform overrides.
* `var(--dsw-static-…)` values were resolved by following the chain inside the *same* mode's map
  (max depth 8) — which is what makes the mode-asymmetric derivations visible, e.g.
  `--dsw-alias-menu-icon` resolving to `#353638` in light but `#ebeef2` in dark (via
  `label-primary-dimmed`), and `--dsw-alias-turn-trigger-bg` resolving to `#f9fafb` in light but to
  the `interactive-bg-hover` wash in dark.
* Reference counts in the prose come from a whole-tree scan of every text file under
  `dsh/node_modules/@deepseek-ai/` (2,847 files) for `--dsw-(alias|static|specific)-…` occurrences.
