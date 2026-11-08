import { type Browser, browser } from "wxt/browser";
import { CONFIG } from "./config";
import type { Candidate } from "./types";
export async function loadCandidates(
	recent: readonly number[],
): Promise<{ candidates: Candidate[]; warnings: string[] }> {
	const sources = await Promise.allSettled([
		browser.tabs.query({}),
		browser.bookmarks.getTree(),
		browser.history.search({
			text: "",
			startTime: 0,
			maxResults: CONFIG.historyLimit,
		}),
	]);
	const candidates: Candidate[] = [];
	const warnings: string[] = [];
	const [tabs, bookmarks, history] = sources;
	if (tabs.status === "fulfilled")
		for (const tab of tabs.value) {
			if (
				tab.id == null ||
				!tab.url ||
				tab.url.startsWith(browser.runtime.getURL("/"))
			)
				continue;
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
	else warnings.push("Open tabs are unavailable.");
	function walk(nodes: Browser.bookmarks.BookmarkTreeNode[]) {
		for (const node of nodes) {
			if (node.url)
				candidates.push({
					id: `bookmark:${node.id}`,
					source: "bookmark",
					title: node.title || node.url,
					url: node.url,
					dateAdded: node.dateAdded ?? 0,
				});
			if (node.children) walk(node.children);
		}
	}
	if (bookmarks.status === "fulfilled") walk(bookmarks.value);
	else warnings.push("Bookmarks are unavailable.");
	if (history.status === "fulfilled")
		for (const item of history.value) {
			if (item.url)
				candidates.push({
					id: `history:${item.id}`,
					source: "history",
					title: item.title || item.url,
					url: item.url,
					lastVisited: item.lastVisitTime ?? 0,
				});
		}
	else warnings.push("History is unavailable.");

	return { candidates, warnings };
}
