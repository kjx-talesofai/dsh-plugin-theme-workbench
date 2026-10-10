/**
 * Contract test for dsh-plugin-theme-workbench.
 *
 * There is no browser here, so the suite drives the plugin through the
 * boundaries it owns, and is explicit about the ones it does not.
 *
 *   Proven here
 *   - `client.js` runs as a plain script (`node:vm`) against a
 *     `window.__ModuleLoader__` facade and registers the package's own id, i.e.
 *     the shipped artifact really is a script-executable client bundle.
 *   - it requires only `react`, so materialization cannot miss the loader table.
 *   - the two halves agree on what the plugin is: the theme ids and their order,
 *     the default, the boot global, and the settings namespace (`dsh-settings`
 *     derives that namespace from the Loader row id, so `client.js`, `index.js`
 *     and `cordis.patch.yml` all have to spell `theme-workbench` the same way).
 *   - `apply` registers exactly one row into `settings.general.item` with the id,
 *     order, locale seat and inject face the slot contract requires, and every
 *     effect — dictionaries, row styles, settings adoption, the token layer and
 *     the slot injection — hands back a real disposer, because a missing one
 *     breaks the next hot re-apply.
 *   - the override layer is well formed against the shipped palette: every name
 *     it writes exists in the 0.2.0-rc.2 token sheets, every value is a
 *     `{ light, dark }` colour pair, the modes genuinely differ, the documented
 *     core tokens are covered, semantic state families are deliberately NOT
 *     overridden, and `brand-primary` is the monochrome contrast colour rather
 *     than the accent (treating it as the accent inverts the whole UI).
 *   - the palettes are legible: WCAG contrast for primary, secondary, tertiary
 *     and caption text on the canvas, and for toast text on its chip, across all
 *     five themes and both modes.
 *   - the selection pipeline is wired the way the design claims: the boot global
 *     outranks the settings snapshot, an unusable value from either source falls
 *     through, `select` repaints through one source and writes the preference, a
 *     snapshot push is adopted, re-selecting is a no-op, an unknown id is
 *     refused, a write that throws still paints, a broken subscriber cannot stall
 *     the others, and teardown disposes the override layer.
 *   - the row renders one radio per theme with the active one marked, labels
 *     resolve through the locale dictionary, and a missing `t` degrades rather
 *     than throws.
 *
 *   NOT proven here
 *   - anything the real harness owns: `ui-slots`/`ui-renderer` prop composition,
 *     `dsh-client-locale`'s live resolution, `ctx.theme`'s real snapshot and
 *     `overrideTokens` stacking, `dsh-settings`' round trip to
 *     `cordis.patch.yml`, and the browser's own colour resolution. Those are
 *     stubbed. The rendered pixels remain unverified in this environment.
 *
 * Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const clientSource = readFileSync(join(root, 'client.js'), 'utf8')
const hostSource = readFileSync(join(root, 'index.js'), 'utf8')
const patchSource = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')

const ROW_SLOT = 'settings.general.item'
const ROW_ID = 'theme-workbench'
const NS = pkg.name

/**
 * The `--dsw-alias-*` names the built-in palette declares in 0.2.0-rc.2, read out
 * of `ui-theme`'s inlined sheets. A theme may only write names that already
 * exist, so this is the allowlist — and a snapshot on purpose: if a future DSH
 * renames a token this suite fails, rather than the theme silently leaking the
 * built-in colour in that one spot.
 */
const SHIPPED_ALIASES = [
  '--dsw-alias-bg-base', '--dsw-alias-bg-document-preview', '--dsw-alias-bg-document-selection',
  '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-layer-3',
  '--dsw-alias-bg-mask-1', '--dsw-alias-bg-mask-2', '--dsw-alias-bg-mask-3',
  '--dsw-alias-bg-mask-drop', '--dsw-alias-bg-mask-photo', '--dsw-alias-bg-module-platform',
  '--dsw-alias-bg-multi-select', '--dsw-alias-bg-overlay', '--dsw-alias-bg-skeleton',
  '--dsw-alias-border-inverted', '--dsw-alias-border-inverted2', '--dsw-alias-border-l1',
  '--dsw-alias-border-l2', '--dsw-alias-border-l2-darkmode-thin', '--dsw-alias-border-l3',
  '--dsw-alias-border-l4', '--dsw-alias-brand-primary', '--dsw-alias-brand-primary-invert',
  '--dsw-alias-brand-primary-new-colorprimary-new-color', '--dsw-alias-brand-text',
  '--dsw-alias-button-contrast-fill', '--dsw-alias-button-elevated-fill', '--dsw-alias-button-floating-fill',
  '--dsw-alias-button-floating-hover', '--dsw-alias-button-ghost-active-border', '--dsw-alias-button-ghost-active-fill',
  '--dsw-alias-button-ghost-active-hover', '--dsw-alias-button-info-fill', '--dsw-alias-button-info-hover',
  '--dsw-alias-button-primary-dimmed', '--dsw-alias-button-primary-fill', '--dsw-alias-button-primary-hover',
  '--dsw-alias-button-tool-bar-fill', '--dsw-alias-button-tool-bar-fill-invisible', '--dsw-alias-button-tool-bar-hover',
  '--dsw-alias-code-diff-added', '--dsw-alias-code-diff-deleted', '--dsw-alias-file-diff-added-bg',
  '--dsw-alias-file-diff-added-gutter', '--dsw-alias-file-diff-added-marker', '--dsw-alias-file-diff-deleted-bg',
  '--dsw-alias-file-diff-deleted-gutter', '--dsw-alias-file-diff-deleted-marker', '--dsw-alias-interactive-bg-active',
  '--dsw-alias-interactive-bg-hover', '--dsw-alias-interactive-bg-hover-accent', '--dsw-alias-interactive-bg-hover-danger',
  '--dsw-alias-interactive-bg-hover-solid', '--dsw-alias-label-caption', '--dsw-alias-label-deep-diving',
  '--dsw-alias-label-deep-diving-shimmer', '--dsw-alias-label-dimmed', '--dsw-alias-label-document-preview',
  '--dsw-alias-label-primary', '--dsw-alias-label-primary-bluish', '--dsw-alias-label-primary-dimmed',
  '--dsw-alias-label-primary-foreground', '--dsw-alias-label-primary-inverted', '--dsw-alias-label-secondary',
  '--dsw-alias-label-shimmer', '--dsw-alias-label-tertiary', '--dsw-alias-link',
  '--dsw-alias-markdown-citation', '--dsw-alias-markdown-code-block', '--dsw-alias-markdown-code-block-banner',
  '--dsw-alias-markdown-code-segment-selected', '--dsw-alias-markdown-code-segment-unselected',
  '--dsw-alias-markdown-inline-code', '--dsw-alias-markdown-placeholder', '--dsw-alias-markdown-tag',
  '--dsw-alias-menu-group-header-fill', '--dsw-alias-menu-icon', '--dsw-alias-onboarding-accent',
  '--dsw-alias-onboarding-card-fill', '--dsw-alias-onboarding-checkbox-border', '--dsw-alias-onboarding-secondary-fill',
  '--dsw-alias-scrollbar-bg-l1', '--dsw-alias-scrollbar-bg-l2', '--dsw-alias-scrollbar-hover-l1',
  '--dsw-alias-scrollbar-hover-l2', '--dsw-alias-settings-card-fill', '--dsw-alias-settings-card-stroke',
  '--dsw-alias-state-business-primary', '--dsw-alias-state-business-tertiary', '--dsw-alias-state-error-primary',
  '--dsw-alias-state-error-secondary', '--dsw-alias-state-idle-primary', '--dsw-alias-state-success-primary',
  '--dsw-alias-state-success-secondary', '--dsw-alias-state-success-tertiary', '--dsw-alias-state-warn-label',
  '--dsw-alias-state-warn-primary', '--dsw-alias-state-warn-secondary', '--dsw-alias-state-warn-tertiary',
  '--dsw-alias-switch-thumb', '--dsw-alias-toast-bg', '--dsw-alias-toast-label',
  '--dsw-alias-tooltip-bg', '--dsw-alias-tooltip-key-bg', '--dsw-alias-turn-trigger-bg',
  '--dsw-alias-turn-trigger-bg-hover',
]

