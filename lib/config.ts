/**
 * All global constants for BrowserScope live in this file.
 */
export const CONFIG = {
	/** How many days of browsing history to include as search candidates. */
	HISTORY_WINDOW_DAYS: 30,

	/** Upper bound on history entries fetched from the browser. */
	HISTORY_MAX_RESULTS: 2000,

	/** Rows visible without scrolling; the list scrolls with the selection beyond this. */
	MAX_VISIBLE_RESULTS: 10,

	/** Hard cap on result rows rendered per query. */
	MAX_RENDERED_RESULTS: 50,

	/**
	 * A second press of the launch shortcut within this window (ms) switches
	 * straight to the previously active tab instead of keeping the popup open.
	 */
	DOUBLE_TAP_MS: 400,

	/** Height of one result row, in px. Used to size the scrolling list. */
	RESULT_ROW_HEIGHT: 32,

	/** Width of the popup, in px. */
	POPUP_WIDTH: 560,
} as const;

/**
 * Ranking tiers: open tabs rank above bookmarks, which rank above history.
 * Source weight always dominates match quality.
 */
export const SOURCE_WEIGHT = {
	tab: 2,
	bookmark: 1,
	history: 0,
} as const;
