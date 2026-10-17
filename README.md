<p align="center">
  <img src="assets/icon.svg" alt="dsh-plugin-theme-workbench" height="112"/>
</p>

# dsh-plugin-theme-workbench

Five themes for the **DeepSeek Harness** Web client. Each ships a **light and a dark palette**, so your own light / dark / system setting still chooses the mode — and the choice is saved as a real Host preference, not in browser storage.

<p align="center">
  <a href="https://github.com/kjx-talesofai/dsh-plugin-theme-workbench/releases"><img src="https://img.shields.io/github/v/release/kjx-talesofai/dsh-plugin-theme-workbench?label=release&style=flat-square&color=blue" alt="release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kjx-talesofai/dsh-plugin-theme-workbench?label=license&style=flat-square&color=green" alt="license"></a>
  <a href="https://github.com/kjx-talesofai/dsh-plugin-theme-workbench/actions/workflows/ci.yml"><img src="https://github.com/kjx-talesofai/dsh-plugin-theme-workbench/actions/workflows/ci.yml/badge.svg?branch=main&event=push" alt="CI"></a>
  <img src="https://img.shields.io/badge/DSH-%E2%89%A5%200.2.0--rc.1-blueviolet?style=flat-square" alt="DSH >= 0.2.0-rc.1">
</p>

> dsh-plugin-theme-workbench — 五套主题，每套都带浅色与深色，米白是默认

<details>
<summary><b>中文说明（点开）</b> —— 五套主题，每套都带明暗两套配色，米白是默认</summary>

**它是什么**：DSH Web 客户端的主题插件。在「设置 → 通用」里加一行选择器，五套主题任选：**米白**（默认，暖米白纸感）、**书卷**（旧纸棕墨）、**静谧**（柔和鼠尾草绿）、**现代经典**（冷调纸白 + 深蓝点缀）、**深度工作**（近黑白）。

**为什么做**：DSH 内置的「外观」那一行是**写死的三个方块**（浅色／深色／跟随系统），第三方主题永远挤不进去；而且 `ctx.theme.setTheme(第三方id)` 在源码里只把 `light|dark|system` 三个值写进设置，其余**不落盘**——选了，重启就没了。所以第三方主题这个扩展点，官方文档自己写着「是扩展点，不是产品」。这个插件把这条缝补齐：自己画一行选择器，并且把选择真正存起来。

**和其他主题插件的分工**：社区里多数主题要么自己往页面塞 `<style>` 硬盖（只能靠 `!important`，DSH 一改样式就崩），要么走 `register()` ——而 `register()` 正是上面那条死路。这个插件走的是官方通道 `ctx.theme.overrideTokens()`：它只在**当前生效的内置主题之上叠一层 token**，所以**你的明暗偏好照常工作**，系统切换主题时配色也跟着切。代价是它只能改配色，不能改字体、圆角、壁纸。

**怎么装**（在 DSH「添加插件」里填，**不需要 npm 账号、也无需发布**）：

| 填入 | 形式 |
|---|---|
| GitHub | `github:kjx-talesofai/dsh-plugin-theme-workbench#v0.1.4`（当前可用） |
| 本地目录 | 绝对路径，例如 `/path/to/dsh-plugin-theme-workbench` |

装完**重启桌面端**（host 半边只在启动时加载）。之后换主题**不用刷新、也不用再重启**。

**怎么用**：设置 → 通用 → **主题** → 点色块。每块色块左边是浅色、右边是深色，中间一点是强调色。

**注意事项**：

- **macOS 的侧边栏只能「染色」**：它是系统级的半透明毛玻璃（Electron vibrancy），插件那条 sidebar token 只占到一层 40% 透明混合里的 **38.8%**，底下还有一条写死的蓝紫渐变。硬要它变成不透明的米白，等于把系统的通透感干掉，会更难看，所以不做。侧边栏的**图标、hover、选中态**都是跟着主题走的。
- **阴影改不了**：DSH 把阴影配方声明在 `body, body *` 上，每个元素都自己重新声明一遍，body 级覆盖被屏蔽。只有它的发丝线颜色跟着主题。（所以**每一块面都得靠填充色和发丝线把层次说清楚**，这也是本插件把表面阶梯做得很讲究的原因。）
- **非 loopback 页面不落盘**：DSH 在非回环地址下把设置作用域放在内存里，主题这次会生效，刷新就没了。
- 只改了配色：**字体、圆角、语法高亮、壁纸**都不在范围内。

**卸载**：DSH「插件」列表里卸载 `dsh-plugin-theme-workbench` → 重启。主题选择留在你 profile 的 `cordis.patch.yml` 里，想一起清掉就把那段 `- id: theme-workbench` 删掉。