/** The `--dsw-specific-*` surface plus the menu material alias, also themeable. */
const SHIPPED_SPECIFIC = [
  '--dsw-menu-surface-fill', '--dsw-specific-bubble', '--dsw-specific-bubble-highlight',
  '--dsw-specific-input-major', '--dsw-specific-login-input', '--dsw-specific-menu',
  '--dsw-specific-selector', '--dsw-specific-sidebar-fill', '--dsw-specific-sidebar-nav-item-active',
  '--dsw-specific-sidebar-nav-item-active-accent', '--dsw-specific-sidebar-nav-item-hover', '--dsw-specific-tip',
  '--dsw-alias-onboarding-accent', '--dsw-alias-onboarding-card-fill', '--dsw-alias-onboarding-secondary-fill',
  '--dsw-alias-button-tool-bar-fill', '--dsw-alias-button-tool-bar-hover',
  '--dsw-alias-button-tool-bar-fill-invisible',
]

/**
 * The three decorative onboarding ramps. They are the only names this plugin
 * writes whose value is not a single colour, so they are listed separately and
 * validated by their own test rather than by the colour-shape one.
 */
const SHIPPED_GRADIENTS = [
  '--dsw-gradient-onboarding-violet-stops',
  '--dsw-gradient-onboarding-blue-stops',
  '--dsw-gradient-onboarding-cyan-stops',
]

/**
 * The cold-grey ramp, with the shipped lightness of each step.
 *
 * This plugin writes these — the one place it touches `--dsw-static-*` — because
 * components bind local variables straight to them: the changed-files card paints
 * its header band from `--changes-fill: var(--dsw-static-neutral-50)` and its
 * icon tile is a 50% mix of `neutral-00`, and the deliverables card repeats it
 * with `--deliverable-fill`. Only aliases being overridden leaves those cold grey
 * on a warm page, which is exactly the reported white patch.
 */
const SHIPPED_NEUTRAL_RAMP = {
  '--dsw-static-neutral-00': '#ffffff',
  '--dsw-static-neutral-50': '#fafafa',
  '--dsw-static-neutral-100': '#f5f5f5',
  '--dsw-static-neutral-150': '#ededed',
  '--dsw-static-neutral-200': '#e5e5e5',
  '--dsw-static-neutral-250': '#dcdcdc',
  '--dsw-static-neutral-300': '#d4d4d4',
  '--dsw-static-neutral-400': '#a2a4a6',
  '--dsw-static-neutral-500': '#7f8287',
  '--dsw-static-neutral-550': '#65676b',
  '--dsw-static-neutral-600': '#545557',
  '--dsw-static-neutral-700': '#3c3c3d',
  '--dsw-static-neutral-800': '#292929',
  '--dsw-static-neutral-850': '#212123',
  '--dsw-static-neutral-900': '#0f0f0f',
  '--dsw-static-neutral-1000': '#000000',
}

/**
 * Shipped aliases that read the cold-grey ramp.
 *
 * Tinting the ramp is the one place this plugin writes `--dsw-static-*`, so its
 * blast radius has to be a known quantity rather than a hope. Seven of these are
 * overridden directly by the plugin, so the ramp never reaches them; exactly one
 * is deliberately left to the built-in palette.
 */
const NEUTRAL_RAMP_CONSUMERS = [
  '--dsw-alias-bg-multi-select',
  '--dsw-alias-label-shimmer',
  '--dsw-alias-markdown-inline-code',
  '--dsw-alias-scrollbar-bg-l1',
  '--dsw-alias-scrollbar-bg-l2',
  '--dsw-alias-scrollbar-hover-l1',
  '--dsw-alias-scrollbar-hover-l2',
  '--dsw-alias-state-idle-primary',
]

/** Semantic families the themes deliberately inherit from the built-in palette. */
const INHERITED = [
  '--dsw-alias-state-idle-primary',
  '--dsw-alias-code-diff-added', '--dsw-alias-code-diff-deleted',
  '--dsw-alias-bg-document-selection',
]

/** States read as text, so they must clear 4.5:1 on the canvas. */
const TEXT_STATES = [
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-state-warn-label',
]

/** States used as fills or indicators, held to the 3:1 non-text threshold. */
const FILL_STATES = [
  '--dsw-alias-state-error-secondary',
  '--dsw-alias-state-success-secondary',
  '--dsw-alias-state-warn-secondary',
]

const ALLOWED = new Set([...SHIPPED_ALIASES, ...SHIPPED_SPECIFIC, ...SHIPPED_GRADIENTS, ...Object.keys(SHIPPED_NEUTRAL_RAMP)])
const THEME_IDS = ['modern-classic', 'novel', 'calm', 'deep-work', 'cream']

/** Read a `const NAME = '...'` string literal out of a source file. */
function literal(source, name) {
  const match = source.match(new RegExp(`${name} = '([^']+)'`))
  assert.ok(match, `could not read ${name}`)
  return match[1]
}

const BOOT_GLOBAL = literal(clientSource, 'BOOT_GLOBAL')

// ---------------------------------------------------------------------------
// Colour maths, mirroring the WCAG definitions
// ---------------------------------------------------------------------------

const COLOUR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i

/**
 * The OKLab hue of a colour, in degrees.
 *
 * Implemented here rather than imported on purpose: the plugin's own `toOklab` is
 * the thing under test by the onboarding assertions below, and a shared
 * implementation would agree with itself no matter which of the two is wrong.
 */
function oklabOf(hex) {
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L: lightness, hue: (Math.atan2(bb, a) * 180) / Math.PI, chroma: Math.hypot(a, bb) }
}

/** Signed shortest distance between two hues, in degrees. */
function hueGap(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180)
}

/**
 * Whether a colour carries `base`'s hue — or is neutral because `base` is.
 *
 * Hue is not defined for a near-neutral colour, and several of these palettes are
 * *deliberately* near-neutral: `modern-classic`'s canvas is `#f7f8fa` (OKLab
 * chroma 0.003), and a surface re-sampled up from it is simply white. Asking for a
 * hue there would be asking the solver to invent chroma the gamut does not have.
 */
function carriesHue(colour, base, tolerance) {
  const c = oklabOf(colour)
  const b = oklabOf(base)
  // 0.005 is about where a chroma stops being visible; 0.012 is where a palette
  // stops being "near-neutral by design" — `deep-work`'s dark canvas sits at
  // 0.007 and is meant to be grey.
  if (c.chroma < 0.005) return b.chroma < 0.012
  return hueGap(c.hue, b.hue) <= tolerance
}

