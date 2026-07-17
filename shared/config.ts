/** Centralised tuning values for BrowserScope. */
export const CONFIG = {
	DOUBLE_TAP_THRESHOLD_MS: 550,
	HISTORY_WINDOW_DAYS: 30,
	MAX_HISTORY_RESULTS: 750,
	MAX_SEARCH_RESULTS: 100,
	MAX_VISIBLE_RESULTS: 10,
	SEARCH_CACHE_TTL_MS: 2_000,
} as const;

export const SOURCE_PRIORITY = {
	tab: 0,
	bookmark: 1,
	history: 2,
} as const;