**老实说（实测范围）**：只在 **macOS（Apple Silicon）+ DSH Desktop 0.2.0-rc.2** 上端到端跑过（浅色、深色、切换、落盘、卡片观感都实际看过）；升级到 **0.2.1-rc.2** 后重核：本插件写入的 86 个 `--dsw-alias-*` 名字在打包产物里一个都没少，设置里「外观」那一行也还在。Windows / Linux 未测；DSH 升级后上游契约可能变化，见下方 Compatibility。

</details>

## Why

DSH's built-in Appearance row renders a hardcoded Light / Dark / System cube set, so a third-party theme has nowhere to appear. And `ctx.theme.setTheme` only persists ids inside that same three-value union — so a theme registered through `ctx.theme.register()` is both invisible to the shipped picker *and* loses its selection on restart. The upstream README is candid about this: third-party themes are "an extension point, not a product".

This plugin closes both gaps and nothing else:

- **It stacks a token layer** with `ctx.theme.overrideTokens()` over whichever built-in theme is active, rather than registering a theme of its own. Your light / dark / system preference keeps working, and the OS scheme keeps flipping the palette — so every theme here ships **two** palettes instead of being locked to one.
- **It draws its own row**, because a theme that wants a switch has to.
- **It saves the choice as a Host preference**, next to every other DSH setting, instead of in `localStorage`.
- **It is a palette plugin, not a reskin.** Fonts, radii, syntax highlighting and wallpapers stay DSH's.

## The themes

| Theme | Light canvas | Dark canvas | Character |
| --- | --- | --- | --- |
| **Cream** (default) | `#f7f3ea` | `#1b1917` | Warm off-white paper, soft clay accent |
| Novel | `#f6f0e2` | `#1d1a15` | Aged paper, sepia ink, muted oxblood |
| Calm | `#f2f5f2` | `#111614` | Soft sage, low contrast, quiet edges |
| Modern Classic | `#f7f8fa` | `#15171b` | Cool paper, near-black ink, deep blue accent |
| Deep Work | `#f6f6f5` | `#0c0e11` | Near-monochrome, high contrast, muted bronze |

Each theme is **three seed colours per mode** — a canvas, an ink and an accent — from which all **117 tokens** are derived. Nothing else is hand-listed, so a theme cannot drift out of its own hue or quietly lose its warmth.

## Install

Use DSH's plugin install dialog (**Add plugin**) with either of these, then restart the desktop app:

```text
github:kjx-talesofai/dsh-plugin-theme-workbench#v0.1.4   # GitHub, pinned to this release
/absolute/path/to/dsh-plugin-theme-workbench             # local checkout (dev)
```

> This plugin is **not published to the npm registry**. A relative path is refused by DSH (`a local path must be absolute`), so use the absolute one. `npm pack` (in a checkout) produces a `.tgz` you can hand to someone else.

CLI equivalent:

```sh
dsh plugin --profile desktop add github:kjx-talesofai/dsh-plugin-theme-workbench#v0.1.4
```

To upgrade, uninstall first and then install the new revision — reinstalling over an existing row is not supported.

## Usage

1. **Settings → General → Theme.**
2. Click a swatch. Each swatch shows the light palette on its left half and the dark on its right, with the accent as the dot.
3. Switch **Settings → General → Appearance** between Light and Dark to see the other palette. No refresh, no restart.

The choice lands in your profile's `cordis.patch.yml`, so it can also be set without the UI:

```yaml
- id: theme-workbench
  name: 'dsh-plugin-theme-workbench'
  config:
    theme: cream # cream | novel | calm | modern-classic | deep-work
```

### How it works

```
Settings row ──▶ ctx.configForms ──▶ host Config ──▶ ~/.dsh/profiles/PROFILE/cordis.patch.yml
     │  (the row id IS the settings namespace)
     │
     └──▶ ctx.theme.overrideTokens(source, { token: { light, dark } })
                        │
                        ▼
        ThemePresenter writes them as inline custom properties on <body>,
        retracting the previous set first — so unloading restores everything.

index render ──▶ webserver/index-inject { kind: 'global' }
                        │
                        ▼
        globalThis.__DSH_THEME_WORKBENCH__ = <persisted id>
                        │
                        └──▶ the plugin's FIRST overrideTokens call is already correct,
                             instead of the schema default followed by a repaint.
```

| | |
|---|---|
| Apply | `ctx.theme.overrideTokens`, one layer keyed by the package id (re-apply replaces, never stacks) |
| Persist | a `.volatile()` `Config` field on the Host half; `dsh-settings` derives the namespace from the Loader row id |
| First paint | the persisted id is pushed into every index render as a `global` row |
| Row | one additive occupant of `settings.general.item`, own id, `order: 13` |
| Teardown | the override layer, the row's `<style>` tag, the locale dict and the slot injection all return real disposers |

