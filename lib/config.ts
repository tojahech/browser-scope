/** Global constants. Everything tunable lives here. */

import type { Source } from "./types";

/** Score multiplier per source; open tabs outrank bookmarks outrank history. */
export const SOURCE_WEIGHTS: Record<Source, number> = {
	tab: 1,
	bookmark: 0.85,
	history: 0.7,
};

/** Multiplier applied when a query term matched the URL rather than the title. */
export const URL_MATCH_WEIGHT = 0.9;

/** Two launch presses within this window (ms) count as a double tap (quick switch). */
export const DOUBLE_TAP_MS = 400;

/**
 * Maximum number of history entries loaded as search candidates. Every candidate is sent to the UI
 * when it opens, so this bounds both the message size and the per-keystroke ranking cost.
 */
export const HISTORY_MAX_RESULTS = 2000;

/** Maximum number of rows rendered in the results list. */
export const MAX_RESULTS = 100;

/** Delay (ms) between the last keystroke and re-ranking. Enter flushes it immediately. */
export const SEARCH_DEBOUNCE_MS = 35;

/** Upper bound on remembered tab IDs in the most-recently-used list. */
export const MRU_LIMIT = 500;

/** Name of the launch command in the manifest. */
export const LAUNCH_COMMAND = "launch";

/** Default launch shortcut (users can rebind it in the options page or browser settings). */
export const DEFAULT_LAUNCH_SHORTCUT = "Ctrl+Space";
/** On macOS, `MacCtrl` is the literal Control key (plain `Ctrl` would mean Command). */
export const DEFAULT_LAUNCH_SHORTCUT_MAC = "MacCtrl+Space";

/** URL schemes the finder may open in a new tab. Anything else is refused. */
export const OPENABLE_PROTOCOLS = ["http:", "https:", "ftp:", "file:"];

/** Where the finder UI is shown. */
export type DisplayMode = "overlay" | "popup";
export const DEFAULT_DISPLAY_MODE: DisplayMode = "overlay";

/** Overlay dimensions. */
export const OVERLAY_WIDTH_PX = 600;
export const OVERLAY_HEIGHT_VH = 80;

/** Browser action popup dimensions (browsers cap popups at roughly 800x600). */
export const POPUP_WIDTH_PX = 600;
export const POPUP_HEIGHT_PX = 560;

/** z-index of the in-page overlay. */
export const OVERLAY_Z_INDEX = 2147483647;