function parseHex(hex) {
  const value = Number.parseInt(hex.slice(1, 7), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** WCAG 2.1 relative luminance. */
function luminance(hex) {
  const linear = parseHex(hex).map((channel) => {
    const v = channel / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** WCAG 2.1 contrast ratio, 1..21. */
function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** A faithful-enough React: `children` lands in `props.children`, as React does. */
function createReact() {
  return {
    createElement(type, props, ...children) {
      return {
        type,
        props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
      }
    },
    useState: (initial) => [initial, () => {}],
    useEffect: () => {},
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  }
}

/**
 * Evaluate the shipped bundle the way the real loader does.
 *
 * @returns the module it registered, the id it claimed, and the sandbox so a
 *   caller can seed a global before `apply` runs.
 */
function loadBundle(options = {}) {
  const required = []
  const sandbox = {}
  if (options.document !== false) {
    sandbox.document = {
      createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
      head: { appendChild() {} },
    }
  }
  sandbox.window = {
    __ModuleLoader__: {
      load({ id, factory }) {
        sandbox.__loadedId = id
        sandbox.__module = factory((name) => {
          required.push(name)
          if (name === 'react') return createReact()
          throw new Error(`unexpected require: ${name}`)
        })
      },
    },
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  new vm.Script(clientSource, { filename: 'client.js' }).runInContext(sandbox)
  return { module: sandbox.__module, loadedId: sandbox.__loadedId, sandbox, required }
}

/**
 * Drive `apply` with a fake client context and record what it does.
 *
 * @param options - `boot` seeds the boot global; `form` supplies a configForms
 *   form (omit it to model a client with no settings scope).
 */
function mount(options = {}) {
  const loaded = loadBundle()
  if (options.boot !== undefined) loaded.sandbox[BOOT_GLOBAL] = options.boot

  const effects = []
  const layers = []
  const registrations = []
  const injections = []
  const locales = []

  const ctx = {
    effect: (fn, label) => {
      effects.push({ cleanup: fn(), label })
      return () => {}
    },
    locale: {
      register: (ns, dict) => {
        locales.push({ ns, dict })
        return () => {}
      },
    },
    theme: {
      overrideTokens: (source, tokens) => {
        const layer = { source, tokens, disposed: false }
        layers.push(layer)
        return () => {
          layer.disposed = true
        }
      },
    },
    slots: {
      inject: (key, cb) => {
        injections.push(key)
        return cb()
      },
      register: (definition, component) => {
        registrations.push({ definition, component })
        return () => {}
      },
    },
  }
  if (options.form !== undefined) ctx.configForms = { get: () => options.form }

  loaded.module.apply(ctx)

  const tokens = () => layers[layers.length - 1].tokens
  const layer = () => layers[layers.length - 1]
  const face = () => registrations[0].definition.inject().face
  const canvasOf = (id) => face().options.find((option) => option.id === id)

  return { ctx, effects, layers, registrations, injections, locales, tokens, layer, face, canvasOf }
}

/** Collect every element of a given tag from a rendered tree, in document order. */
function collect(node, tag, found = []) {
  if (node === null || typeof node !== 'object') return found
  if (node.type === tag) found.push(node)
  const children = node.props?.children
  for (const child of Array.isArray(children) ? children : [children]) collect(child, tag, found)
  return found
}

// ---------------------------------------------------------------------------
// Bundle shape
// ---------------------------------------------------------------------------

test('the shipped artifact is a script-executable client bundle', () => {
  const { module, loadedId, required } = loadBundle()
  assert.equal(loadedId, pkg.name)
  assert.equal(typeof module.apply, 'function')
  assert.deepEqual([...module.inject], ['slots', 'locale', 'theme', 'configForms'])
  // The factory may only reach for the loader's seed table.
  assert.deepEqual(required, ['react'])
})

test('materialization requires nothing but react', () => {
  const loaded = loadBundle()
  mountedFrom(loaded)
  assert.deepEqual(loaded.required, ['react'])
})

/** Run `apply` against a loaded bundle with the minimal viable context. */
function mountedFrom(loaded) {
  loaded.module.apply({
    effect: (fn) => {
      fn()
      return () => {}
    },
    locale: { register: () => () => {} },
    theme: { overrideTokens: () => () => {} },
    slots: { inject: (_key, cb) => cb(), register: () => () => {} },
  })
}

test('the host half declares a web client with the packages it needs', () => {
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.dsh.client.immediately, true)
  for (const dependency of ['@deepseek-ai/dsh-client-ui-theme', '@deepseek-ai/dsh-client-ui-settings']) {
    assert.ok(pkg.dsh.client.inject.includes(dependency), `missing client inject: ${dependency}`)
  }
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
})

test('the Host half declares a volatile theme field, which is what makes it writable', () => {
  assert.match(hostSource, /theme:\s*z\.union/)
  assert.match(hostSource, /\.volatile\(\)/)
  assert.match(hostSource, /webserver\/index-inject/)
  assert.match(hostSource, /kind: 'global'/)
})

// ---------------------------------------------------------------------------
// The two halves agree
// ---------------------------------------------------------------------------

/** Pull a frozen string array out of the host source without importing it. */
function hostArray(name) {
  const match = hostSource.match(new RegExp(`${name} = Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`))
  assert.ok(match, `could not read ${name} out of index.js`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

test('host and client agree on the theme ids, their order, and the default', () => {
  const hostIds = hostArray('THEME_IDS')
  assert.deepEqual(hostIds, THEME_IDS)
  // Spread into this realm first: `face.options` is built inside the VM.
  assert.deepEqual([...mount().face().options].map((option) => option.id), hostIds)

  const hostDefault = literal(hostSource, 'DEFAULT_THEME')
  assert.equal(literal(clientSource, 'DEFAULT_THEME'), hostDefault)
  assert.ok(hostIds.includes(hostDefault), 'the default must be one of the shipped ids')
})

test('host and client agree on the boot global name', () => {
  assert.equal(literal(hostSource, 'BOOT_GLOBAL'), BOOT_GLOBAL)
})

test('the settings namespace is the Loader row id in all three files', () => {
  const patchId = patchSource.match(/id:\s*([a-z0-9-]+)/)[1]
  const patchName = patchSource.match(/name:\s*'([^']+)'/)[1]
  assert.equal(patchName, pkg.name, 'the patch row must name this package')
  assert.equal(patchId, ROW_ID)
  // `dsh-settings` derives a plugin's settings namespace from its row id, so the
  // browser half must look that same string up.
  assert.equal(literal(clientSource, 'ROW_ID'), patchId)
})

test('every theme ships two palettes, and both locales name it', () => {
  const mounted = mount()
  const options = [...mounted.face().options]
  assert.equal(options.length, 5)
  for (const option of options) {
    assert.match(option.light, COLOUR, `${option.id} light canvas`)
    assert.match(option.dark, COLOUR, `${option.id} dark canvas`)
    assert.notEqual(option.light, option.dark, `${option.id} must differ per mode`)
    assert.match(option.accent, COLOUR, `${option.id} accent`)
  }

  // Names live in the dictionary, not on the options, because only the locale
  // machinery knows which language is active.
  assert.equal(mounted.locales.length, 1)
  const { ns, dict } = mounted.locales[0]
  assert.equal(ns, NS)
  for (const locale of ['en', 'zh']) {
    for (const id of THEME_IDS) {
      for (const prefix of ['theme', 'hint']) {
        const value = dict[locale][`${prefix}.${id}`]
        assert.equal(typeof value, 'string', `missing ${prefix}.${id} for ${locale}`)
        assert.ok(value.length > 0, `empty ${prefix}.${id} for ${locale}`)
      }
    }
    for (const key of ['row.title', 'row.description']) {
      assert.equal(typeof dict[locale][key], 'string', `missing ${key} for ${locale}`)
    }
  }
})

// ---------------------------------------------------------------------------
// Slot registration
// ---------------------------------------------------------------------------

test('apply registers one row with the contract the slot demands', () => {
  const { registrations, injections } = mount()
  assert.deepEqual(injections, [ROW_SLOT])
  assert.equal(registrations.length, 1)

  const { definition, component } = registrations[0]
  assert.equal(definition.name, ROW_SLOT)
  assert.equal(definition.id, ROW_ID)
  // After the shipped Appearance (10), Font size (11) and transcript-view (12).
  assert.equal(definition.order, 13)
  assert.equal(definition.locale, NS)
  assert.equal(typeof component, 'function')

  // The owner passes no props at all, so state and the write path travel through
  // the inject face.
  const mounted = definition.inject()
  assert.equal(typeof mounted.face.subscribe, 'function')
  assert.equal(typeof mounted.face.getSnapshot, 'function')
  assert.equal(typeof mounted.face.select, 'function')
  assert.equal(mounted.face.options.length, 5)
})

test('every effect hands back a real disposer', () => {
  const form = { getSnapshot: () => ({ value: { theme: 'cream' } }), set: () => {}, subscribe: () => () => {} }
  const { effects } = mount({ form })
  // dictionaries, row styles, settings adoption, token layer
  assert.equal(effects.length, 4)
  for (const { cleanup, label } of effects) {
    assert.equal(typeof cleanup, 'function', `effect without a disposer: ${label}`)
  }
})

// ---------------------------------------------------------------------------
// The override layer
// ---------------------------------------------------------------------------

test('every overridden name exists in the shipped token surface', () => {
  const unknown = Object.keys(mount().tokens()).filter((name) => !ALLOWED.has(name))
  assert.deepEqual(unknown, [], 'these names are not part of the shipped token surface')
})

test('every override is a well-formed light/dark pair of colours', () => {
  const tokens = mount().tokens()
  assert.ok(Object.keys(tokens).length >= 80, `only ${Object.keys(tokens).length} tokens`)
  for (const [name, pair] of Object.entries(tokens)) {
    assert.equal(typeof pair, 'object', `${name} must be a pair`)
    assert.equal(typeof pair.light, 'string', `${name}.light`)
    if (SHIPPED_GRADIENTS.includes(name)) continue // a ramp, not a colour — see its own test
    assert.match(pair.light, COLOUR, `${name}.light`)
    assert.match(pair.dark, COLOUR, `${name}.dark`)
  }
  // The canvas pair must always differ, or the theme is not mode-aware at all.
  assert.notEqual(tokens['--dsw-alias-bg-base'].light, tokens['--dsw-alias-bg-base'].dark)
})

test('the documented core tokens are covered', () => {
  const covered = new Set(Object.keys(mount().tokens()))
  const core = [
    '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-layer-3',
    '--dsw-alias-bg-overlay', '--dsw-alias-border-l1', '--dsw-alias-border-l2',
    '--dsw-alias-brand-primary', '--dsw-alias-label-primary', '--dsw-alias-label-secondary',
    '--dsw-specific-sidebar-fill',
  ]
  assert.deepEqual(core.filter((name) => !covered.has(name)), [])
})

test('semantic state families are inherited rather than recoloured', () => {
  const tokens = mount().tokens()
  for (const name of INHERITED) {
    assert.ok(!(name in tokens), `${name} must keep its built-in meaning`)
  }
})

test('brand-primary stays the monochrome contrast colour, not the accent', () => {
  const tokens = mount().tokens()
  const accent = tokens['--dsw-alias-brand-primary-new-colorprimary-new-color']
  const brand = tokens['--dsw-alias-brand-primary']
  const canvas = tokens['--dsw-alias-bg-base']
  for (const mode of ['light', 'dark']) {
    assert.notEqual(brand[mode], accent[mode], `brand-primary must not be the accent (${mode})`)
  }
  // This is the trap that inverts the UI: brand-primary is dark on a light canvas
  // and light on a dark one, which the accent is not required to be.
  assert.ok(luminance(brand.light) < luminance(canvas.light), 'brand-primary must be dark on light')
  assert.ok(luminance(brand.dark) > luminance(canvas.dark), 'brand-primary must be light on dark')
})

test('the focus ring follows the theme', () => {
  const tokens = mount().tokens()
  const accent = tokens['--dsw-alias-brand-primary-new-colorprimary-new-color']
  assert.equal(tokens['--dsw-alias-state-business-primary'].light, accent.light)
  assert.equal(tokens['--dsw-alias-state-business-primary'].dark, accent.dark)
})

/**
 * CIE L* — perceptual lightness, 0..100.
 *
 * Used to ask whether a surface step is *visible* rather than merely nonzero:
 * L* is roughly uniform in perceived lightness, so a 2 L* difference reads
 * clearly while a 0.5 L* one does not read at all.
 */
function cieL(hex) {
  const y = luminance(hex)
  const f = y > (6 / 29) ** 3 ? Math.cbrt(y) : y / (3 * (6 / 29) ** 2) + 4 / 29
  return 116 * f - 16
}

/** Blend `amount` of `toward` into `base`, in sRGB, matching the plugin's own rule. */
function mixHex(base, toward, amount) {
  const a = parseHex(base)
  const b = parseHex(toward)
  const channel = (index) => a[index] * (1 - amount) + b[index] * amount
  return `#${[0, 1, 2].map((i) => Math.round(channel(i)).toString(16).padStart(2, '0')).join('')}`
}

/** Peak-to-trough spread of the channels: 0 for a neutral, larger for a tinted colour. */
function chroma(hex) {
  const [r, g, b] = parseHex(hex)
  return Math.max(r, g, b) - Math.min(r, g, b)
}

test('in light mode content surfaces step DOWN from the canvas; in dark they step up', () => {
  // The direction is the whole point. A lighter warm surface cannot stay warm —
  // at L* 97-99 there is no sRGB room left for chroma — and physically a raised
  // sheet is shadowed, so 'raised' reads as darker. Dark mode inverts it because
  // emission adds light. Only surfaces that genuinely float may sit above the
  // canvas in light mode.
  const content = [
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-bg-layer-2',
    '--dsw-specific-input-major',
    '--dsw-specific-sidebar-fill',
    '--dsw-specific-bubble',
    '--dsw-alias-markdown-code-block',
  ]
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const page = cieL(tokens['--dsw-alias-bg-base'][mode])
      for (const name of content) {
        const delta = cieL(tokens[name][mode]) - page
        if (mode === 'light') {
          assert.ok(delta < 0, `${id}/light: ${name} must sit below the canvas, got ${delta.toFixed(2)}`)
          assert.ok(delta >= -6.5, `${id}/light: ${name} stepped ${delta.toFixed(2)}, past the 6 L* ceiling`)
        } else {
          // The sidebar is the one dark surface that stays below the canvas.
          if (name === '--dsw-specific-sidebar-fill') assert.ok(delta < 0, `${id}/dark: the sidebar should stay below`)
          else assert.ok(delta > 0, `${id}/dark: ${name} must sit above the canvas, got ${delta.toFixed(2)}`)
        }
      }
    }
  }
})

test('surfaces keep the canvas hue, and never outrun the warm-gamut ceiling', () => {
  // Two failures this catches: a surface that mixes toward white spends the
  // canvas chroma and turns cold; and a warm colour pushed past L* 98.5 is white
  // by force of the sRGB gamut no matter what was intended.
  const surfaces = [
    '--dsw-alias-bg-layer-1',
    '--dsw-alias-bg-layer-2',
    '--dsw-specific-input-major',
    '--dsw-specific-sidebar-fill',
    '--dsw-specific-bubble',
  ]
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const canvas = tokens['--dsw-alias-bg-base'][mode]
      const base = chroma(canvas)
      if (mode === 'light') {
        assert.ok(cieL(canvas) <= 98.5, `${id}: the canvas itself is past the warm ceiling`)
      }
      for (const name of surfaces) {
        const value = tokens[name][mode]
        if (mode === 'light') {
          assert.ok(cieL(value) <= 98.5, `${id}: ${name} is past the warm-gamut ceiling`)
        }
        // R6 is about the light ramp; the recipe's dark multipliers drop to 0.70
        // for the sidebar on purpose, so dark only needs a sanity floor.
        const floor = mode === 'light' ? 0.85 : 0.6
        if (base >= 0.004) {
          assert.ok(
            chroma(value) >= base * floor,
            `${id}/${mode}: ${name} lost the canvas cast (${chroma(value).toFixed(4)} vs ${base.toFixed(4)})`,
          )
        }
      }
    }
  }
})
test('the neutral ramp is tinted without moving its lightness', () => {
  // The ramp has to keep each step's *value*, because components re-point a
  // variable per mode (light uses neutral-50, dark uses neutral-850), so a tint
  // that also changed lightness would break one mode to serve the other.
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const [name, shipped] of Object.entries(SHIPPED_NEUTRAL_RAMP)) {
      const tinted = tokens[name]
      assert.ok(tinted, `${name} must be written`)
      assert.equal(tinted.light, tinted.dark, `${name} is mode-independent by design`)
      // A chromatic near-white cannot hold luminance 1.0, so the top step is
      // allowed a little more room than the rest.
      const tolerance = shipped === '#ffffff' ? 0.03 : 0.02
      const drift = Math.abs(luminance(tinted.light) - luminance(shipped))
      assert.ok(drift <= tolerance, `${id}: ${name} moved its lightness by ${drift.toFixed(4)}`)
    }

    // The property that actually matters: the ramp still descends.
    const ladder = Object.keys(SHIPPED_NEUTRAL_RAMP).map((name) => luminance(tokens[name].light))
    for (let step = 1; step < ladder.length; step += 1) {
      assert.ok(ladder[step] < ladder[step - 1], `${id}: the ramp is no longer monotonic at step ${step}`)
    }
  }
})