## Design rules

The palette is derived, not tabulated, and the rules are the point — they were researched against published design systems and then verified numerically. Two of them are counter-intuitive enough to be worth stating.

**In light mode, content surfaces step *down* from the canvas.** Cards, the composer, the sidebar, code blocks and bubbles are all slightly *darker* than the page; only surfaces that genuinely float (menus, popovers, dialogs) sit above it, capped at L\* 98.5. That is what paper-like palettes actually do — Material 3's container ladder steps down 2 tone units, and Solarized, Everforest, Kanagawa, Catppuccin and Radix all step down too. Two reasons: a raised sheet is *shadowed*, and at L\* 97–99 there is almost no sRGB room left for chroma, so a lighter warm surface is white **by force of the colour space** no matter what was intended. Dark mode inverts the direction, because emission adds light.

**Nothing is derived by mixing toward white.** Surfaces are *re-sampled* from the canvas: keep the hue, move the lightness, scale the chroma by an explicit factor. The old mix spent the canvas chroma by construction — the composer step kept 13.4% of the cream canvas's warmth and landed on `#fefdfc`.

**Text tiers and semantic states are solved, not inherited.** Each text tier is solved for the contrast the *built-in* palette reaches (light 5.8 / 3.71 / 2.13), so a soft sepia or sage ink is exactly as legible as the shipped near-black one. The built-in semantic states are tuned for `#ffffff` and are legibility failures on warm paper — measured on the cream canvas, `state-warn-primary` is 1.94:1, `state-warn-label` 2.52:1, `state-success-primary` 2.06:1 and `state-error-primary` 4.06:1 — so each theme supplies warm-paper equivalents. The focus ring clears 4.5:1 on all sixty surface pairs.

**Every token spent as a background is solved for *all* the text drawn on it, not for its own name.** Three washes and one badge are. The failure mode is the same each time: the token's name describes a role (`sidebar-nav-item-active-accent`, `state-success-tertiary`), so deriving it from that role — a 12–22 % mix of the accent into the sidebar, a fixed fraction into the canvas — leaves the label sitting on its own colour, at **1.25–1.53:1 in all ten palettes** for the badge and 4.21–4.48:1 for the success chip. Not faint: invisible, in the badge's case. All four are now the largest tint that keeps every colour drawn on them at 4.5:1, solved together rather than per text, because which text binds differs by mode (the built-in pairing reaches only 3.60:1 in light mode for the same chip).

The set is enumerated from the archive rather than guessed: [`tools/audit-contrast.mjs`](tools/audit-contrast.mjs) mines every rule in the shipped bundle that paints a colour on a background and re-measures it under all ten palettes. It is how the badge was found, and it is what `npm test` cannot do on its own — a test can only check a pairing someone already knew about.

**Decorative art is derived too, not inherited.** The onboarding flow's accent and its three gradient ramps are declared once upstream with no dark twin, so they keep their violet/blue/cyan on warm paper in both modes. Here the ramps become three rotations of the theme's *own* accent — a warmer and a cooler neighbour, at the shipped stop geometry — which keeps the three cards tellable apart without importing two colours the theme does not own. The frosted card they sit on is re-sampled from the canvas, and the toolbar veils come from the ink rather than from the shipped mid-grey that is a cool pill on warm paper and near-invisible on a dark one.

Everything above is measured by the test suite: the direction of every step, the 6 L\* ceiling inside a light palette, the L\* 98.5 warm-gamut ceiling, chroma retention across the ramp, the text ladder, the hue family of the decorative ramps, and every contrast floor.

## What it does not reach

- **The macOS sidebar only tints.** It is Electron vibrancy, not a painted fill: the only CSS is a `color-mix` that dilutes this plugin's sidebar token to **38.8% of a 40%-alpha layer**, over a hardcoded blue gradient, over whatever is behind the window. Recolouring it would mean discarding the platform's translucency. Its icons, hover and active states do follow the theme.
- **Shadows are fixed.** `--dsw-elevation-stroke/-panel/-prominent/-soft` are re-declared on `body, body *`, so every element shadows a body-level override and the recipes' geometry and alpha apply unchanged. Their *hairline colour* does follow, because that part is body-level.
- **A few macOS-only literals**, such as the new-session button's `#ffffff8c`, which no token feeds.
- **The spreadsheet preview stays white.** Its stylesheet is a third-party sheet (fortune-sheet, in `client.excel.js`) carrying 233 colour declarations and not one dark-mode selector, so opening a `.xlsx` in the right-hand panel gives you a white application inside a dark theme. No custom property reaches it. The PDF preview and the terminal do follow the theme; the terminal's IME overlay does not.
- **Code and file diffs keep the shipped green and red.** Those hues carry meaning (added / removed), the shipped values are already mode-aware, and the audit measured no readability or adaptation defect in them. They stay.
- **`--dsw-alias-button-tool-bar-fill-invisible` is written but unread.** The shipped sheet declares it and nothing consumes it in 0.2.0-rc.2. It is covered anyway so the toolbar family is not half-themed if a consumer appears.
- **Fonts, radii and syntax highlighting.** A `:root` custom property still inherits into `body`, so these are technically reachable from here; this plugin deliberately does not touch them.

