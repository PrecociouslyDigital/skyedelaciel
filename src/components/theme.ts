/**
 * The reader's choice of scheme: a checkbox that flips the scheme the system
 * asks for, and the choice kept between pages. Shell.astro's pre-paint script
 * and ThemeToggle.astro both read these; colors.scss names the checkbox by
 * its id as well.
 */

/** Where the choice is kept, in `localStorage`, as JSON `true` or `false`. */
export const THEME_KEY = "theme-override";

/** The checkbox's id. */
export const THEME_TOGGLE_ID = "theme-toggle";