test('tinting the ramp reaches exactly one alias it does not write', () => {
  // The ramp write is the plugin's one blunt instrument, so its reach is pinned:
  // the aliases that read the ramp are either overridden directly (their own
  // value wins) or explicitly accounted for. A new DSH alias reading the ramp
  // fails here rather than changing colour unnoticed.
  const written = new Set(Object.keys(mount().tokens()))
  const reached = NEUTRAL_RAMP_CONSUMERS.filter((name) => !written.has(name))
  assert.deepEqual(reached, ['--dsw-alias-state-idle-primary'])
})

test('the neutral ramp inherits the theme cast instead of imposing one', () => {
  // Measured against the theme's mid-tone, not its canvas: Modern Classic has a
  // neutral canvas but a cool ink, so its cast lives in the mid-tone.
  const warmth = (hex) => {
    const [r, , b] = parseHex(hex)
    return r - b
  }
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    const mid = mixHex(tokens['--dsw-alias-bg-base'].light, tokens['--dsw-alias-label-primary'].light, 0.5)
    const themeWarmth = warmth(mid)
    const rampWarmth = warmth(tokens['--dsw-static-neutral-50'].light)

    assert.ok(
      Math.abs(rampWarmth - themeWarmth) <= 5,
      `${id}: ramp warmth ${rampWarmth} does not track the theme's ${themeWarmth}`,
    )
    if (Math.abs(themeWarmth) <= 2) {
      // A deliberately neutral theme must not be handed a cast.
      assert.ok(Math.abs(rampWarmth) <= 2, `${id}: neutral theme got ramp warmth ${rampWarmth}`)
    } else {
      assert.equal(
        Math.sign(rampWarmth),
        Math.sign(themeWarmth),
        `${id}: ramp warmth ${rampWarmth} has the opposite cast to ${themeWarmth}`,
      )
    }
  }
})

