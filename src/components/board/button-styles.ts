/**
 * The board's button strings (spec §4.4), in one place so the answer form, the
 * action bar and the manage dialogs cannot drift apart.
 *
 * There are no `dark:` variants here on purpose: `src/styles.css` re-points the
 * whole `stone` and `red` scale under `.dark`, so `bg-stone-900 text-white`
 * already reads as a near-white pill with dark text in dark mode. A `dark:`
 * override would invert the colour a second time and undo it.
 */

/** Primary action: a black pill. The accent colour is reserved for state. */
export const PRIMARY_BUTTON =
  "fade h-auto cursor-pointer rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800 hover:text-white";

/** Secondary action: the idle pill style, same geometry, quiet colours. */
export const SECONDARY_BUTTON =
  "fade h-auto cursor-pointer rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700";

/** A destructive action that has been armed and waits for the second click. */
export const ARMED_BUTTON =
  "border-red-300 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:text-red-700";
