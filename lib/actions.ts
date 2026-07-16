/**
 * Actions the popup performs on a chosen result. Each caller is responsible
 * for closing the popup afterwards.
 */
import { browser } from "wxt/browser";
import type { Candidate } from "./types";

/** Switch to an open tab, or open a bookmark/history entry in a new tab. */
export async function activateResult(result: Candidate): Promise<void> {
	if (result.type === "tab" && result.tabId !== undefined) {
		await browser.tabs.update(result.tabId, { active: true });
		if (result.windowId !== undefined) {
			await browser.windows.update(result.windowId, { focused: true });
		}
	} else {
		await browser.tabs.create({ url: result.url, active: true });
	}
}

/** Alt-Tab style MRU switch: activate the most recently used non-current tab. */
export async function switchToPreviousTab(): Promise<boolean> {
	const [allTabs, [currentTab]] = await Promise.all([
		browser.tabs.query({}),
		browser.tabs.query({ active: true, currentWindow: true }),
	]);
	const previous = allTabs
		.filter((t) => t.id !== undefined && t.id !== currentTab?.id)
		.sort(
			(a, b) =>
				((b as { lastAccessed?: number }).lastAccessed ?? 0) -
				((a as { lastAccessed?: number }).lastAccessed ?? 0),
		)[0];
	if (previous?.id === undefined) return false;
	await browser.tabs.update(previous.id, { active: true });
	if (
		previous.windowId !== undefined &&
		previous.windowId !== currentTab?.windowId
	) {
		await browser.windows.update(previous.windowId, { focused: true });
	}
	return true;
}

interface SearchApi {
	query?: (info: { text: string; disposition: "NEW_TAB" }) => Promise<void>;
	search?: (info: { query: string }) => Promise<void>;
}

/**
 * Search the raw query with the browser's default engine in a new foreground
 * tab. Must be called from a user input handler (Firefox requirement).
 */
export async function openWebSearch(query: string): Promise<void> {
	const search = (browser as unknown as { search?: SearchApi }).search;
	if (search?.query) {
		await search.query({ text: query, disposition: "NEW_TAB" });
	} else if (search?.search) {
		// Older Firefox fallback; opens in a new tab by default.
		await search.search({ query });
	}
}
