/** Global constants. Everything tunable lives here. */

export type SourceKind = "tab" | "bookmark" | "history";

/** Score multiplier per source; open tabs outrank bookmarks outrank history. */
export const SOURCE_WEIGHTS: Record<SourceKind, number> = {
	tab: 1,
	bookmark: 0.85,
	history: 0.7,
};

/** Priority used to pick a single entry when the same URL appears in several sources. */
export const SOURCE_PRIORITY: SourceKind[] = ["tab", "bookmark", "history"];

/** Multiplier applied when a term matched the URL rather than the title. */
export const URL_MATCH_WEIGHT = 0.9;

/** Two launch presses within this window count as a double tap (quick switch). */
export const DOUBLE_TAP_MS = 400;

/** Maximum number of history entries loaded as search candidates. */
export const HISTORY_MAX_RESULTS = 2000;

/** Maximum number of rows rendered in the results list. */
export const MAX_RESULTS = 100;

/** Name of the launch command in the manifest. */
export const LAUNCH_COMMAND = "launch";

/** Default launch shortcut (users can rebind it via the browser's shortcut settings). */
export const DEFAULT_LAUNCH_SHORTCUT = "Ctrl+Space";
export const DEFAULT_LAUNCH_SHORTCUT_MAC = "MacCtrl+Space";

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
