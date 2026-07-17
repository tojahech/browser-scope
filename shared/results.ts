import { CONFIG } from "./config";
import {
	type ResultSource,
	rankRecentTabs,
	rankSearchResults,
	type SearchCandidate,
	type SearchResult,
} from "./search";

interface BookmarkNode {
	id: string;
	title: string;
	url?: string;
}

interface HistoryItem {
	id?: string;
	title?: string;
	url?: string;
}

interface RecentTabMessage {
	type: "get-tab-mru";
}

let cachedStaticCandidates: SearchCandidate[] = [];
let staticCandidatesExpireAt = 0;

function toCandidate(
	source: ResultSource,
	item: {
		id?: string | number;
		title?: string;
		url?: string;
		tabId?: number;
		windowId?: number;
	},
	mruRank?: number,
): SearchCandidate | null {
	if (!item.url) return null;
	return {
		id: item.id?.toString(),
		mruRank,
		source,
		tabId: item.tabId,
		title: item.title?.trim() || item.url,
		url: item.url,
		windowId: item.windowId,
	};
}

async function getRecentTabIds(): Promise<number[]> {
	try {
		return (await browser.runtime.sendMessage({
			type: "get-tab-mru",
		} satisfies RecentTabMessage)) as number[];
	} catch {
		return [];
	}
}

async function getTabs(): Promise<SearchCandidate[]> {
	const [tabs, recentTabIds] = await Promise.all([
		browser.tabs.query({}),
		getRecentTabIds(),
	]);
	const mruRanks = new Map(recentTabIds.map((tabId, index) => [tabId, index]));

	return tabs
		.map((tab) =>
			toCandidate(
				"tab",
				{
					id: tab.id,
					tabId: tab.id,
					title: tab.title,
					url: tab.url,
					windowId: tab.windowId,
				},
				mruRanks.get(tab.id ?? -1),
			),
		)
		.filter((candidate): candidate is SearchCandidate => candidate !== null);
}

async function getStaticCandidates(): Promise<SearchCandidate[]> {
	if (Date.now() < staticCandidatesExpireAt) return cachedStaticCandidates;

	const startTime =
		Date.now() - CONFIG.HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	const [bookmarks, history] = await Promise.all([
		browser.bookmarks.search({}),
		browser.history.search({
			maxResults: CONFIG.MAX_HISTORY_RESULTS,
			startTime,
			text: "",
		}),
	]);

	cachedStaticCandidates = [
		...(bookmarks as BookmarkNode[])
			.map((bookmark) => toCandidate("bookmark", bookmark))
			.filter((candidate): candidate is SearchCandidate => candidate !== null),
		...(history as HistoryItem[])
			.map((item) => toCandidate("history", item))
			.filter((candidate): candidate is SearchCandidate => candidate !== null),
	];
	staticCandidatesExpireAt = Date.now() + CONFIG.SEARCH_CACHE_TTL_MS;
	return cachedStaticCandidates;
}

async function getSearchCandidates(): Promise<SearchCandidate[]> {
	const [tabs, staticCandidates] = await Promise.all([
		getTabs(),
		getStaticCandidates(),
	]);
	return [...tabs, ...staticCandidates];
}

export async function findResults(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return rankRecentTabs(await getTabs());
	return rankSearchResults(await getSearchCandidates(), query.trim());
}

export async function activateResult(result: SearchResult) {
	if (result.source === "tab" && result.tabId !== undefined) {
		await browser.tabs.update(result.tabId, { active: true });
		if (result.windowId !== undefined)
			await browser.windows.update(result.windowId, { focused: true });
	} else {
		await browser.tabs.create({ active: true, url: result.url });
	}
	window.close();
}

/** Invoke the browser search API so Firefox uses the user's selected engine. */
export async function searchWithDefaultEngine(query: string) {
	if (!query.trim()) return;
	const search = (
		browser as unknown as {
			search?: {
				query: (details: {
					disposition: "NEW_TAB";
					text: string;
				}) => Promise<void>;
			};
		}
	).search;
	if (!search) return;
	await search.query({ disposition: "NEW_TAB", text: query });
	window.close();
}