test('every surface step is perceptible against the page it sits on', () => {
  // A surface that differs from the canvas by less than about 1 L* is invisible,
  // so a "raised" card or a "sunken" sidebar reads as the same flat plane.
  // [token, light floor, dark floor]. A near-black canvas has far less L* room
  // (Deep Work's dark canvas is L* 3.9), and on macOS the sidebar is composited
  // over native vibrancy anyway, so its step is carried by hue and chroma.
  const steps = [
    ['--dsw-alias-bg-layer-3', 2.0, 2.0],
    ['--dsw-specific-input-major', 2.0, 2.0],
    ['--dsw-specific-sidebar-fill', 2.0, 1.4],
    ['--dsw-specific-bubble', 3.0, 3.0],
  ]
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const page = cieL(tokens['--dsw-alias-bg-base'][mode])
      for (const [name, lightFloor, darkFloor] of steps) {
        const floor = mode === 'light' ? lightFloor : darkFloor
        const delta = Math.abs(cieL(tokens[name][mode]) - page)
        assert.ok(delta >= floor, `${id}/${mode}: ${name} is only ${delta.toFixed(2)} L* from the page`)
      }
    }
  }
})

// ---------------------------------------------------------------------------
// Legibility
// ---------------------------------------------------------------------------

/**
 * The built-in palette's own text ladder, measured from the 0.2.0-rc.2 sheets.
 * The themes solve for these rather than for an abstract WCAG number: the point
 * is to be no less legible than what DSH already ships, and DSH itself puts
 * `label-tertiary` at 3.71 and `label-caption` at 2.13 in light mode. The solver
 * targets sit above these, so the assertion below is near-exact.
 */
const SHIPPED_LADDER = {
  light: { secondary: 5.8, tertiary: 3.71, caption: 2.13 },
  dark: { secondary: 12.11, tertiary: 8.54, caption: 4.92 },
}

test('primary text clears WCAG AAA on the canvas in every theme', () => {
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const ratio = contrast(tokens['--dsw-alias-label-primary'][mode], tokens['--dsw-alias-bg-base'][mode])
      assert.ok(ratio >= 7, `${id}/${mode}: primary contrast ${ratio.toFixed(2)} < 7`)
    }
  }
})

test('the lower text tiers are no less legible than the built-in palette', () => {
  const tiers = [
    ['--dsw-alias-label-secondary', 'secondary'],
    ['--dsw-alias-label-tertiary', 'tertiary'],
    ['--dsw-alias-label-caption', 'caption'],
  ]
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const [name, tier] of tiers) {
      for (const mode of ['light', 'dark']) {
        const ratio = contrast(tokens[name][mode], tokens['--dsw-alias-bg-base'][mode])
        const shipped = SHIPPED_LADDER[mode][tier]
        assert.ok(
          ratio >= shipped - 0.02,
          `${id}/${mode}: ${name} contrast ${ratio.toFixed(2)} is below the built-in ${shipped}`,
        )
      }
    }
  }
})

test('the text ladder keeps its order: primary darker than secondary, and so on', () => {
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const ladder = [
        '--dsw-alias-label-primary',
        '--dsw-alias-label-secondary',
        '--dsw-alias-label-tertiary',
        '--dsw-alias-label-caption',
      ].map((name) => contrast(tokens[name][mode], tokens['--dsw-alias-bg-base'][mode]))
      for (let index = 1; index < ladder.length; index += 1) {
        assert.ok(
          ladder[index] <= ladder[index - 1] + 0.01,
          `${id}/${mode}: tier ${index} outranks the one above it (${ladder.join(' > ')})`,
        )
      }
    }
  }
})

