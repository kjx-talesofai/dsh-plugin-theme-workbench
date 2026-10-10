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

Each theme is six seed colours per mode, from which ~83 structural tokens are
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
  `state-warn-*`, `state-idle-*`, the diff colours, the masks and the
  document-selection blue keep their built-in values, so red still means failure
  and a selection over a document image still reads as a selection.

## What this is not

A palette plugin, not a full reskin. Fonts, corner radii, syntax highlighting and
wallpapers live on `:root` / `--shiki-*`, which the theme presenter never writes
to (it sets inline custom properties on `body`), so they are out of reach by
design. If you want those, you need a plugin that injects its own stylesheet — and
it should still call `overrideTokens` for the palette, so the `theme-color`
metadata and the native window chrome follow along.

## Requirements

- DSH `>=0.2.0-rc.1 <0.3.0-0`, web client.
- A loopback page. DSH runs its settings scope in memory on a non-loopback
  address, where a theme still applies for the session but is not persisted.

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

`docs/token-inventory.md` is a reference for the DSH 0.2.0-rc.2 token surface:
where the light/dark palettes actually live, how a snapshot reaches the DOM, all
101 of the 107 `--dsw-alias-*` names carry both mode values, and the traps a theme
author
hits (`brand-primary` is *not* the accent; `menu-icon` and `turn-trigger-bg`
derive from different sources per mode; ten aliases are consumed but declared
nowhere). It is dev-only and not shipped.

## License

MIT
