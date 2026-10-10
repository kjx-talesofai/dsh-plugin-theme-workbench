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
]

/** Semantic families the themes deliberately inherit from the built-in palette. */
const INHERITED = [
  '--dsw-alias-state-error-primary', '--dsw-alias-state-error-secondary',
  '--dsw-alias-state-success-primary', '--dsw-alias-state-success-secondary', '--dsw-alias-state-success-tertiary',
  '--dsw-alias-state-warn-primary', '--dsw-alias-state-warn-secondary', '--dsw-alias-state-warn-tertiary',
  '--dsw-alias-state-warn-label', '--dsw-alias-state-idle-primary',
  '--dsw-alias-code-diff-added', '--dsw-alias-code-diff-deleted',
  '--dsw-alias-bg-document-selection',
]

const ALLOWED = new Set([...SHIPPED_ALIASES, ...SHIPPED_SPECIFIC])
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

/** Peak-to-trough spread of the channels: 0 for a neutral, larger for a tinted colour. */
function chroma(hex) {
  const [r, g, b] = parseHex(hex)
  return Math.max(r, g, b) - Math.min(r, g, b)
}

test('the raised ramp climbs away from the canvas in every theme and mode', () => {
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const ladder = [
        '--dsw-alias-bg-base',
        '--dsw-alias-bg-layer-1',
        '--dsw-alias-bg-layer-2',
        '--dsw-alias-bg-layer-3',
      ].map((name) => luminance(tokens[name][mode]))
      for (let step = 1; step < ladder.length; step += 1) {
        assert.ok(
          ladder[step] >= ladder[step - 1] - 0.0005,
          `${id}/${mode}: surface ${step} is not above surface ${step - 1}`,
        )
      }
    }
  }
})

test('the composer separates from the page without going cold', () => {
  // The defect this guards: deriving "raised" surfaces by mixing the canvas
  // toward pure white spends the theme's chroma, so the composer and cards land
  // as cold white patches on a warm page. It must separate from the canvas, and
  // when the canvas carries colour the composer has to keep that cast.
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const canvas = tokens['--dsw-alias-bg-base'][mode]
      const composer = tokens['--dsw-specific-input-major'][mode]
      assert.notEqual(composer, canvas, `${id}/${mode}: the composer must separate from the page`)
      const base = chroma(canvas)
      if (base >= 4) {
        assert.ok(
          chroma(composer) >= base * 0.4,
          `${id}/${mode}: the composer washed out the canvas cast (${chroma(composer)} vs ${base})`,
        )
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
 * `label-tertiary` at 3.71 and `label-caption` at 2.13 in light mode. The
 * solver targets sit above these, so the assertion below is near-exact.
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

test('tokens consumed as a background keep their own text legible', () => {
  // The gap this closes: measuring every tier only against `bg-base` cannot see a
  // wash token that is consumed *under* accent text. `ui-plan` draws its chip as
  // `background: state-business-tertiary; color: state-business-primary`, and
  // `ui-conversation` draws `label-primary-bluish` over the same wash.
  for (const id of THEME_IDS) {
    const tokens = mount({ boot: id }).tokens()
    for (const mode of ['light', 'dark']) {
      const wash = tokens['--dsw-alias-state-business-tertiary'][mode]
      const chip = contrast(tokens['--dsw-alias-state-business-primary'][mode], wash)
      const floor = mode === 'light' ? 3.6 : 4.39
      assert.ok(chip >= floor - 0.02, `${id}/${mode}: accent on its wash ${chip.toFixed(2)} < ${floor}`)

      const body = contrast(tokens['--dsw-alias-label-primary-bluish'][mode], wash)
      // The built-in palette reaches 10.53:1 in light mode because its accent is
      // a far darker, cooler blue than any warm accent can be. 6.5 is the floor
      // held here instead: still well clear of WCAG AA for body text, and the
      // token keeps the accent-tinted character its name promises.
      assert.ok(body >= 6.5, `${id}/${mode}: label on the wash ${body.toFixed(2)} < 6.5`)
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
