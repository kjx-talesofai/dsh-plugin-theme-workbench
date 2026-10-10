/**
 * Theme Workbench — browser half.
 *
 * One slot contribution and one token layer, under the harness's own
 * module-loader wrapper (`window.__ModuleLoader__.load({ id, factory })`) so the
 * package needs no build step: this file IS the shipped client bundle.
 *
 *   `settings.general.item` — one preference row inside Settings → General,
 *   ordered just after the shipped Appearance (10) and Font size (11) rows
 *   because it is the same kind of thing. The built-in Appearance row renders a
 *   hardcoded Light / Dark / System cube set and cannot list a third-party
 *   theme, so a theme that wants a switch has to draw its own row; this is that
 *   row.
 *
 *   `ctx.theme.overrideTokens` — the palette itself. Deliberately NOT
 *   `ctx.theme.register`: `register` adds a theme to the registry, but
 *   `setTheme` only persists ids in the built-in `light | dark | system` union,
 *   so a registered third-party theme both stays invisible to the shipped
 *   picker and loses its selection on restart. `overrideTokens` instead stacks
 *   a token layer *over* whichever built-in theme is active, which means the
 *   user's own light / dark / system preference keeps working underneath and
 *   the OS scheme keeps flipping the palette. Each theme therefore ships a
 *   light AND a dark palette rather than being locked to one scheme.
 *
 * The choice itself is a Host preference: the Host half declares a `.volatile()`
 * `Config` field, this half reads and writes it through `ctx.configForms`, and
 * it lands in the profile's `cordis.patch.yml`. `globalThis.__DSH_THEME_WORKBENCH__`
 * carries the persisted id into the page before the shell mounts, so the first
 * palette applied is the chosen one instead of the schema default followed by a
 * visible repaint.
 *
 * Why the palette is derived rather than tabulated: the alias layer is ~107
 * variables across four declaration sites inside one inlined stylesheet, and the
 * shipped inspect surface documents only 14 of them. Hand-writing two hundred
 * literals would be unreviewable and would rot; instead each theme declares six
 * seed colours per mode and one shared builder derives the structural aliases
 * from them, with the mode asymmetries the shipped palette actually has (raised
 * surfaces go toward white in dark mode but toward ink in light mode, and
 * `menu-icon` / `turn-trigger-bg` derive from different sources per mode).
 * Semantic families are deliberately left alone: error / success / warn / idle
 * states, diff colours, masks and the document-selection blue are inherited from
 * the built-in palette so they keep meaning what they mean.
 *
 * @module dsh-plugin-theme-workbench/client
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-theme-workbench',
  factory(require) {
    const React = require('react')

    const h = React.createElement

    /** Locale namespace for every user-visible string this plugin adds. */
    const NS = 'dsh-plugin-theme-workbench'

    /**
     * Settings namespace and slot id.
     *
     * `dsh-settings` derives a plugin's namespace from its Loader row id, so
     * this string must equal `id:` in `cordis.patch.yml` (`theme-workbench`),
     * and it doubles as the slot cell key.
     */
    const ROW_ID = 'theme-workbench'

    /** Override-layer identity; one layer per source, replaced on re-apply. */
    const SOURCE = 'dsh-plugin-theme-workbench'

    /** Boot global the Host half fills in on every index render. */
    const BOOT_GLOBAL = '__DSH_THEME_WORKBENCH__'

    /** Theme whose palette is applied when nothing better is known. */
    const DEFAULT_THEME = 'cream'

    /**
     * `useSyncExternalStore` is React 18's own subscription API and the platform
     * ships React 18. The fallback keeps the row rendering (rather than throwing
     * on a hook that does not exist) if that ever stops being true; because it is
     * resolved once at module scope, hook order stays stable.
     */
    const useStore =
      typeof React.useSyncExternalStore === 'function'
        ? React.useSyncExternalStore
        : (subscribe, get) => {
            const [value, setValue] = React.useState(get)
            React.useEffect(() => subscribe(() => setValue(get())), [subscribe, get])
            return value
          }

    // ---------------------------------------------------------------------
    // Colour
    // ---------------------------------------------------------------------

    /** Parse `#rgb` / `#rrggbb` into channels. Alpha is never fed back in. */
    function parseHex(hex) {
      let body = String(hex).trim()
      if (body.charAt(0) === '#') body = body.slice(1)
      if (body.length === 3) {
        body = body.charAt(0) + body.charAt(0) + body.charAt(1) + body.charAt(1) + body.charAt(2) + body.charAt(2)
      }
      const value = Number.parseInt(body, 16)
      return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
    }

    /** Serialise channels as `#rrggbb`. */
    function toHex(r, g, b) {
      const channel = (value) => {
        const clamped = value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
        return clamped.toString(16).padStart(2, '0')
      }
      return `#${channel(r)}${channel(g)}${channel(b)}`
    }

    /**
     * Move `base` toward `toward`.
     *
     * Read as "start at `base` and go `amount` of the way to `toward`", so
     * `mix(canvas, ink, 0.95)` is nearly ink and `mix(canvas, WHITE, 0.05)` is
     * nearly canvas. Every call site below is written in that direction, which
     * makes the mode asymmetries (raised surfaces go toward white in dark mode
     * but toward ink in light mode) read as what they are.
     *
     * @param base - colour at `amount` 0.
     * @param toward - colour at `amount` 1.
     * @param amount - how far to travel, 0..1.
     * @returns the opaque blend.
     */
    function mix(base, toward, amount) {
      const x = parseHex(base)
      const y = parseHex(toward)
      return toHex(
        x.r * (1 - amount) + y.r * amount,
        x.g * (1 - amount) + y.g * amount,
        x.b * (1 - amount) + y.b * amount,
      )
    }

    /**
     * The same colour at a reduced alpha, as 8-digit hex — the notation the
     * shipped palette uses for hairlines and veils.
     *
     * @param color - opaque source colour.
     * @param value - alpha, 0..1.
     */
    function alpha(color, value) {
      const c = parseHex(color)
      const a = Math.max(0, Math.min(255, Math.round(value * 255)))
      return `${toHex(c.r, c.g, c.b)}${a.toString(16).padStart(2, '0')}`
    }

    /** sRGB channel (0..1) to linear light. */
    function toLinear(channel) {
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    }

    /** Linear light back to an sRGB channel (0..1). */
    function toSrgb(channel) {
      return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
    }

    /**
     * Hex to OKLab.
     *
     * OKLab rather than HSL because the job below is "keep the lightness, change
     * the hue, impose a small chroma" — and HSL cannot express that near white.
     * Its saturation is relative to the remaining headroom, so at lightness 0.995
     * a saturation of 0.09 works out to a chroma of 0.0009 and rounds away to
     * grey. OKLab's chroma is absolute and perceptually even, so one setting holds
     * from the near-white end of the ramp to the near-black end.
     */
    function toOklab(color) {
      const { r, g, b } = parseHex(color)
      const lr = toLinear(r / 255)
      const lg = toLinear(g / 255)
      const lb = toLinear(b / 255)
      const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
      const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
      const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
      return {
        lightness: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
      }
    }

    /** OKLab to linear-light sRGB channels, which may fall outside the gamut. */
    function oklabToLinear({ lightness, a, b }) {
      const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
      const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
      const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
      return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
      ]
    }

    /**
     * OKLab to hex, pulling chroma back until the colour is displayable.
     *
     * A tint that is fine at mid lightness can fall out of gamut at the extremes
     * of the ramp, so the chroma is reduced rather than the channel clipped: that
     * keeps the hue and the lightness, which are the two things this must not
     * disturb.
     */
    function oklabToHex(lab) {
      const inGamut = (channels) => channels.every((c) => c >= -0.0005 && c <= 1.0005)
      let { a, b } = lab
      if (!inGamut(oklabToLinear({ ...lab, a, b }))) {
        let low = 0
        let high = 1
        for (let step = 0; step < 20; step += 1) {
          const mid = (low + high) / 2
          if (inGamut(oklabToLinear({ ...lab, a: a * mid, b: b * mid }))) low = mid
          else high = mid
        }
        a *= low
        b *= low
      }
      const channels = oklabToLinear({ ...lab, a, b }).map((c) => toSrgb(Math.min(1, Math.max(0, c))) * 255)
      return toHex(channels[0], channels[1], channels[2])
    }

    /** WCAG 2.1 relative luminance. */
    function luminance(color) {
      const { r, g, b } = parseHex(color)
      const channel = (value) => {
        const v = value / 255
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
    }

    /** WCAG 2.1 contrast ratio, 1..21. */
    function contrast(a, b) {
      const first = luminance(a)
      const second = luminance(b)
      const high = first > second ? first : second
      const low = first > second ? second : first
      return (high + 0.05) / (low + 0.05)
    }

    /**
     * The strongest tint of `color` over `base` that still leaves `color`
     * legible on top of it.
     *
     * Needed because a wash token and the accent drawn on it share a hue, so the
     * more of the accent the wash carries the less the accent stands out. Guessing
     * a fraction gets this wrong in both directions: too little and the wash is
     * invisible, too much and the label on it collapses. Contrast falls
     * monotonically as the tint grows, so the largest usable tint is a solve.
     *
     * @param base - the surface the tint is laid over (white in light mode, the
     *   canvas in dark mode — matching how the shipped palette tints each).
     * @param color - the accent drawn on top of the wash.
     * @param target - the contrast ratio that accent needs.
     * @param cap - the most tint to allow, so the result stays a wash.
     * @returns the tinted colour, or `base` when no tint at all meets the target.
     */
    function tint(base, color, target, cap = 0.5) {
      if (contrast(color, mix(base, color, cap)) >= target) return mix(base, color, cap)
      let low = 0
      let high = cap
      for (let step = 0; step < 24; step += 1) {
        const mid = (low + high) / 2
        if (contrast(color, mix(base, color, mid)) >= target) low = mid
        else high = mid
      }
      return mix(base, color, low)
    }

    /**
     * How far to travel from `base` toward `toward` before reaching `target`
     * contrast.
     *
     * Solved rather than guessed on purpose. The shipped palette fades its text
     * tiers by fixed fractions of the ink, which is fine for its near-black ink
     * but leaves a warm sepia or sage one too faint: at the shipped fractions a
     * soft ink lands around 4.3:1 for `label-secondary` where the built-in
     * palette reaches 5.8:1. Solving for the target makes "no less legible than
     * the palette DSH ships" true by construction, whatever the ink.
     *
     * @param base - the colour being contrasted against (the canvas).
     * @param toward - the ink the tier fades toward.
     * @param target - the contrast ratio to reach.
     * @returns the colour at the target, or `toward` when the target is
     *   unreachable with this ink.
     */
    function reach(base, toward, target) {
      if (contrast(base, toward) <= target) return toward
      let low = 0
      let high = 1
      for (let step = 0; step < 24; step += 1) {
        const mid = (low + high) / 2
        if (contrast(base, mix(base, toward, mid)) < target) low = mid
        else high = mid
      }
      return mix(base, toward, high)
    }

    // ---------------------------------------------------------------------
    // Palettes
    // ---------------------------------------------------------------------

    /**
     * The five themes, in picker order.
     *
     * Six seeds per mode:
     *   `canvas`  the application background — the surface the user actually
     *             stares at, so it carries the theme's character
     *   `surface` the theme's offset surface: the lightest tone the theme is
     *             willing to use for a raised card, composer or popover
     *   `sidebar` the sidebar column, which the shipped palette tints
     *             separately from the canvas
     *   `bubble`  the user message bubble
     *   `ink`     primary text; also the base every hairline is drawn from
     *   `accent`  links, the focus ring, and the "info" and business states
     *   `code`    optional code-block fill; derived from `canvas` when absent
     */
    const THEMES = [
      {
        id: 'modern-classic',
        light: { canvas: '#f7f8fa', surface: '#ffffff', sidebar: '#eff2f5', bubble: '#e9edf4', ink: '#15181d', accent: '#2f4b8f', code: '#f3f5f8' },
        dark: { canvas: '#15171b', surface: '#35393f', sidebar: '#0f1113', bubble: '#232730', ink: '#eceef2', accent: '#8aa7e8', code: '#101215' },
      },
      {
        id: 'novel',
        light: { canvas: '#f6f0e2', surface: '#fcf8ec', sidebar: '#efe7d5', bubble: '#ede2cc', ink: '#332e26', accent: '#8f4632', code: '#f1ead9' },
        dark: { canvas: '#1d1a15', surface: '#3d372c', sidebar: '#171410', bubble: '#2b261e', ink: '#e9e0cd', accent: '#c98a70', code: '#16130f' },
      },
      {
        id: 'calm',
        light: { canvas: '#f2f5f2', surface: '#fafcfa', sidebar: '#eaefea', bubble: '#e6ece7', ink: '#2c3733', accent: '#4f7d68', code: '#edf1ed' },
        dark: { canvas: '#111614', surface: '#2c352f', sidebar: '#0b0f0d', bubble: '#1d2622', ink: '#dde7e1', accent: '#82b79d', code: '#0c100e' },
      },
      {
        id: 'deep-work',
        light: { canvas: '#f6f6f5', surface: '#ffffff', sidebar: '#eeeeec', bubble: '#e9e9e6', ink: '#101112', accent: '#8a5a1e', code: '#f0f0ee' },
        dark: { canvas: '#0c0e11', surface: '#2b3037', sidebar: '#040405', bubble: '#171a1e', ink: '#e8eaec', accent: '#c9974a', code: '#080a0c' },
      },
      {
        id: 'cream',
        light: { canvas: '#f7f3ea', surface: '#fdfbf5', sidebar: '#f2ece0', bubble: '#f0e7d6', ink: '#2f2a24', accent: '#a8703f', code: '#f3eee3' },
        dark: { canvas: '#1b1917', surface: '#3d3831', sidebar: '#151312', bubble: '#2a2622', ink: '#ece5da', accent: '#d9a273', code: '#141210' },
      },
    ]

    /**
     * The shipped cold-grey ramp, which some components bind to directly.
     *
     * The alias layer is not the only way a component can reach a colour. The
     * changed-files card does `--changes-fill: var(--dsw-static-neutral-50)` and
     * paints its header band with it, and its icon tile is a 50% mix of
     * `neutral-00`; the deliverables card repeats the pattern with
     * `--deliverable-fill`. Those are raw ramp entries, so a theme that only
     * overrides aliases leaves them cold grey — white patches on a warm page.
     * Warming the ramp is what reaches them, which is also why this is the one
     * place this plugin writes `--dsw-static-*`: the inventory notes the ramp is
     * "not validated anywhere; the palette is only a convention".
     *
     * The blast radius is measured, not assumed. Eight shipped aliases read the
     * neutral ramp; seven of them this plugin overrides directly, so their own
     * value wins and the ramp never reaches them. Exactly one is left to the
     * built-in palette — `state-idle-primary` — so it is the single token whose
     * hue follows the theme even though the plugin does not write it. A test pins
     * that list, so a future DSH alias reading the ramp fails loudly instead of
     * shifting silently.
     */
    const STATIC_NEUTRALS = {
      'neutral-00': '#ffffff',
      'neutral-50': '#fafafa',
      'neutral-100': '#f5f5f5',
      'neutral-150': '#ededed',
      'neutral-200': '#e5e5e5',
      'neutral-250': '#dcdcdc',
      'neutral-300': '#d4d4d4',
      'neutral-400': '#a2a4a6',
      'neutral-500': '#7f8287',
      'neutral-550': '#65676b',
      'neutral-600': '#545557',
      'neutral-700': '#3c3c3d',
      'neutral-800': '#292929',
      'neutral-850': '#212123',
      'neutral-900': '#0f0f0f',
      'neutral-1000': '#000000',
    }

    /**
     * Saturation to impose on the ramp, and the ceiling on lightness.
     *
     * Pure white cannot carry a hue at lightness 1, so the top step is pulled a
     * hair below it — that is what turns `#ffffff` into a tinted white instead of
     * leaving it inert.
     */
    const NEUTRAL_CHROMA_MAX = 0.014
    /** Share of the theme's own chroma the ramp is allowed to carry. */
    const NEUTRAL_CHROMA_SHARE = 0.7
    const NEUTRAL_LIGHTNESS_CEILING = 0.995

    /**
     * A warm counterpart of the cold-grey ramp.
     *
     * Only the hue and saturation move; lightness is left where it was, so each
     * step keeps its exact place in the ramp
     * and a component that re-points a variable per mode still works
     * (`body[data-ds-dark-theme] .card{--changes-fill: var(--dsw-static-neutral-850)}`).
     * That is why the ramp is emitted with the same value in both modes: the mode
     * switch happens in the component, not in the ramp.
     *
     * @param theme - one entry of {@link THEMES}; the light seeds name the hue
     *   and how much chroma the ramp may carry.
     * @returns token name to an identical `{ light, dark }` pair.
     */
    function warmNeutrals(theme) {
      // The theme's own hue, taken from the middle of its canvas-to-ink axis.
      const seed = toOklab(mix(theme.light.canvas, theme.light.ink, 0.5))
      const hue = Math.atan2(seed.b, seed.a)
      // Scaled to the theme's *own* chroma, so a deliberately neutral theme
      // (Deep Work) keeps a neutral ramp and a warm one gets a warm ramp — the
      // ramp inherits the theme's cast instead of having one imposed on it.
      const chroma = Math.min(NEUTRAL_CHROMA_MAX, Math.hypot(seed.a, seed.b) * NEUTRAL_CHROMA_SHARE)
      const ramp = {}
      for (const [step, value] of Object.entries(STATIC_NEUTRALS)) {
        const { lightness } = toOklab(value)
        const tinted = oklabToHex({
          lightness: Math.min(lightness, NEUTRAL_LIGHTNESS_CEILING),
          a: Math.cos(hue) * chroma,
          b: Math.sin(hue) * chroma,
        })
        ramp[`--dsw-static-${step}`] = { light: tinted, dark: tinted }
      }
      return ramp
    }

    /** Look a theme up by id, or `undefined`. */
    function themeById(id) {
      for (const theme of THEMES) if (theme.id === id) return theme
      return undefined
    }

    /** Every shipped id, in picker order. Pinned against the Host half by test. */
    const THEME_IDS = THEMES.map((theme) => theme.id)

    // ---------------------------------------------------------------------
    // Token derivation
    // ---------------------------------------------------------------------

    /**
     * Derive every structural alias for one theme in one mode.
     *
     * Families deliberately NOT produced here, so the built-in palette keeps
     * them: `state-error-*`, `state-success-*`, `state-warn-*`, `state-idle-*`,
     * `code-diff-*`, `file-diff-*`, `bg-mask-*`, `bg-document-selection`,
     * `border-inverted*`, `button-tool-bar-*`, and the onboarding aliases. Those
     * are semantics (a red that means failure) or composites over un-themed
     * pixels (selections over document images), not decoration.
     *
     * @param seeds - one mode's seed colours.
     * @param dark - whether this is the dark palette.
     * @returns token name to CSS colour.
     */
    function buildTokens(seeds, dark) {
      const WHITE = '#ffffff'
      const BLACK = '#000000'
      const canvas = seeds.canvas
      const surface = seeds.surface
      const ink = seeds.ink
      const accent = seeds.accent
      const sidebar = seeds.sidebar

      /**
       * Toward the theme's own surface seed.
       *
       * Deliberately NOT toward pure white. Mixing a cream canvas toward white
       * spends the theme's chroma, so every raised surface — cards, popovers and
       * above all the composer — lands as a cold white patch on a warm page.
       * Letting each theme name its own surface keeps the hue, and one seed
       * covers both modes because a dark theme's surface is simply lighter than
       * its canvas, which also collapses the old per-mode weight asymmetry.
       */
      const up = (weight) => mix(canvas, surface, weight)
      /** Away from the text: toward ink in light mode, toward black in dark mode. */
      const down = (weight) => mix(canvas, dark ? BLACK : ink, weight)
      /** A fraction of the way from the canvas to the ink. */
      const text = (amount) => mix(canvas, ink, amount)
      /** A hairline drawn in the theme's own ink. */
      const line = (weight) => alpha(ink, weight)

      // Text tiers are solved against the built-in palette's own contrast ladder
      // (measured from the 0.2.0-rc.2 sheets: light 5.8 / 3.71 / 2.13, dark
      // 12.11 / 8.54 / 4.92) rather than faded by fraction, so a soft warm ink
      // reads as well as the shipped near-black one. The targets sit a hair above
      // the shipped values so rounding can never land below them: the point is to
      // be *no less* legible than what DSH already ships, not merely close.
      // `label-primary` is the ink itself; only the tiers under it are solved.
      const labelPrimary = ink
      const labelSecondary = reach(canvas, ink, dark ? 12.2 : 5.85)
      const labelTertiary = reach(canvas, ink, dark ? 8.6 : 3.76)
      const labelCaption = reach(canvas, ink, dark ? 4.97 : 2.18)
      // Dimmed and disabled ink is deliberately faint, so it keeps the shipped
      // fractions instead of a contrast floor.
      const labelDimmed = mix(canvas, ink, dark ? 0.202 : 0.125)

      const borderL1 = line(dark ? 0.06 : 0.04)
      const borderL2 = line(dark ? 0.12 : 0.1)
      const borderL3 = line(dark ? 0.16 : 0.12)
      const borderL4 = line(dark ? 0.2 : 0.16)

      const codeBlock = seeds.code ?? (dark ? up(0.55) : down(0.032))
      const interactiveHover = line(dark ? 0.08 : 0.05)
      const interactiveActive = line(dark ? 0.12 : 0.08)
      // `brand-primary` in the shipped palette is NOT the accent: it is the
      // near-black / near-white contrast colour. Treating it as "the brand
      // colour" inverts the whole UI, so it stays monochrome here and the accent
      // goes to the separately named token below.
      const brandPrimary = mix(canvas, ink, 0.95)
      // Hover moves *away* from the fill: the shipped light pair goes from
      // deepseek-500 to the lighter deepseek-400, and the dark pair from
      // deepseek-400 to the darker deepseek-500. Getting this backwards makes
      // hover read as a pressed state.
      const accentHover = dark ? mix(accent, BLACK, 0.15) : mix(accent, WHITE, 0.12)
      const menuSurface = alpha(up(0.85), dark ? 0.45 : 0.58)
      const tooltipBg = dark ? up(0.95) : mix(canvas, ink, 0.84)

      return {
        // Surfaces.
        '--dsw-alias-bg-base': canvas,
        '--dsw-alias-bg-layer-1': up(0.42),
        '--dsw-alias-bg-layer-2': up(0.72),
        '--dsw-alias-bg-layer-3': up(1),
        // Overlays sit *below* the canvas in light mode (the shipped value is
        // bluish-150, a shade darker than white) and clearly above it in dark
        // mode, so this is one of the tokens whose direction flips per mode.
        '--dsw-alias-bg-overlay': dark ? up(0.8) : down(0.05),
        '--dsw-alias-bg-module-platform': dark ? up(0.55) : down(0.035),
        '--dsw-alias-bg-multi-select': dark ? up(0.5) : down(0.04),
        '--dsw-alias-bg-document-preview': dark ? up(0.3) : down(0.025),
        '--dsw-alias-bg-skeleton': alpha(dark ? WHITE : BLACK, dark ? 0.08 : 0.04),

        // Hairlines. `border-l2-darkmode-thin` equals l1 in dark and l2 in light
        // by design — the shipped palette needs a thinner stroke exactly where
        // dark mode's l2 would read too heavy.
        '--dsw-alias-border-l1': borderL1,
        '--dsw-alias-border-l2': borderL2,
        '--dsw-alias-border-l3': borderL3,
        '--dsw-alias-border-l4': borderL4,
        '--dsw-alias-border-l2-darkmode-thin': dark ? borderL1 : borderL2,

        // Text.
        '--dsw-alias-label-primary': labelPrimary,
        '--dsw-alias-label-secondary': labelSecondary,
        '--dsw-alias-label-tertiary': labelTertiary,
        '--dsw-alias-label-caption': labelCaption,
        '--dsw-alias-label-dimmed': labelDimmed,
        '--dsw-alias-label-primary-dimmed': text(0.96),
        '--dsw-alias-label-primary-bluish': mix(ink, accent, 0.15),
        '--dsw-alias-label-primary-foreground': dark ? mix(canvas, BLACK, 0.9) : WHITE,
        '--dsw-alias-label-primary-inverted': dark ? up(0.9) : WHITE,
        '--dsw-alias-label-document-preview': labelSecondary,
        '--dsw-alias-label-shimmer': alpha(dark ? WHITE : BLACK, dark ? 0.45 : 0.3),
        '--dsw-alias-label-deep-diving': dark ? mix(accent, WHITE, 0.6) : mix(accent, BLACK, 0.15),
        '--dsw-alias-label-deep-diving-shimmer': dark
          ? mix(accent, WHITE, 0.75)
          : mix(accent, canvas, 0.45),

        // Brand: monochrome contrast colour plus the real accent.
        '--dsw-alias-brand-primary': brandPrimary,
        '--dsw-alias-brand-primary-invert': brandPrimary,
        '--dsw-alias-brand-text': brandPrimary,
        '--dsw-alias-brand-primary-new-colorprimary-new-color': accent,
        '--dsw-alias-link': accent,

        // The business state is what `--dsw-focus-ring-color` falls back to, so
        // overriding it is what makes the focus ring follow the theme.
        '--dsw-alias-state-business-primary': accent,
        // A *tint* of the accent, not the accent: the shipped pair is
        // deepseek-100 (tinted over white) in light and deepseek-800 (tinted over
        // the canvas) in dark, and this token is consumed as the background UNDER
        // accent text (`ui-plan`'s chip) and under `label-primary-bluish`
        // (`ui-conversation`). Letting the accent itself in collapses that text to
        // ~1.3:1, so the tint is solved for the accent's own legibility.
        '--dsw-alias-state-business-tertiary': dark
          ? tint(canvas, accent, 4.5)
          : tint(WHITE, accent, 3.7),

        // Buttons.
        '--dsw-alias-button-primary-fill': brandPrimary,
        '--dsw-alias-button-primary-hover': mix(brandPrimary, canvas, 0.18),
        '--dsw-alias-button-primary-dimmed': mix(canvas, ink, dark ? 0.18 : 0.08),
        '--dsw-alias-button-contrast-fill': mix(canvas, ink, dark ? 0.95 : 0.72),
        '--dsw-alias-button-elevated-fill': up(0.85),
        '--dsw-alias-button-floating-fill': up(0.8),
        '--dsw-alias-button-floating-hover': dark ? up(0.95) : mix(canvas, ink, 0.055),
        '--dsw-alias-button-ghost-active-fill': mix(canvas, ink, dark ? 0.12 : 0.06),
        '--dsw-alias-button-ghost-active-hover': mix(canvas, ink, dark ? 0.16 : 0.09),
        '--dsw-alias-button-ghost-active-border': mix(ink, canvas, dark ? 0.45 : 0.55),
        '--dsw-alias-button-info-fill': accent,
        '--dsw-alias-button-info-hover': accentHover,

        // Interactive veils.
        '--dsw-alias-interactive-bg-hover': interactiveHover,
        '--dsw-alias-interactive-bg-hover-accent': alpha(accent, dark ? 0.2 : 0.1),
        '--dsw-alias-interactive-bg-hover-solid': mix(canvas, ink, dark ? 0.1 : 0.05),
        '--dsw-alias-interactive-bg-active': interactiveActive,

        // Menus, toasts, tooltips.
        '--dsw-alias-menu-icon': dark ? text(0.96) : text(0.82),
        '--dsw-alias-menu-group-header-fill': alpha(up(0.85), 0.94),
        '--dsw-menu-surface-fill': menuSurface,
        '--dsw-specific-menu': menuSurface,
        '--dsw-alias-toast-bg': dark ? up(0.95) : mix(canvas, ink, 0.86),
        '--dsw-alias-toast-label': dark ? mix(surface, WHITE, 0.8) : WHITE,
        '--dsw-alias-tooltip-bg': tooltipBg,
        '--dsw-alias-tooltip-key-bg': mix(tooltipBg, WHITE, 0.18),

        // Markdown and code.
        '--dsw-alias-markdown-code-block': codeBlock,
        '--dsw-alias-markdown-code-block-banner': dark ? up(0.85) : down(0.042),
        '--dsw-alias-markdown-code-segment-selected': up(0.85),
        '--dsw-alias-markdown-code-segment-unselected': dark ? codeBlock : down(0.05),
        '--dsw-alias-markdown-inline-code': dark ? up(0.5) : down(0.045),
        '--dsw-alias-markdown-citation': dark ? up(0.7) : down(0.06),
        '--dsw-alias-markdown-placeholder': dark ? up(0.55) : down(0.03),
        '--dsw-alias-markdown-tag': dark ? up(0.55) : down(0.05),

        // Turn-trigger notices derive from different sources per mode upstream;
        // mirror that so the resting card keeps contrasting with the transcript.
        '--dsw-alias-turn-trigger-bg': dark ? interactiveHover : codeBlock,
        '--dsw-alias-turn-trigger-bg-hover': dark ? interactiveActive : interactiveHover,

        // Scrollbars.
        '--dsw-alias-scrollbar-bg-l1': mix(canvas, ink, dark ? 0.16 : 0.1),
        '--dsw-alias-scrollbar-bg-l2': mix(canvas, ink, dark ? 0.2 : 0.1),
        '--dsw-alias-scrollbar-hover-l1': mix(canvas, ink, dark ? 0.24 : 0.16),
        '--dsw-alias-scrollbar-hover-l2': mix(canvas, ink, dark ? 0.3 : 0.16),

        // Controls.
        '--dsw-alias-switch-thumb': dark ? mix(canvas, ink, 0.55) : up(0.9),

        // View-specific surfaces.
        '--dsw-specific-sidebar-fill': sidebar,
        '--dsw-specific-sidebar-nav-item-hover': mix(sidebar, ink, dark ? 0.1 : 0.045),
        '--dsw-specific-sidebar-nav-item-active': mix(sidebar, ink, dark ? 0.14 : 0.07),
        '--dsw-specific-sidebar-nav-item-active-accent': mix(accent, sidebar, dark ? 0.22 : 0.12),
        '--dsw-specific-bubble': seeds.bubble,
        '--dsw-specific-bubble-highlight': mix(seeds.bubble, accent, dark ? 0.18 : 0.1),
        '--dsw-specific-input-major': up(0.9),
        '--dsw-specific-login-input': dark ? down(0.35) : down(0.01),
        '--dsw-specific-selector': dark ? up(0.55) : down(0.03),
        '--dsw-specific-tip': dark ? up(0.55) : down(0.03),
      }
    }

    /**
     * Build the override layer for one theme: every token paired with its light
     * and dark value, which is the shape `overrideTokens` takes and what lets
     * the built-in light / dark / system preference keep choosing the mode.
     *
     * @param theme - one entry of {@link THEMES}.
     * @returns token name to `{ light, dark }`.
     */
    function overridesFor(theme) {
      const light = buildTokens({ ...theme.light }, false)
      const dark = buildTokens({ ...theme.dark }, true)
      const layer = {}
      for (const name of Object.keys(light)) layer[name] = { light: light[name], dark: dark[name] }
      // Components that skip the alias layer still have to land on a warm ramp.
      return { ...layer, ...warmNeutrals(theme) }
    }

    // ---------------------------------------------------------------------
    // Row copy
    // ---------------------------------------------------------------------

    /**
     * Every user-visible string, including the theme names.
     *
     * The names live here and not on {@link THEMES} because only the locale
     * machinery knows which of `en` / `zh` is active; a component that rendered
     * a `{ en, zh }` object would be handing React an object as a child.
     */
    const DICT = {
      en: {
        'row.title': 'Theme',
        'row.description':
          'Each theme carries a light and a dark palette; your light / dark / system setting still chooses between them.',
        'theme.modern-classic': 'Modern Classic',
        'theme.novel': 'Novel',
        'theme.calm': 'Calm',
        'theme.deep-work': 'Deep Work',
        'theme.cream': 'Cream',
        'hint.modern-classic': 'Cool paper, near-black ink, deep blue accent',
        'hint.novel': 'Aged paper, sepia ink, muted oxblood',
        'hint.calm': 'Soft sage, low contrast, quiet edges',
        'hint.deep-work': 'Near-monochrome, high contrast, muted bronze',
        'hint.cream': 'Warm off-white paper, soft clay accent',
      },
      zh: {
        'row.title': '主题',
        'row.description':
          '每套主题都带浅色与深色两套配色；你的「浅色／深色／跟随系统」设置仍然决定用哪一套。',
        'theme.modern-classic': '现代经典',
        'theme.novel': '书卷',
        'theme.calm': '静谧',
        'theme.deep-work': '深度工作',
        'theme.cream': '米白',
        'hint.modern-classic': '冷调纸白、近黑墨色、深蓝点缀',
        'hint.novel': '旧纸、棕墨、暗红点缀',
        'hint.calm': '柔和鼠尾草绿、低对比、安静',
        'hint.deep-work': '近黑白、高对比、暗铜点缀',
        'hint.cream': '暖米白纸感、柔和陶土点缀',
      },
    }

    /** Row stylesheet. Class names are plugin-scoped and removed on unload. */
    const CSS = `
.dtw-row{display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dtw-text{display:flex;flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:24px}
.dtw-title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}
.dtw-desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}
.dtw-swatches{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.dtw-swatch{display:flex;flex-direction:column;align-items:center;gap:5px;padding:6px 7px;border:1px solid transparent;border-radius:var(--dsw-radius-md,12px);background:transparent;font:inherit;cursor:pointer}
.dtw-swatch:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dtw-swatch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dtw-swatch[aria-pressed="true"]{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover-solid)}
.dtw-chip{position:relative;display:flex;width:34px;height:22px;border-radius:6px;overflow:hidden;box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2)}
.dtw-half{flex:1 1 50%}
.dtw-dot{position:absolute;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
.dtw-label{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;white-space:nowrap}
.dtw-swatch[aria-pressed="true"] .dtw-label{color:var(--dsw-alias-label-primary)}
`

    // ---------------------------------------------------------------------
    // Row
    // ---------------------------------------------------------------------

    /**
     * Render the theme row.
     *
     * The owner props of `settings.general.item` are intentionally empty — the
     * section only stacks rows, so this component draws its own label and gets
     * its state and write path from the registration's `inject` face.
     *
     * @param props - composed slot props (`t` from `locale`, the rest from `inject`).
     * @returns the row element tree.
     */
    function ThemeWorkbenchRow(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      const face = props.face ?? {}
      const themeId = useStore(face.subscribe, face.getSnapshot, face.getSnapshot)
      const options = face.options ?? []
      return h(
        'div',
        { className: 'dtw-row' },
        h(
          'div',
          { className: 'dtw-text' },
          h('div', { className: 'dtw-title' }, t('row.title')),
          h('div', { className: 'dtw-desc' }, t('row.description')),
        ),
        h(
          'div',
          // A labelled group of toggle buttons, not a radiogroup: `role="radio"`
          // would promise a roving tabindex and arrow-key navigation that this row
          // does not implement, so `aria-pressed` on plain buttons is the honest
          // description of what a keyboard user actually gets.
          { className: 'dtw-swatches', role: 'group', 'aria-label': t('row.title') },
          options.map((option) =>
            h(
              'button',
              {
                key: option.id,
                type: 'button',
                'aria-pressed': themeId === option.id,
                title: t(`hint.${option.id}`),
                className: 'dtw-swatch',
                onClick: () => face.select(option.id),
              },
              h(
                'span',
                { className: 'dtw-chip' },
                h('span', { className: 'dtw-half', style: { background: option.light } }),
                h('span', { className: 'dtw-half', style: { background: option.dark } }),
                h('span', { className: 'dtw-dot', style: { background: option.accent } }),
              ),
              h('span', { className: 'dtw-label' }, t(`theme.${option.id}`)),
            ),
          ),
        ),
      )
    }

    // ---------------------------------------------------------------------
    // Plugin
    // ---------------------------------------------------------------------

    const inject = ['slots', 'locale', 'theme', 'configForms']

    /**
     * Client plugin body: provide the theme row and keep the override layer in
     * step with the Host-backed preference.
     *
     * @param ctx - client cordis context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, DICT), 'theme-workbench: dictionaries')

      ctx.effect(
        () => {
          // The shipped theme package guards its own stylesheet mounting the same
          // way: a client tree can be booted without a document (DSH's node e2e
          // does), and the palette still has to work there. Only the row's own
          // styling is skipped.
          if (typeof document === 'undefined') return undefined
          const tag = document.createElement('style')
          tag.dataset.plugin = NS
          tag.textContent = CSS
          document.head?.appendChild(tag)
          return () => {
            tag.remove()
          }
        },
        'theme-workbench: row styles',
      )

      const form = typeof ctx.configForms?.get === 'function' ? ctx.configForms.get(ROW_ID) : undefined

      /**
       * Read the persisted id back out of the settings scope, if it is usable.
       *
       * Defensive on purpose: the scope reports nothing until its first load
       * lands, and a settings row must never be the reason a plugin throws.
       */
      const persisted = () => {
        if (form === undefined || typeof form.getSnapshot !== 'function') return undefined
        const snapshot = form.getSnapshot()
        const value = snapshot !== null && typeof snapshot === 'object' ? snapshot.value : undefined
        const id = value !== null && typeof value === 'object' ? value.theme : undefined
        return typeof id === 'string' && themeById(id) !== undefined ? id : undefined
      }

      /**
       * The Host writes this before the shell mounts. It is authoritative on the
       * first run because the settings scope starts at its schema defaults and
       * only later adopts the durable value — without it the page would apply
       * the default palette and then visibly repaint.
       */
      const booted = () => {
        const id = globalThis[BOOT_GLOBAL]
        return typeof id === 'string' && themeById(id) !== undefined ? id : undefined
      }

      let current = booted() ?? persisted() ?? DEFAULT_THEME
      let layer

      /** Swap the override layer. Same source, so this replaces rather than stacks. */
      const paint = (id) => {
        layer = ctx.theme.overrideTokens(SOURCE, overridesFor(themeById(id)))
      }

      const listeners = new Set()
      const subscribe = (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      }
      const getSnapshot = () => current
      const notify = () => {
        // One bad subscriber must not stop the others: the row re-renders
        // through React, and a throw here would abandon the remaining listeners.
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch {
            /* ignore a broken subscriber */
          }
        }
      }

      /** Apply a selection: repaint, tell the row, then try to persist it. */
      const select = (id) => {
        if (themeById(id) === undefined || id === current) return
        current = id
        paint(id)
        notify()
        if (form !== undefined && typeof form.set === 'function') {
          try {
            // `set` queues a Host write and settles to whether it was accepted,
            // rejecting after a refused write recovers. Both halves matter: a
            // non-loopback page runs its settings scope in memory, and a refused
            // write reloads the durable value, which the subscription above then
            // adopts. Either way the palette is already applied, so the only
            // thing left to do here is not leave a rejection unhandled.
            const settled = form.set('theme', id)
            if (settled !== null && typeof settled === 'object' && typeof settled.catch === 'function') {
              settled.catch(() => {})
            }
          } catch {
            /* session-only: a scope with no Host persistence */
          }
        }
      }

      if (form !== undefined && typeof form.subscribe === 'function') {
        ctx.effect(
          () =>
            form.subscribe(() => {
              const id = persisted()
              if (id !== undefined && id !== current) {
                current = id
                paint(id)
                notify()
              }
            }),
          'theme-workbench: settings adoption',
        )
      }

      ctx.effect(
        () => () => {
          if (layer !== undefined) layer()
        },
        'theme-workbench: token layer',
      )

      paint(current)

      const face = {
        subscribe,
        getSnapshot,
        select,
        // Text comes from the locale dictionary, so the face only carries the
        // colours the swatch needs.
        options: THEMES.map((theme) => ({
          id: theme.id,
          light: theme.light.canvas,
          dark: theme.dark.canvas,
          accent: theme.light.accent,
        })),
      }

      ctx.slots.inject('settings.general.item', () =>
        ctx.slots.register(
          {
            name: 'settings.general.item',
            id: ROW_ID,
            // After the shipped Appearance (10), Font size (11) and
            // transcript-view (12) rows, before developer-tools (15).
            order: 13,
            locale: NS,
            inject: () => ({ face }),
          },
          ThemeWorkbenchRow,
        ),
      )
    }

    return { inject, apply }
  },
})
