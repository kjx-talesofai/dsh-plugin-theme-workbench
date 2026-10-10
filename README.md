# dsh-plugin-theme-workbench

Five themes for the DeepSeek Harness Web client, each with a light **and** a dark
palette, plus the settings row that switches between them.

Built for the case the built-in Appearance row cannot serve: it renders a
hardcoded Light / Dark / System cube set, so a third-party theme has nowhere to
appear. This plugin draws its own row and applies its palette through the
official theme service, which means your light / dark / system preference keeps
working underneath.

## Install

Not published on npm, so install it from the repository:

```sh
dsh plugin --profile desktop add github:kjx-talesofai/dsh-plugin-theme-workbench#v0.1.0
```

A local checkout works too, but the path must be **absolute** — a relative path is
refused:

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-plugin-theme-workbench
```

Restart to load the Host half, then open **Settings → General → Theme**. Changing
the theme afterwards needs no restart and no refresh.

To upgrade, uninstall first and then install the new revision; reinstalling over
an existing row is not supported.

## The themes

| Theme | Light canvas | Dark canvas | Character |
| --- | --- | --- | --- |
| Modern Classic | `#fbfbfc` | `#15171b` | Cool paper, near-black ink, deep blue accent |
| Novel | `#f6f0e2` | `#1d1a15` | Aged paper, sepia ink, muted oxblood |
| Calm | `#f2f5f2` | `#111614` | Soft sage, low contrast, quiet edges |
| Deep Work | `#f6f6f5` | `#0c0e11` | Near-monochrome, high contrast, muted bronze |
| **Cream** (default) | `#f7f3ea` | `#1b1917` | Warm off-white paper, soft clay accent |

Each theme is seven seed colours per mode, from which ~83 structural tokens are
derived. Text tiers are **solved for a contrast target** rather than faded by a
fixed fraction, so a warm sepia or sage ink is exactly as legible as the shipped
near-black one: the palette DSH ships puts `label-tertiary` at 3.71:1 in light
mode, and every theme here meets or beats that ladder rather than merely
approaching it.

## How it works

- **`ctx.theme.overrideTokens`, not `register`.** `register` adds a theme to the
  registry, but `setTheme` only persists ids in the built-in `light | dark |
  system` union — so a registered third-party theme stays invisible to the
  shipped picker *and* loses its selection on restart. Stacking a token layer
  over the active built-in theme avoids both problems and lets the OS scheme
  keep flipping the palette.
- **The choice is a real Host preference.** The Host half declares a
  `.volatile()` `Config` field; the browser half reads and writes it through
  `ctx.configForms`, so it lands in your profile's `cordis.patch.yml` next to
  every other DSH preference — not in `localStorage`.
- **The chosen palette is what renders first.** The Host pushes the persisted id
  into every index render as a `global` row, so the browser half's first
  `overrideTokens` call already uses your theme. Without that, the settings scope
  starts at its schema defaults, so the app would paint the default palette and
  then visibly repaint when the durable value loaded. (DSH's own pre-plugin
  loading screen is still drawn by its bootstrap before any plugin mounts, so that
  screen keeps the built-in canvas colour; it goes as soon as the shell mounts.)
- **Semantics are inherited, not recoloured.** `state-error-*`, `state-success-*`,
  `state-warn-*`, the diff colours, the masks and the document-selection blue keep
  their built-in values, so red still means failure and a selection over a
  document image still reads as a selection. The one exception is
  `state-idle-primary`: the plugin never writes it, but it reads the cold-grey
  ramp, and that ramp is tinted (see below), so its hue follows the theme while
  its meaning does not. That is the whole reach of the ramp write — the other
  seven aliases reading the ramp are overridden directly — and a test pins the
  list so a future alias cannot drift in unnoticed.
- **One dependency, and it is only for the Host half.** The settings schema must
  be a real `schemastery` schema: `dsh-settings` resolves an entry's `Config` with
  `schema !== undefined && "toJSON" in schema`, and then walks it to decide which
  fields are page-writable. A hand-rolled object cannot satisfy that. The browser
  half has no dependencies at all — it only requires the loader's `react` seed.

## What this is not

A palette plugin, not a full reskin. A custom property on `:root` still inherits
into `body`, so a `body`-level override *does* win for body's descendants — which
means syntax colours (`--shiki-token-*`), fonts and corner radii are technically
reachable from here, and a plugin that wants them can set them the same way. What
is genuinely out of reach is a shorter list:

- **Anything declared on `body, body *`.** The `--dsw-elevation-stroke` /
  `-panel` / `-prominent` / `-soft` shadow recipes are re-declared on *every*
  element, so a `body` override is shadowed everywhere and shadows cannot be
  re-themed. Their colour does follow the theme, because that part
  (`--dsw-elevation-stroke-color`) is body-level and reads `border-l4`.
- **Native material.** On macOS the sidebar column is Electron vibrancy, not a
  painted fill: the only CSS is a `color-mix` that dilutes this plugin's
  `--dsw-specific-sidebar-fill` to 38.8% of a 40%-alpha layer, over a hardcoded
  blue gradient, over whatever is behind the window. The sidebar is therefore
  *tinted*, never recoloured, and the same is true of the window backdrop. That is
  the platform's translucency, not something a token can or should defeat.
- **Hardcoded literals in component CSS** — a few macOS-only fills such as the
  new-session button's `#ffffff8c`, which no token feeds.

If you want a deeper reskin, inject your own stylesheet — but still call
`overrideTokens` for the palette, so the `theme-color` metadata and the native
window chrome follow along.

## Requirements

- DSH `>=0.2.0-rc.1 <0.3.0-0`, web client.
- A loopback page. DSH runs its settings scope in memory on a non-loopback
  address, where a theme still applies for the session but is not persisted.

## Known limitations

- **The macOS sidebar only tints.** See above: it is a native translucent
  material, and this plugin's sidebar token reaches only 38.8% of a 40%-alpha
  layer of it. The sidebar's icons, hover and active states do follow the theme;
  its background cannot be made opaque without discarding the platform's
  translucency.
- **Shadows are fixed.** The elevation recipes are re-declared per element, so
  their geometry and alpha apply unchanged; only their hairline colour follows.
- **Non-loopback pages do not persist.** DSH keeps its settings scope in memory
  off loopback, so the theme applies for the session and resets on reload.

## Configure without the UI

The row id is the settings namespace, so the value can also be set in the
profile's `cordis.patch.yml`:

```yaml
- id: theme-workbench
  name: 'dsh-plugin-theme-workbench'
  config:
    theme: cream # modern-classic | novel | calm | deep-work | cream
```

## Development

```sh
npm test
```

Two references back the implementation, both dev-only and neither shipped:

- `docs/token-inventory.md` — the token surface of DSH 0.2.0-rc.2: where the
  light/dark palettes actually live, how a snapshot reaches the DOM, all 107
  `--dsw-alias-*` names (101 of which carry both mode values), and the traps a
  theme author hits (`brand-primary` is *not* the accent; `menu-icon` and
  `turn-trigger-bg` derive from different sources per mode; ten aliases are
  consumed but declared nowhere).
- `docs/surface-map.md` — which token paints which surface, which surfaces are
  re-declared locally, and what a `body`-level override can never reach.

## License

MIT