## Compatibility

Verified end-to-end on **macOS (Apple Silicon) · DSH Desktop 0.2.0-rc.2**, with the light and dark palettes, live switching and persistence all confirmed by eye and by inspecting the running theme service. Re-checked after the app moved to **0.2.1-rc.2**: all 86 `--dsw-alias-*` names this plugin writes are still declared by the shipped bundle (read out of `app.asar`, not assumed), and its row still seats in General.

Upstream contracts this plugin depends on, all pinned by the test suite:

| Contract | Where it comes from |
|---|---|
| `overrideTokens(source, {light, dark})` replaces per source | `dsh-client-ui-theme` |
| The token layer is applied inline on `body`, retracted on change | `dsh-client-ui-layout` (`ThemePresenter`) |
| `Config` needs `toJSON`; the namespace is the Loader row id; only `.volatile()` fields are page-writable | `dsh-settings` |
| `kind: 'global'` index-injection rows | `dsh-host-webserver` |
| A client bundle needs `dsh.client.platform` **and** `exports["./client"]` | `dsh-client-modules` |
| The 107 `--dsw-alias-*` names and their light/dark values | `dsh-client-ui-theme` |

Not tested: Windows, Linux, and DSH versions other than 0.2.0-rc.2 and 0.2.1-rc.2. Run `npm test` first after a DSH upgrade — the allowlist of token names is a deliberate snapshot, so an upstream rename fails loudly instead of silently leaking the built-in colour.

## Development

> The `npm` below is just the CLI bundled with Node — no account, nothing published.

```sh
npm test             # 49 tests; no install step needed, run it on a bare checkout
npm pack --dry-run   # what actually ships (9 files)
```

`npm test` needs no `node_modules`: the suite evaluates the browser half as a script in a `node:vm` and reads the Host half as text, so it never imports the one runtime dependency. CI relies on exactly that.

Repo layout — **sources vs artifacts**:

| Path | What it is | Ships to users |
|---|---|---|
| `index.js` | host half: the `.volatile()` settings schema + the index-injection row | ✓ |
| `client.js` | browser half: the hand-written client bundle (no build step) | ✓ |
| `cordis.patch.yml` | bundle layer: inserts this plugin's Loader row | ✓ |
| `assets/icon.svg` | plugin icon shown in DSH's plugin manager | ✓ |
| `locale/{en,zh}.json` | plugin-manager title and description | ✓ |
| `tests/plugin.test.mjs` | the whole suite: bundle shape, slot contract, token derivation, contrast floors, the selection pipeline | ✗ |
| `docs/token-inventory.md` | the DSH 0.2.0-rc.2 token surface: where the light/dark palettes live, how a snapshot reaches the DOM, all 107 alias names, and the traps | ✗ |
| `docs/surface-map.md` | which token paints which surface, what is re-declared locally, and what a `body`-level override can never reach | ✗ |
| `docs/design-notes.md` | the warm-paper design specification the surface ramp is built from: reference palettes with citations, the elevation recipe, chroma and hue discipline, anti-patterns | ✗ |
| `docs/readability-audit.md` | what that audit found, its coverage limits, and the one finding left open | ✗ |
| `tools/asar.mjs` | read-only ASAR reader used to inspect the app bundle | ✗ |
| `tools/audit-contrast.mjs` | the archive-wide readability audit: every rule that paints a colour on a background, re-measured under all ten palettes | ✗ |

The `docs/` references are the research behind the numbers and are deliberately kept in the repo: two describe the platform (what is themeable, what is not), the third is the design argument, and the fourth is the audit that re-checks the result against the shipped archive. None of them ship.

## Uninstall

Remove the plugin in DSH's plugin list and restart. The theme choice stays in your profile's `cordis.patch.yml`; delete the `- id: theme-workbench` block to remove it too.

## License

[MIT](LICENSE) © 2026 Jiaxin Kou

<p align="center">
  <a href="https://hypersampling.com">
    <img src="https://assets.hypersampling.com/hyper-sampling-2.jpg" alt="hypersampling" height="38"/>
  </a>
</p>

Built by [Jiaxin Kou](https://hypersampling.com) · [GitHub](https://github.com/kjx-talesofai)
