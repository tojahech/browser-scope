/**
 * Loads search candidates from tabs, bookmarks and history.
 *
 * Tabs change constantly and are cheap to query, so they're read fresh each time. Bookmarks and
 * history are cached and kept current from browser events. A source that fails to load is reported
 * as a warning and retried next time, without hiding the sources that did load.
 */

import { type Browser, browser } from "wxt/browser";
import { HISTORY_MAX_RESULTS } from "../config";
import type { Candidate } from "../types";

type HistoryCandidate = Extract<Candidate, { source: "history" }>;

export type Sources = ReturnType<typeof createSources>;

function isOwnPage(url: string) {
	return url.startsWith(browser.runtime.getURL("/"));
}

function tabCandidates(
	tabs: Browser.tabs.Tab[],
	recent: readonly number[],
): Candidate[] {
	const candidates: Candidate[] = [];
	for (const tab of tabs) {
		if (tab.id == null || !tab.url || isOwnPage(tab.url)) continue;
		const position = recent.indexOf(tab.id);
		candidates.push({
			id: `tab:${tab.id}`,
			source: "tab",
			title: tab.title || tab.url,
			url: tab.url,
			tabId: tab.id,
			windowId: tab.windowId,
			mruRank: position < 0 ? Number.MAX_SAFE_INTEGER : position,
		});
	}
	return candidates;
}

function bookmarkCandidates(
	nodes: Browser.bookmarks.BookmarkTreeNode[],
	out: Candidate[] = [],
): Candidate[] {
	for (const node of nodes) {
		// Firefox smart bookmarks (`place:` queries) aren't pages.
		if (node.url && !node.url.startsWith("place:")) {
			out.push({
				id: `bookmark:${node.id}`,
				source: "bookmark",
				title: node.title || node.url,
				url: node.url,
				dateAdded: node.dateAdded ?? 0,
			});
		}
		if (node.children) bookmarkCandidates(node.children, out);
	}
	return out;
}

function historyCandidate(
	item: Browser.history.HistoryItem,
): HistoryCandidate | undefined {
	if (!item.url) return undefined;
	return {
		id: `history:${item.id}`,
		source: "history",
		title: item.title || item.url,
		url: item.url,
		lastVisited: item.lastVisitTime ?? 0,
	};
}

/** A lazily loaded value that forgets a failed load, so the next read retries. */
function cached<T>(load: () => Promise<T>) {
	let value: Promise<T> | undefined;
	return {
		get() {
			value ??= load().catch((error) => {
				value = undefined;
				throw error;
			});
			return value;
		},
		/** Apply an update to the cached value, if one is loaded. */
		patch(update: (current: T) => T) {
			value = value?.then(update);
		},
		invalidate() {
			value = undefined;
		},
	};
}

export function createSources() {
	const bookmarks = cached(async () =>
		bookmarkCandidates(await browser.bookmarks.getTree()),
	);
	const history = cached(async () => {
		const items = await browser.history.search({
			text: "",
			startTime: 0,
			maxResults: HISTORY_MAX_RESULTS,
		});
		return items.flatMap((item) => historyCandidate(item) ?? []);
	});

	return {
		async load(
			recent: readonly number[],
		): Promise<{ candidates: Candidate[]; warnings: string[] }> {
			const [tabs, saved, visited] = await Promise.allSettled([
				browser.tabs.query({}),
				bookmarks.get(),
				history.get(),
			]);
			const candidates: Candidate[] = [];
			const warnings: string[] = [];

			if (tabs.status === "fulfilled") {
				candidates.push(...tabCandidates(tabs.value, recent));
			} else warnings.push("Open tabs are unavailable.");

			if (saved.status === "fulfilled") candidates.push(...saved.value);
			else warnings.push("Bookmarks are unavailable.");

			if (visited.status === "fulfilled") candidates.push(...visited.value);
			else warnings.push("History is unavailable.");

			return { candidates, warnings };
		},

		bookmarksChanged: bookmarks.invalidate,

		/** Visits are frequent, so patch the cache rather than reloading it. */
		visited(item: Browser.history.HistoryItem) {
			const visit = historyCandidate(item);
			if (!visit) return;
			history.patch((list) =>
				[visit, ...list.filter((c) => c.url !== visit.url)].slice(
					0,
					HISTORY_MAX_RESULTS,
				),
			);
		},

		/** Firefox reports a page's title after the visit; Chrome includes it on the next visit. */
		titleChanged(url: string, title: string) {
			history.patch((list) =>
				list.map((c) => (c.url === url && title ? { ...c, title } : c)),
			);
		},

		visitsRemoved: history.invalidate,
	};
}
