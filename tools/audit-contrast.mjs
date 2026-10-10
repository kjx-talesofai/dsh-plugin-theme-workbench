#!/usr/bin/env node
/**
 * Readability audit over the CSS the shipped DSH archive actually contains.
 *
 * `npm test` measures the token *matrix*: every text tier against `bg-base`, and
 * the washes against the colours the docs say are drawn on them. That is a
 * closed-world check — it can only see a pairing someone already knew about. This
 * tool is the open-world complement: it mines every rule in the archive that
 * paints a `color` on a `background`, resolves both through the shipped palette
 * and then through each of the plugin's ten palettes, and measures WCAG contrast.
 *
 * Method, and why each part is here:
 *
 *   - The corpus is every `.css` file plus every `.js` file that carries an inlined
 *     stylesheet, chosen by CONTENT. A path filter is a guess and this one was
 *     wrong — `dsh-client-<pkg>/lib/client.js` misses `client.excel.js` (the
 *     spreadsheet preview's 302 unconditionally-light rules), `client.terminal.js`,
 *     `client.pdf.js`, both `dsh-experimental-*` bundles and
 *     `dsh-session-log-export`. Reading all 6,094 `.js` entries costs ~0.2 s.
 *     Reading those inlined sheets with
 *     a regex over quoted runs silently drops whole components (ui-approval's CSS
 *     contains an escaped empty-string pair), so they are scanned with an escape-aware reader
 *     instead. A hole here is invisible: the audit simply reports fewer rules.
 *   - `color-mix(in srgb, …)` and `var()` chains are resolved; gradients, `url()`
 *     and `background: 0 0` resets are skipped and counted, so the coverage claim
 *     is bounded rather than implied.
 *   - Each warm palette is deliberately softer than the shipped cool one, so a raw
 *     ratio comparison flags the whole design. Section A normalises first: `k` is
 *     the palette's own primary-on-page ratio over the shipped one, and a pair is
 *     reported only if it degrades *more* than that general softness predicts.
 *   - Section D answers the question that matters most: of the pairs where the
 *     shipped palette is readable, how many are not readable under a theme.
 *
 * Usage:
 *   node tools/audit-contrast.mjs [path/to/app.asar]
 *
 * The default path is this machine's install. This tool is dev-only: it needs the
 * archive, so CI does not run it, and `files` keeps `tools/` out of the tarball.
 */