test('chip text is legible on its own surface', () => {
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const toast = contrast(tokens['--dsw-alias-toast-label'][mode], tokens['--dsw-alias-toast-bg'][mode])
      assert.ok(toast >= 4.5, `${id}/${mode}: toast contrast ${toast.toFixed(2)}`)
    }
  }
})

test('every wash keeps every colour drawn on it legible', () => {
  // The gap this closes: measuring the text tiers against `bg-base` alone cannot
  // see a wash token consumed *under* other colours. Each wash below is solved
  // for all of its consumers, and this pins the solve.
  //
  // Only the endpoints of each blend are asserted, and that is sufficient rather
  // than a shortcut: every colour listed here sits on the same side of the wash's
  // luminance (all darker in light mode, all lighter in dark), and a mix of two
  // such colours lands between them — so no blend can contrast *less* than the
  // worse endpoint, whatever fraction the consumer picks.
  const WASHES = [
    ['--dsw-alias-state-success-tertiary', [
      // `.success` (ui-primitives ConnectionIndicator), and the two blends the
      // transcript draws: `.rkta1W_contextGreen`, `.rkta1W_promptDiffLineadded`.
      '--dsw-alias-state-success-primary', '--dsw-alias-label-secondary', '--dsw-alias-label-primary',
    ]],
    ['--dsw-alias-state-warn-tertiary', [
      // `.gOeFyG_strip` (approval), `.warning` (ConnectionIndicator),
      // `.ZVcBiW_installSafety` (plugin-manager), and `.ZVcBiW_approval`'s
      // inherited label.
      '--dsw-alias-state-warn-label', '--dsw-alias-state-warn-primary',
      '--dsw-alias-label-secondary', '--dsw-alias-label-primary',
    ]],
    ['--dsw-alias-state-business-tertiary', [
      // `ui-plan`'s chip, `.bocITq_previewBadge`, and `.f30p-W_reference:hover`.
      '--dsw-alias-state-business-primary', '--dsw-alias-label-primary-bluish', '--dsw-alias-label-primary',
    ]],
  ]
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      for (const [name, texts] of WASHES) {
        const wash = tokens[name][mode]
        for (const text of texts) {
          const ratio = contrast(tokens[text][mode], wash)
          assert.ok(ratio >= 4.5, `${id}/${mode}: ${text} on ${name} is ${ratio.toFixed(2)}:1`)
        }
      }

      // The built-in palette reaches 10.53:1 in light mode because its accent is
      // a far darker, cooler blue than any warm accent can be. 6.5 is the floor
      // held here instead: still well clear of WCAG AA for body text, and the
      // token keeps the accent-tinted character its name promises.
      const body = contrast(tokens['--dsw-alias-label-primary-bluish'][mode], tokens['--dsw-alias-state-business-tertiary'][mode])
      assert.ok(body >= 6.5, `${id}/${mode}: label on the wash ${body.toFixed(2)} < 6.5`)
    }
  }
})

test('the question card\'s "Recommended" chip is legible in every palette', () => {
  // The second, independent instance of the gap above — and the one that shipped
  // broken. `.y21zpG_badge` (ui-user-questions) draws
  // `background: sidebar-nav-item-active-accent; color: button-info-fill` at
  // 11px/600, and this theme points `button-info-fill` at the accent itself. Both
  // sides used to be derived from the accent on their own (a 12–22% mix into the
  // sidebar, under the accent), which measures 1.25–1.53 in *every* theme and both
  // modes: the label disappears rather than reads faintly. The archive has exactly
  // one consumer of that token, so it is solved as a wash for the accent's own
  // legibility. 4.5 is a *higher* floor than the shipped pairing reaches in light
  // mode (3.60:1 — deepseek-500 on deepseek-100), and the same one it reaches in
  // dark (5.20:1 — deepseek-400 on bluish-800).
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const chip = contrast(
        tokens['--dsw-specific-sidebar-nav-item-active-accent'][mode],
        tokens['--dsw-alias-button-info-fill'][mode],
      )
      assert.ok(chip >= 4.5, `${id}/${mode}: Recommended chip ${chip.toFixed(2)}:1 < 4.5`)
    }
  }
})

test('the onboarding ramps are the theme\'s own hue, in the shipped shape', () => {
  // Upstream these are three fixed hues — violet, blue, cyan — declared once with
  // no dark twin, so on warm paper they stay blue-violet in both modes. They are
  // `body`-level and therefore reachable; this pins that they now come from the
  // accent, in three rotations, at the shipped stop geometry.
  const SHAPE = {
    violet: ['33.102', '50.954', '85.326'],
    blue: ['18.75', '51.78', '86.252'],
    cyan: ['21.154', '50.954', '85.326'],
  }
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const accent = oklabOf(tokens['--dsw-alias-onboarding-accent'][mode])
      const midHues = []
      for (const [flavour, stops] of Object.entries(SHAPE)) {
        const raw = tokens[`--dsw-gradient-onboarding-${flavour}-stops`][mode]
        const parts = raw.split(',').map((part) => part.trim())
        // Four stops, and only the first three carry a percentage: the ramp closes
        // on its own first colour at 100 %, which is the shipped shape.
        assert.equal(parts.length, 4, `${id}/${mode}/${flavour}: ${raw}`)
        const head = parts.slice(0, 3).map((part) => /^(#[0-9a-f]{6}) ([\d.]+)%$/i.exec(part))
        assert.ok(head.every(Boolean), `${id}/${mode}/${flavour}: ${raw}`)
        assert.match(parts[3], /^#[0-9a-f]{6}$/i, `${id}/${mode}/${flavour}: ${raw}`)
        assert.equal(parts[3], head[0][1], `${flavour} must close on its first stop`)
        head.forEach(([, , pct], i) => assert.equal(pct, stops[i], `${id}/${mode}/${flavour} stop ${i}`))
        for (const part of parts) {
          const colour = part.slice(0, 7)
          if (oklabOf(colour).chroma < 0.01) continue
          const gap = hueGap(oklabOf(colour).hue, accent.hue)
          assert.ok(gap <= 25, `${id}/${mode}/${flavour}: ${colour} is ${gap.toFixed(1)}deg off the accent`)
        }
        midHues.push(oklabOf(parts[1].slice(0, 7)).hue)
      }
      // Three rotations, so the three cards stay tellable apart.
      for (let i = 0; i < midHues.length; i += 1) {
        for (let j = i + 1; j < midHues.length; j += 1) {
          assert.ok(hueGap(midHues[i], midHues[j]) >= 10, `${id}/${mode}: ramps ${i} and ${j} share a hue`)
        }
      }
    }
  }
})

test('the onboarding surfaces float above the canvas, on its hue, and follow the mode', () => {
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    const veil = tokens['--dsw-alias-onboarding-card-fill']
    const secondary = tokens['--dsw-alias-onboarding-secondary-fill']
    // The card is a frosted sheet over the gradient art: translucent, like the
    // shipped 80 % veil, and re-sampled rather than mixed toward white.
    assert.match(veil.light, /^#[0-9a-f]{8}$/i, veil.light)
    assert.match(veil.dark, /^#[0-9a-f]{8}$/i, veil.dark)
    assert.match(secondary.light, COLOUR, secondary.light)
    assert.notEqual(veil.light, veil.dark)
    assert.notEqual(secondary.light, secondary.dark)
    // The accent is the theme's own, not the shipped #3964fe.
    assert.equal(tokens['--dsw-alias-onboarding-accent'].light, tokens['--dsw-alias-state-business-primary'].light)
    for (const mode of ['light', 'dark']) {
      const canvas = tokens['--dsw-alias-bg-base'][mode]
      assert.ok(oklabOf(veil[mode].slice(0, 7)).L > oklabOf(canvas).L, `${id}/${mode}: the sheet is not above the page`)
      assert.ok(carriesHue(veil[mode].slice(0, 7), canvas, 6), `${id}/${mode}: the sheet left the canvas hue`)
      // 12, not 8: `resample` preserves the OKLab hue exactly, but 8-bit rounding
      // of a low-chroma surface can still rotate it a few degrees (measured worst
      // case 10.3 on `modern-classic` dark). The ramps carry real chroma and are
      // held to 25 there, so the hue family is pinned where it is measurable.
      assert.ok(carriesHue(secondary[mode], canvas, 12), `${id}/${mode}: the secondary fill left the canvas hue`)
    }
  }
})

test('the toolbar veils follow the mode and stay on the theme\'s own hues', () => {
  // Shipped as a single mid-grey in both modes (#54555780 / #54555799 /
  // #1f1f1f5c): a cool pill on warm paper, and near-invisible on the dark canvas.
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const name of [
      '--dsw-alias-button-tool-bar-fill',
      '--dsw-alias-button-tool-bar-hover',
      '--dsw-alias-button-tool-bar-fill-invisible',
    ]) {
      const pair = tokens[name]
      assert.match(pair.light, /^#[0-9a-f]{8}$/i, `${id} ${name}: a veil must carry alpha`)
      assert.match(pair.dark, /^#[0-9a-f]{8}$/i, `${id} ${name}: a veil must carry alpha`)
      assert.notEqual(pair.light, pair.dark, `${id} ${name} does not follow the mode`)
      for (const mode of ['light', 'dark']) {
        // A veil is the ink mixed toward the canvas, so it lands on one of their
        // hues — unless the whole palette is near-neutral, where hue is noise.
        const colour = pair[mode].slice(0, 7)
        const veil = oklabOf(colour)
        const ink = tokens['--dsw-alias-label-primary'][mode]
        const canvas = tokens['--dsw-alias-bg-base'][mode]
        if (veil.chroma < 0.005) {
          assert.ok(
            oklabOf(ink).chroma < 0.012 && oklabOf(canvas).chroma < 0.012,
            `${id}/${mode} ${name}: the veil went neutral on a tinted palette`,
          )
          continue
        }
        const toInk = hueGap(veil.hue, oklabOf(ink).hue)
        const toCanvas = hueGap(veil.hue, oklabOf(canvas).hue)
        assert.ok(Math.min(toInk, toCanvas) <= 10, `${id}/${mode} ${name}: ${veil.hue.toFixed(1)}deg from both`)
      }
    }
  }
})

test('semantic states are re-derived for warm paper, not inherited', () => {
  // The shipped states are tuned for #ffffff. On the cream canvas they measure
  // 1.94:1 (warn-primary), 2.52:1 (warn-label), 2.06:1 (success) and 4.06:1
  // (error) — legibility failures, not style choices. Every theme re-derives them.
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const page = tokens['--dsw-alias-bg-base'][mode]
      for (const name of TEXT_STATES) {
        const ratio = contrast(tokens[name][mode], page)
        assert.ok(ratio >= 4.5, `${id}/${mode}: ${name} is ${ratio.toFixed(2)}:1 on the page`)
      }
      for (const name of FILL_STATES) {
        const ratio = contrast(tokens[name][mode], page)
        assert.ok(ratio >= 3, `${id}/${mode}: ${name} is ${ratio.toFixed(2)}:1 on the page`)
      }
    }
  }
})

