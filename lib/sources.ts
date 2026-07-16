/**
 * Loads search candidates from the three sources: open tabs (all windows),
 * bookmarks, and recent history.
 */
import { browser } from "wxt/browser";
import { CONFIG } from "./config";
import type { Candidate } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function loadCandidates(): Promise<Candidate[]> {
	const [tabs, bookmarks, history] = await Promise.all([
		loadTabs(),
		loadBookmarks(),
		loadHistory(),
	]);
	return [...tabs, ...bookmarks, ...history];
}

async function loadTabs(): Promise<Candidate[]> {
	const [allTabs, [currentTab]] = await Promise.all([
		browser.tabs.query({}),
		browser.tabs.query({ active: true, currentWindow: true }),
	]);
	const candidates: Candidate[] = [];
	for (const tab of allTabs) {
		if (tab.id === undefined || !tab.url) continue;
		candidates.push({
			type: "tab",
			title: tab.title || tab.url,
			url: tab.url,
			tabId: tab.id,
			windowId: tab.windowId,
			lastAccessed: (tab as { lastAccessed?: number }).lastAccessed,
			isCurrentTab: tab.id === currentTab?.id,
		});
	}
	return candidates;
}

async function loadBookmarks(): Promise<Candidate[]> {
	const tree = await browser.bookmarks.getTree();
	const candidates: Candidate[] = [];
	const stack = [...tree];
	while (stack.length > 0) {
		const node = stack.pop();
		if (node === undefined) break;
		if (node.url) {
			candidates.push({
				type: "bookmark",
				title: node.title || node.url,
				url: node.url,
			});
		}
		if (node.children) stack.push(...node.children);
	}
	return candidates;
}

async function loadHistory(): Promise<Candidate[]> {
	const items = await browser.history.search({
		text: "",
		startTime: Date.now() - CONFIG.HISTORY_WINDOW_DAYS * DAY_MS,
		maxResults: CONFIG.HISTORY_MAX_RESULTS,
	});
	const candidates: Candidate[] = [];
	for (const item of items) {
		if (!item.url) continue;
		candidates.push({
			type: "history",
			title: item.title || item.url,
			url: item.url,
		});
	}
	return candidates;
}