import { openSync, readSync, closeSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ARCHIVE = process.argv[2] ?? '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const THEME_IDS = ['modern-classic', 'novel', 'calm', 'deep-work', 'cream']
const MODES = ['light', 'dark']

// ---------------------------------------------------------------- colour math
const parse = (v) => {
  const s = String(v).trim().toLowerCase()
  let m
  // 3- and 4-digit hex must be here: `#fff` is what `.OnRn_q_removeFailed` paints
  // its icon with, and dropping it hides that rule from every section below.
  if ((m = /^#([0-9a-f]{3})$/.exec(s))) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1)
  if ((m = /^#([0-9a-f]{4})$/.exec(s))) return [0, 2, 4].map((i) => parseInt(m[1][i] + m[1][i], 16)).concat(parseInt(m[1][3] + m[1][3], 16) / 255)
  if ((m = /^#([0-9a-f]{6})$/.exec(s))) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1)
  if ((m = /^#([0-9a-f]{8})$/.exec(s))) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(parseInt(m[1].slice(6, 8), 16) / 255)
  if ((m = /^rgba?\(([^)]+)\)$/.exec(s))) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    if (parts.length < 3 || parts.some(Number.isNaN)) return null
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
  }
  return null
}
const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1)
const luminance = (c) => {
  const l = c.slice(0, 3).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const mix = (a, b, w) => [0, 1, 2].map((i) => a[i] * (1 - w) + b[i] * w).concat(1)

// ------------------------------------------------------------- the asar reader
function readArchive(path, want) {
  const fd = openSync(path, 'r')
  try {
    const sizeBuf = Buffer.alloc(8)
    readSync(fd, sizeBuf, 0, 8, 0)
    const headerSize = sizeBuf.readUInt32LE(4)
    const headerBuf = Buffer.alloc(headerSize)
    readSync(fd, headerBuf, 0, headerSize, 8)
    const json = JSON.parse(headerBuf.subarray(8, 8 + headerBuf.readUInt32LE(4)).toString('utf8'))
    const dataOffset = 8 + headerSize
    const files = []
    ;(function walk(node, prefix) {
      for (const [name, entry] of Object.entries(node.files ?? {})) {
        const full = prefix === '' ? name : `${prefix}/${name}`
        if (entry.files !== undefined) walk(entry, full)
        else if (typeof entry.offset === 'string' || typeof entry.offset === 'number') files.push({ path: full, offset: Number(entry.offset), size: Number(entry.size ?? 0) })
      }
    })(json, '')
    // Read inside the guard: `readAt` closing over `fd` would be a use-after-close
    // as soon as this function's `finally` ran.
    return files.filter(want).map((f) => {
      const buf = Buffer.alloc(f.size)
      readSync(fd, buf, 0, f.size, dataOffset + f.offset)
      return { path: f.path, text: buf.toString('utf8') }
    })
  } finally {
    closeSync(fd)
  }
}

// -------------------------------------------------------------- CSS extraction
/**
 * CSS text of one archive entry: the whole file for `.css`; for a JS bundle,
 * every inlined stylesheet, located by its `const css$N = "<...>"` literal and
 * read with an escape-aware scanner.
 *
 * A regex over quoted runs is NOT good enough here, and getting that wrong is
 * silent: it drops whole components (ui-approval's CSS contains `content:""` as
 * an escaped pair), so the audit reports fewer rules and every conclusion
 * inherits the hole.
 */
function cssOf(path, text) {
  if (path.endsWith('.css')) return stripComments(text)
  // Cheap reject before the scanner: most of the 6,000 `.js` entries carry no CSS.
  if (!/\/\/#region \\0dsh-css:|const css\$?\d* = ["'`]/.test(text)) return ''
  const out = []
  for (const m of text.matchAll(/const css\$?\d* = (["'`])/g)) {
    const quote = m[1]
    let i = m.index + m[0].length
    let body = ''
    let closed = false
    while (i < text.length) {
      const ch = text[i]
      if (ch === '\\') { body += text[i + 1]; i += 2; continue }
      if (ch === quote) { closed = true; break }
      body += ch
      i += 1
    }
    if (closed && /\{[^{}]*:/.test(body)) out.push(stripComments(body))
  }
  return out.join('\n')
}

/**
 * Drop `/* … *\/` comments, respecting quotes.
 *
 * The `.css` files ship comments, and a comment that happens to contain a brace
 * pair and a colon becomes a fake rule: it put a `Menu.module.css` prose sentence
 * in the selector column of an early run. Harmless for the contrast sections
 * (a fake rule has to resolve two colours to be measured) but not for the role
 * census in section E, which counts every token a property reads.
 */
function stripComments(css) {
  let out = ''
  let i = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      out += ch
      i += 1
      while (i < css.length && css[i] !== quote) { if (css[i] === '\\') { out += css[i]; i += 1 } out += css[i]; i += 1 }
      out += css[i] ?? ''
      i += 1
      continue
    }
    if (ch === '/' && css[i + 1] === '*') { const end = css.indexOf('*/', i + 2); i = end === -1 ? css.length : end + 2; continue }
    out += ch
    i += 1
  }
  return out
}

/** Walk `sel{decls}` blocks, tracking at-rule nesting. */
function rules(css) {
  const found = []
  const stack = []
  let i = 0
  let start = 0
  while (i < css.length) {
    const ch = css[i]
    if (ch === '"' || ch === "'") { const q = ch; i += 1; while (i < css.length && css[i] !== q) i += css[i] === '\\' ? 2 : 1; i += 1; continue }
    if (ch === '{') {
      const prelude = css.slice(start, i).trim()
      stack.push(prelude)
      if (prelude.startsWith('@')) { start = i + 1; i += 1; continue }
      const close = css.indexOf('}', i)
      if (close === -1) break
      found.push({ at: stack.slice(0, -1).join(' | '), selector: prelude, decls: css.slice(i + 1, close) })
      i = close + 1
      start = i
      continue
    }
    if (ch === '}') { stack.pop(); i += 1; start = i; continue }
    if (ch === ';') { start = i + 1; i += 1; continue }
    i += 1
  }
  return found
}

const declarations = (text) => {
  const out = {}
  for (const part of text.split(';')) {
    const idx = part.indexOf(':')
    if (idx === -1) continue
    out[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim()
  }
  return out
}

/** Resolve a value to a colour, following `var()` and simple `color-mix`. */
function resolveColor(value, palette, depth = 0) {
  if (depth > 12 || typeof value !== 'string') return null
  const direct = parse(value)
  if (direct) return direct
  const m = /^var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/i.exec(value.trim())
  if (m) {
    if (m[1] in palette && palette[m[1]] !== value) {
      const r = resolveColor(palette[m[1]], palette, depth + 1)
      if (r) return r
    }
    return m[2] ? resolveColor(m[2], palette, depth + 1) : null
  }
  const cm = /^color-mix\(in\s+srgb\s*,\s*([\s\S]+?)\s+([\d.]+)%\s*,\s*([\s\S]+?)\s*\)$/i.exec(value.trim())
  if (cm) {
    const a = resolveColor(cm[1], palette, depth + 1)
    const b = resolveColor(cm[3], palette, depth + 1)
    if (!a || !b) return null
    const w = parseFloat(cm[2]) / 100
    const mixed = mix(a, b, w)
    mixed[3] = a[3] * (1 - w) + b[3] * w
    return mixed
  }
  return null
}

// ------------------------------------------------------- the ten plugin palettes
function pluginPalettes(shipped) {
  const source = readFileSync(resolve(ROOT, 'client.js'), 'utf8')
  const boot = /const BOOT_GLOBAL = ['"]([^'"]+)['"]/.exec(source)[1]
  const out = {}
  const written = new Set()
  for (const id of THEME_IDS) {
    const sandbox = {}
    sandbox.document = { createElement: () => ({ dataset: {}, textContent: '', remove() {} }), head: { appendChild() {} } }
    sandbox.window = {
      __ModuleLoader__: {
        load({ factory }) {
          sandbox.__module = factory((name) => {
            if (name === 'react') {
              return {
                createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }),
                useState: (initial) => [initial, () => {}],
                useEffect: () => {},
                useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
              }
            }
            throw new Error(`unexpected require: ${name}`)
          })
        },
      },
    }
    sandbox.globalThis = sandbox
    vm.createContext(sandbox)
    new vm.Script(source, { filename: 'client.js' }).runInContext(sandbox)
    sandbox[boot] = id
    const layers = []
    sandbox.__module.apply({
      effect: (fn) => { fn(); return () => {} },
      locale: { register: () => () => {} },
      theme: { overrideTokens: (_source, tokens) => { layers.push(tokens); return () => {} } },
      slots: { inject: (_key, cb) => cb(), register: () => () => {} },
    })
    const layer = layers[layers.length - 1]
    for (const name of Object.keys(layer)) written.add(name)
    out[id] = {}
    for (const mode of MODES) {
      out[id][mode] = { ...shipped[mode] }
      for (const [name, pair] of Object.entries(layer)) out[id][mode][name] = pair[mode]
    }
  }
  return { palettes: out, written }
}

// ------------------------------------------------------------------------- main
/**
 * The corpus is selected by CONTENT, not by path.
 *
 * A path filter is a guess, and this one was wrong: `dsh-client-<pkg>/lib/client.js`
 * misses `client.excel.js` (302 unconditionally-light rules for the spreadsheet
 * preview), `client.terminal.js`, `client.pdf.js`, both `dsh-experimental-*`
 * bundles and `dsh-session-log-export`. Reading every `.js` in the archive and
 * keeping the ones that carry an inlined stylesheet costs about a fifth of a
 * second and removes the guess.
 */
const chunks = readArchive(ARCHIVE, (f) => f.path.endsWith('.css') || f.path.endsWith('.js'))

const shipped = { light: {}, dark: {} }
const ruleCache = new Map()
for (const chunk of chunks) {
  const css = cssOf(chunk.path, chunk.text)
  if (css === '') continue
  const parsed = rules(css)
  ruleCache.set(chunk.path, parsed)
  for (const rule of parsed) {
    const selector = rule.selector.replace(/\s+/g, '')
    if (!/^(html|:root|body)(\[data-ds-dark-theme\])?$/.test(selector)) continue
    const dark = /data-ds-dark-theme/.test(selector) || /prefers-color-scheme:\s*dark/.test(rule.at)
    for (const [name, value] of Object.entries(declarations(rule.decls))) {
      if (!name.startsWith('--dsw-')) continue
      const key = dark ? 'dark' : 'light'
      if (!(name in shipped[key])) shipped[key][name] = value
    }
  }
}

const { palettes, written } = pluginPalettes(shipped)
const stats = { rules: 0, measured: 0, skippedShape: 0, unresolved: new Map() }
const FILL_PROPERTY = /^(background|background-color|fill|stroke|--[\w-]*fill|--[\w-]*bg|--[\w-]*background)$/
const INK_PROPERTY = /^(color|border-color|border(-\w+)?-color|outline-color|caret-color|box-shadow|text-decoration-color)$/
/** token -> { fill, ink }: which job each token is asked to do. */
const roles = new Map()
/** every `--dsw-*` name read by any declaration, including other definitions. */
const readAnywhere = new Set()
const rows = []
for (const chunk of chunks) {
  if (!ruleCache.has(chunk.path)) continue
  for (const rule of ruleCache.get(chunk.path)) {
    const d = declarations(rule.decls)
    const bgRaw = d['background-color'] ?? d['background']
    const fgRaw = d['color']
    for (const [prop, value] of Object.entries(d)) {
      // Two different questions, deliberately counted separately. `readAnywhere`
      // answers "is this name consumed at all" and MUST include reads inside
      // other custom-property definitions — that is where most of the neutral
      // ramp is consumed (`--dsw-alias-x: var(--dsw-static-neutral-150)`), so
      // counting only fill/ink properties would call 29 written names dead
      // instead of the true handful.
      for (const hit of String(value).matchAll(/var\(\s*(--dsw-[a-z0-9-]+)/g)) readAnywhere.add(hit[1])
      const fill = FILL_PROPERTY.test(prop)
      const ink = INK_PROPERTY.test(prop)
      if (!fill && !ink) continue
      for (const hit of String(value).matchAll(/var\(\s*(--dsw-[a-z0-9-]+)/g)) {
        if (!roles.has(hit[1])) roles.set(hit[1], { fill: 0, ink: 0 })
        roles.get(hit[1])[fill ? 'fill' : 'ink'] += 1
      }
    }
    if (bgRaw === undefined || fgRaw === undefined) continue
    stats.rules += 1
    const bgBare = bgRaw.replace(/var\([^)]*\)/g, '')
    if (/gradient|url\(|none|transparent|inherit|currentcolor/i.test(bgBare) || /^0( 0)?$/.test(bgBare.trim())) { stats.skippedShape += 1; continue }
    const size = parseFloat(d['font-size'] ?? '')
    const weight = Number(d['font-weight'] ?? 400)
    const large = Number.isFinite(size) && (size >= 24 || (size >= 18.66 && weight >= 700))
    const floor = large ? 3 : 4.5
    const measure = (palette) => {
      let bg = resolveColor(bgRaw, palette)
      let fg = resolveColor(fgRaw, palette)
      if (!bg || !fg) return null
      const page = resolveColor('var(--dsw-alias-bg-base)', palette)
      if (bg[3] < 1) bg = over(bg, page ?? [255, 255, 255, 1])
      if (fg[3] < 1) fg = over(fg, bg)
      return contrast(fg, bg)
    }
    const shippedLight = measure(shipped.light)
    const shippedDark = measure(shipped.dark)
    if (shippedLight === null && shippedDark === null) {
      const why = [bgRaw, fgRaw].find((v) => resolveColor(v, shipped.light) === null && resolveColor(v, shipped.dark) === null) ?? bgRaw
      const key = why.slice(0, 80)
      stats.unresolved.set(key, (stats.unresolved.get(key) ?? 0) + 1)
      continue
    }
    stats.measured += 1
    const row = {
      file: chunk.path,
      selector: rule.selector.slice(0, 120),
      bg: bgRaw.slice(0, 60),
      fg: fgRaw.slice(0, 60),
      floor,
      shipped: { light: shippedLight, dark: shippedDark },
      themes: {},
    }
    for (const [id, palette] of Object.entries(palettes)) row.themes[id] = { light: measure(palette.light), dark: measure(palette.dark) }
    rows.push(row)
  }
}

console.log(`archive: ${ARCHIVE}`)
console.log(`entries scanned: ${chunks.length}  rules with both a background and a color: ${stats.rules}`)
console.log(`measured: ${stats.measured}   skipped as shape (gradient/url/reset): ${stats.skippedShape}`)
const unresolved = [...stats.unresolved.entries()].sort((a, b) => b[1] - a[1])
console.log(`skipped, a colour did not resolve: ${unresolved.reduce((n, [, c]) => n + c, 0)} across ${unresolved.length} distinct values`)
for (const [key, count] of unresolved.slice(0, 10)) console.log(`      x${String(count).padStart(3)}  ${key}`)

// Normalise for the palettes' deliberate softness before comparing to shipped.
const softness = {}
for (const id of THEME_IDS) {
  softness[id] = {}
  for (const mode of MODES) {
    const page = (palette) => contrast(resolveColor('var(--dsw-alias-label-primary)', palette), resolveColor('var(--dsw-alias-bg-base)', palette))
    softness[id][mode] = page(palettes[id][mode]) / page(shipped[mode])
  }
}

const degraded = []
const inconsistent = []
const severe = []
for (const row of rows) {
  for (const mode of MODES) {
    const sh = row.shipped[mode]
    if (sh === null) continue
    const values = THEME_IDS.map((id) => [id, row.themes[id][mode]]).filter(([, v]) => v !== null)
    if (values.length === 0) continue
    const worst = values.reduce((a, b) => (b[1] < a[1] ? b : a))
    const best = values.reduce((a, b) => (b[1] > a[1] ? b : a))
    const expected = sh * softness[worst[0]][mode]
    if (row.floor >= 4.5 && worst[1] < expected * 0.8 && worst[1] < 4.5) degraded.push({ row, mode, sh, worst, best, expected, values })
    if (best[1] - worst[1] > 0.6 && worst[1] < row.floor) inconsistent.push({ row, mode, sh, worst, best, values })
    if (worst[1] < 3 && sh >= 4.5) severe.push({ row, mode, sh, worst, best, values })
  }
}
degraded.sort((a, b) => a.worst[1] / a.expected - b.worst[1] / b.expected)
inconsistent.sort((a, b) => a.worst[1] - b.worst[1])
severe.sort((a, b) => a.worst[1] - b.worst[1])
const fmt = (values) => values.map(([id, v]) => `${id.slice(0, 4)}:${v.toFixed(2)}`).join(' ')

/** Section D: the headline. */
let readableShipped = 0
let unreadableThemed = 0
for (const row of rows) {
  for (const mode of MODES) {
    const sh = row.shipped[mode]
    if (sh === null || sh < 4.5) continue
    for (const id of THEME_IDS) {
      const v = row.themes[id][mode]
      if (v === null) continue
      readableShipped += 1
      if (v < Math.min(4.5, row.floor - 0.005)) unreadableThemed += 1
    }
  }
}

const section = (title, list, body) => {
  console.log(`\n########## ${title} (${list.length}) ##########`)
  for (const item of list) body(item)
}

section('A. DEGRADED past the palette\'s own softness', degraded, ({ row, mode, sh, worst, expected, values }) => {
  console.log(`\n[${mode}] ${row.selector}\n   bg=${row.bg}\n   fg=${row.fg}   floor=${row.floor}`)
  console.log(`   shipped=${sh.toFixed(2)}  expected~${expected.toFixed(2)}  got ${worst[1].toFixed(2)}  ${fmt(values)}\n   ${row.file}`)
})
section('B. ONE THEME BELOW THE FLOOR, THE OTHERS CLEAR', inconsistent, ({ row, mode, sh, values }) => {
  console.log(`\n[${mode}] ${row.selector}\n   bg=${row.bg}\n   fg=${row.fg}   floor=${row.floor}  shipped=${sh.toFixed(2)}  ${fmt(values)}\n   ${row.file}`)
})
section('C. BELOW 3:1 WHERE THE SHIPPED PALETTE IS COMFORTABLE', severe, ({ row, mode, sh, values }) => {
  console.log(`\n[${mode}] ${row.selector}\n   bg=${row.bg}\n   fg=${row.fg}   floor=${row.floor}  shipped=${sh.toFixed(2)}  ${fmt(values)}\n   ${row.file}`)
})

const dualRole = [...roles.entries()].filter(([, r]) => r.fill > 0 && r.ink > 0)
const oursDual = dualRole.filter(([name]) => written.has(name))
console.log('\n########## E. TOKENS ASKED TO BE A FILL AND AN INK COLOUR ##########')
console.log(`tokens read from the archive: ${readAnywhere.size}`)
console.log(`of those, used as both a fill and an ink colour: ${dualRole.length}, of which this plugin writes ${oursDual.length}`)
const dead = [...written].filter((name) => !readAnywhere.has(name)).sort()
console.log(`written by this plugin but never read by anything: ${dead.length}${dead.length ? ' — ' + dead.join(', ') : ''}`)
const readsWithoutWrite = [...readAnywhere].filter((name) => !written.has(name))
console.log(`read by the archive but not written by this plugin: ${readsWithoutWrite.length} (themed transitively or not at all)`)
console.log(`\nThis is the shape every defect in this file has had: one token, two jobs, and the`)
console.log(`two jobs need opposite luminance. Sections A to C are the verdict on whether a`)
console.log(`given pair can actually satisfy both; the census is here to name the risk set.`)
for (const [name, r] of oursDual.sort((a, b) => b[1].fill + b[1].ink - (a[1].fill + a[1].ink))) {
  console.log(`   ${name.padEnd(52)} fill x${String(r.fill).padStart(3)}  ink x${String(r.ink).padStart(3)}`)
}

console.log('\n########## D. THE HEADLINE ##########')
console.log(`pair-instances where the shipped palette reaches 4.5:1: ${readableShipped}`)
console.log(`  of those, below 4.5 under the theme: ${unreadableThemed}`)
console.log(`\nNOTE: only rules that declare BOTH a background and a color are measured.`)
console.log(`A rule that paints text over an inherited background is invisible to this method;`)
console.log(`npm test covers the token matrix for those.`)
