/**
 * Theme Workbench — host half.
 *
 * The feature is browser-side, but the Host owns the one thing the browser
 * cannot own for itself: the durable choice. `Config` below is the plugin's
 * settings schema, and `dsh-settings` derives its namespace from this row's
 * Loader id (`theme-workbench`), so the field is reachable from the page as
 * `ctx.configForms.get('theme-workbench')` and lands in the profile's
 * `cordis.patch.yml` next to every other Host-backed preference.
 *
 * `.volatile()` is required, not decorative: only volatile fields are exposed
 * to the page's settings scope and accepted on write. Without it the schema
 * has no volatile field and the namespace does not appear at all.
 *
 * `webserver/index-inject` is the second job. Listeners push their rows on
 * every index render, so the row below always carries the *current* value. The
 * page applies it synchronously, which is what keeps the first applied theme
 * the chosen one instead of the schema default followed by a visible repaint
 * once the settings scope finishes loading.
 *
 * @module dsh-plugin-theme-workbench
 */

import z from '@deepseek-ai/schemastery'

/**
 * Every theme id the browser half ships a palette for, in picker order.
 *
 * Deliberately duplicated in `client.js`, which cannot import this module (a
 * client bundle may only require the loader's seed modules). The test suite
 * reads both files and asserts the two lists agree, so the copy cannot drift.
 */
export const THEME_IDS = Object.freeze([
  'modern-classic',
  'novel',
  'calm',
  'deep-work',
  'cream',
])

/** Theme applied when the profile carries no explicit choice. */
export const DEFAULT_THEME = 'cream'

/**
 * Global the page reads before the shell mounts.
 *
 * Written as an `index-inject` `global` row (a property assignment, not an
 * inline script), so it exists before the first application script runs.
 */
export const BOOT_GLOBAL = '__DSH_THEME_WORKBENCH__'

/**
 * Live theme preference.
 *
 * The union is what rejects a typo'd theme id at the settings boundary, and it
 * is also what renders the field as a picker wherever DSH projects this
 * schema. `volatile()` marks it page-writable.
 */
export const Config = z.object({
  theme: z.union([...THEME_IDS]).default(DEFAULT_THEME).volatile(),
})

/**
 * Publish the persisted theme id into every index render.
 *
 * @param ctx - Host plugin context.
 * @param config - Validated live settings for this row.
 */
export function apply(ctx, config) {
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: BOOT_GLOBAL, value: config.theme.get() })
  })
}