test('the focus ring clears 4.5:1 on every surface it can land on', () => {
  // WCAG 1.4.11 only asks 3:1 for a non-text indicator, but the ring is the sole
  // cue saying where the keyboard is, so it is held to the text threshold instead.
  // The accent is the thing at risk: two of the five were darkened to make this
  // true on the *darkest* surface a ring can land on, which is the message bubble.
  const surfaces = [
    '--dsw-alias-bg-base',
    '--dsw-alias-bg-layer-1',
    '--dsw-specific-input-major',
    '--dsw-specific-sidebar-fill',
    '--dsw-specific-bubble',
    '--dsw-alias-bg-overlay',
  ]
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const ring = tokens['--dsw-alias-state-business-primary'][mode]
      for (const name of surfaces) {
        const ratio = contrast(ring, tokens[name][mode])
        assert.ok(ratio >= 4.5, `${id}/${mode}: the focus ring is ${ratio.toFixed(2)}:1 on ${name}`)
      }
    }
  }
})

test('an accent hover moves away from the fill, not into it', () => {
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const fill = luminance(tokens['--dsw-alias-button-info-fill'][mode])
      const hover = luminance(tokens['--dsw-alias-button-info-hover'][mode])
      // The shipped pair goes deepseek-500 -> 400 in light and 400 -> 500 in
      // dark, i.e. hover always travels away from the fill. Inverting it makes a
      // hover read as a pressed state.
      if (mode === 'light') assert.ok(hover > fill, `${id}: light hover must lighten`)
      else assert.ok(hover < fill, `${id}: dark hover must darken`)
    }
  }
})

test('on-brand text is legible on the brand fill', () => {
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const ratio = contrast(
        tokens['--dsw-alias-label-primary-foreground'][mode],
        tokens['--dsw-alias-button-primary-fill'][mode],
      )
      assert.ok(ratio >= 4.5, `${id}/${mode}: on-brand contrast ${ratio.toFixed(2)}`)
    }
  }
})

// ---------------------------------------------------------------------------
// Selection pipeline
// ---------------------------------------------------------------------------

test('the boot global outranks the settings snapshot', () => {
  const form = { getSnapshot: () => ({ value: { theme: 'calm' } }), set: () => {}, subscribe: () => () => {} }
  const booted = mount({ boot: 'novel', form })
  assert.equal(booted.layer().source, NS)
  assert.equal(booted.tokens()['--dsw-alias-bg-base'].light, booted.canvasOf('novel').light)
  assert.notEqual(booted.tokens()['--dsw-alias-bg-base'].light, booted.canvasOf('calm').light)
})

test('an unusable value from either source falls through to the next', () => {
  const cream = mount({ boot: 'cream' }).canvasOf('cream').light
  const withTheme = (id) => ({ getSnapshot: () => ({ value: { theme: id } }), set: () => {}, subscribe: () => () => {} })

  // Unknown boot id, usable settings value: the settings value wins.
  assert.equal(mount({ boot: 'bogus', form: withTheme('cream') }).tokens()['--dsw-alias-bg-base'].light, cream)
  // Unknown boot id and no form at all: the default.
  assert.equal(mount({ boot: 'bogus' }).tokens()['--dsw-alias-bg-base'].light, cream)
  // No boot global and an unusable settings value: the default.
  assert.equal(mount({ form: withTheme('not-a-theme') }).tokens()['--dsw-alias-bg-base'].light, cream)
  // A malformed settings value must not throw.
  assert.equal(mount({ form: { getSnapshot: () => ({ value: null }) } }).tokens()['--dsw-alias-bg-base'].light, cream)
  // A settings scope that reports nothing usable must not throw either.
  assert.equal(mount({ form: { getSnapshot: () => undefined } }).tokens()['--dsw-alias-bg-base'].light, cream)
})

test('select repaints through the same source and writes the preference', () => {
  const writes = []
  const form = {
    getSnapshot: () => ({ value: { theme: 'cream' } }),
    set: (key, value) => writes.push([key, value]),
    subscribe: () => () => {},
  }
  const { face, layers } = mount({ form })
  const before = layers.length

  face().select('calm')
  assert.equal(layers.length, before + 1)
  assert.equal(layers[before].source, NS, 'the same source means replace, not stack')
  assert.equal(face().getSnapshot(), 'calm')
  assert.deepEqual(writes, [['theme', 'calm']])

  // Re-selecting the active theme is a no-op.
  face().select('calm')
  assert.equal(layers.length, before + 1)

  // An unknown id is refused rather than painted.
  face().select('bogus')
  assert.equal(layers.length, before + 1)
  assert.equal(face().getSnapshot(), 'calm')
  assert.deepEqual(writes, [['theme', 'calm']])
})

test('a failing preference write still applies the palette', () => {
  const form = {
    getSnapshot: () => ({ value: { theme: 'cream' } }),
    set: () => {
      throw new Error('settings scope is in memory mode')
    },
    subscribe: () => () => {},
  }
  const { face } = mount({ form })
  face().select('deep-work')
  assert.equal(face().getSnapshot(), 'deep-work')
})

test('a preference write that rejects asynchronously is handled', () => {
  // The real `ConfigForm.set` returns a promise that rejects after a refused
  // write recovers, so a synchronous try/catch is not enough: without a handler
  // this becomes an unhandled rejection in the page.
  let handled
  const form = {
    getSnapshot: () => ({ value: { theme: 'cream' } }),
    set: () => ({
      catch: (fn) => {
        handled = fn
      },
    }),
    subscribe: () => () => {},
  }
  const { face } = mount({ form })
  face().select('calm')
  assert.equal(face().getSnapshot(), 'calm', 'the palette applies regardless')
  assert.equal(typeof handled, 'function', 'the write promise must carry a handler')
  handled() // the handler itself must not throw
})

test('a settings scope without a usable set is tolerated', () => {
  const { face } = mount({ form: { getSnapshot: () => ({ value: { theme: 'cream' } }) } })
  face().select('calm')
  assert.equal(face().getSnapshot(), 'calm')
})

test('a pushed settings change is adopted', () => {
  let listener
  let value = { theme: 'cream' }
  const form = {
    getSnapshot: () => ({ value }),
    set: () => {},
    subscribe: (fn) => {
      listener = fn
      return () => {}
    },
  }
  const { face, layers } = mount({ form })
  assert.equal(face().getSnapshot(), 'cream')
  const before = layers.length

  value = { theme: 'calm' }
  listener()
  assert.equal(face().getSnapshot(), 'calm')
  assert.equal(layers.length, before + 1)

  // A push that resolves to the active theme, or to nothing usable, is ignored.
  listener()
  assert.equal(layers.length, before + 1)
  value = { theme: 'not-a-theme' }
  listener()
  assert.equal(layers.length, before + 1)
})

test('subscribers are notified, and a broken one cannot stall the rest', () => {
  const { face } = mount()
  const seen = []
  face().subscribe(() => {
    throw new Error('bad subscriber')
  })
  const off = face().subscribe(() => seen.push(face().getSnapshot()))
  face().select('calm')
  assert.deepEqual(seen, ['calm'])
  off()
  face().select('novel')
  assert.deepEqual(seen, ['calm'], 'an unsubscribed listener must stop hearing')
})

test('teardown disposes the override layer', () => {
  const { effects, layers } = mount()
  assert.equal(layers.length, 1)
  assert.equal(layers[0].disposed, false)
  const owned = effects.find(({ label }) => typeof label === 'string' && label.includes('token layer'))
  assert.ok(owned, 'the token layer must be owned by an effect')
  owned.cleanup()
  assert.equal(layers[0].disposed, true)
})

test('the defensive path: still mounts and paints without a settings scope', () => {
  // `configForms` is a hard dependency in the shipped composition, so this
  // state cannot occur there; the guards exist so a future composition that
  // drops the settings domain costs persistence rather than the whole plugin.
  const { registrations, tokens } = mount()
  assert.equal(registrations.length, 1)
  assert.ok(Object.keys(tokens()).length >= 80)
})

test('a documentless client tree still gets the palette', () => {
  // DSH's node e2e boots the client tree without a document, which is why the
  // shipped theme package guards its own stylesheet mounting. Only the row's
  // styling may be skipped; the palette must still apply.
  const loaded = loadBundle({ document: false })
  assert.equal(typeof loaded.sandbox.document, 'undefined')
  let layer
  loaded.module.apply({
    effect: (fn) => {
      const cleanup = fn()
      return () => {
        if (typeof cleanup === 'function') cleanup()
      }
    },
    locale: { register: () => () => {} },
    theme: {
      overrideTokens: (source, tokens) => {
        layer = { source, tokens }
        return () => {}
      },
    },
    slots: { inject: (_key, cb) => cb(), register: () => () => {} },
  })
  assert.ok(layer, 'the palette must still be applied')
  assert.equal(layer.source, NS)
  assert.ok(Object.keys(layer.tokens).length >= 80)
})

// ---------------------------------------------------------------------------
// Row rendering
// ---------------------------------------------------------------------------

test('the row renders one radio per theme, marking the active one', () => {
  const { registrations } = mount({ boot: 'calm' })
  const { definition, component } = registrations[0]
  const face = definition.inject().face
  const t = (key) => ({ 'row.title': 'Theme', 'row.description': 'desc' })[key] ?? key
  const tree = component({ t, face })

  const buttons = collect(tree, 'button')
  assert.equal(buttons.length, 5)
  assert.deepEqual(buttons.map((button) => button.props['aria-pressed']), [false, false, true, false, false])
  // Plain toggle buttons, deliberately not `role="radio"`: a radiogroup would
  // promise roving tabindex and arrow keys this row does not implement.
  assert.deepEqual(buttons.map((button) => button.props.role), Array(5).fill(undefined))
  assert.deepEqual(buttons.map((button) => button.props.type), ['button', 'button', 'button', 'button', 'button'])
  const group = collect(tree, 'div').find((node) => node.props.role === 'group')
  assert.ok(group, 'the swatch strip must be a labelled group')
  assert.equal(typeof group.props['aria-label'], 'string')

  // Clicking a swatch drives the same select path the store uses.
  buttons[0].props.onClick()
  assert.equal(face.getSnapshot(), 'modern-classic')

  const labels = collect(tree, 'span').filter((node) => node.props.className === 'dtw-label')
  assert.equal(labels.length, 5)
  assert.equal(labels[0].props.children, 'theme.modern-classic')

  // Every swatch carries both palettes so the chip can show them side by side.
  const halves = collect(tree, 'span').filter((node) => node.props.className === 'dtw-half')
  assert.equal(halves.length, 10)
  assert.equal(halves[0].props.style.background, face.options[0].light)
  assert.equal(halves[1].props.style.background, face.options[0].dark)
})

test('the row never hands React a non-primitive child', () => {
  // The bug this guards: rendering a `{ en, zh }` label object directly instead
  // of resolving it through `t` makes React throw "Objects are not valid as a
  // React child" at mount.
  const { registrations } = mount()
  const face = registrations[0].definition.inject().face
  const t = (key) => key
  const tree = registrations[0].component({ t, face })
  const walk = (node) => {
    if (node === null || node === undefined || typeof node === 'string' || typeof node === 'number') return
    assert.ok(typeof node.type !== 'undefined', `a child is a plain object: ${JSON.stringify(node)}`)
    const children = node.props.children
    for (const child of Array.isArray(children) ? children : [children]) walk(child)
  }
  walk(tree)
})

test('the row degrades instead of throwing without a locale function', () => {
  const { registrations } = mount()
  const face = registrations[0].definition.inject().face
  const tree = registrations[0].component({ face })
  assert.equal(collect(tree, 'button').length, 5)
})
