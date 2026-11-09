import type { Browser } from "wxt/browser";
import {
	DEFAULT_DISPLAY_MODE,
	type DisplayMode,
	DOUBLE_TAP_MS,
	HISTORY_MAX_RESULTS,
	LAUNCH_COMMAND,
} from "@/lib/config";
import type {
	BackgroundRequest,
	CandidatesResponse,
	UiRequest,
} from "@/lib/messages";
import type { Candidate } from "@/lib/search";
import { displayMode } from "@/lib/settings";
import { type FirefoxThemeColors, themeVarsFromFirefox } from "@/lib/theme";

/** Cached bookmark + history candidates, invalidated when either changes. */
let staticCandidates: Promise<Candidate[]> | undefined;

/** Tabs whose content script has announced it can show the overlay. */
const overlayTabs = new Set<number>();

let mode: DisplayMode = DEFAULT_DISPLAY_MODE;
let lastLaunch = 0;

function invalidateCache() {
	staticCandidates = undefined;
}

function historyCandidate(
	item: Browser.history.HistoryItem,
): Candidate | undefined {
	if (!item.url) return undefined;
	return {
		kind: "history",
		title: item.title || item.url,
		url: item.url,
		lastUsed: item.lastVisitTime,
	};
}

/** Visits are frequent, so patch the cache rather than invalidating it. */
function recordVisit(item: Browser.history.HistoryItem) {
	const visited = historyCandidate(item);
	if (!visited || !staticCandidates) return;
	staticCandidates = staticCandidates.then((list) => [
		visited,
		...list.filter((c) => !(c.kind === "history" && c.url === visited.url)),
	]);
}

function flattenBookmarks(
	nodes: Browser.bookmarks.BookmarkTreeNode[],
	out: Candidate[],
) {
	for (const node of nodes) {
		if (node.url && !node.url.startsWith("place:")) {
			out.push({
				kind: "bookmark",
				title: node.title || node.url,
				url: node.url,
				lastUsed: node.dateAdded,
			});
		}
		if (node.children) flattenBookmarks(node.children, out);
	}
}

async function loadStaticCandidates(): Promise<Candidate[]> {
	const [tree, history] = await Promise.all([
		browser.bookmarks.getTree(),
		browser.history.search({
			text: "",
			startTime: 0,
			maxResults: HISTORY_MAX_RESULTS,
		}),
	]);
	const out: Candidate[] = [];
	flattenBookmarks(tree, out);
	for (const h of history) {
		const c = historyCandidate(h);
		if (c) out.push(c);
	}
	return out;
}

async function loadTabs(): Promise<Candidate[]> {
	const tabs = await browser.tabs.query({});
	return tabs
		.filter((t) => t.url && t.id != null)
		.map((t) => ({
			kind: "tab" as const,
			title: t.title || t.url || "",
			url: t.url ?? "",
			tabId: t.id,
			windowId: t.windowId,
			lastUsed: t.lastAccessed,
		}));
}

async function loadTheme() {
	// `theme` is a Firefox-only API; Chrome falls back to the default palette in CSS.
	if (!import.meta.env.FIREFOX) return {};
	const api = (
		browser as unknown as {
			theme?: {
				getCurrent(): Promise<{ colors?: FirefoxThemeColors | null }>;
			};
		}
	).theme;
	try {
		const theme = await api?.getCurrent();
		return themeVarsFromFirefox(theme?.colors);
	} catch {
		return {};
	}
}

async function getCandidates(): Promise<CandidatesResponse> {
	staticCandidates ??= loadStaticCandidates().catch((err) => {
		staticCandidates = undefined;
		throw err;
	});
	const [tabs, rest, theme] = await Promise.all([
		loadTabs(),
		staticCandidates,
		loadTheme(),
	]);
	return { candidates: [...tabs, ...rest], theme };
}

async function focusTab(tabId: number, windowId?: number) {
	await browser.tabs.update(tabId, { active: true });
	if (windowId != null) {
		await browser.windows.update(windowId, { focused: true });
	}
}

async function activate(candidate: Candidate) {
	if (candidate.kind === "tab" && candidate.tabId != null) {
		await focusTab(candidate.tabId, candidate.windowId);
	} else {
		await browser.tabs.create({ url: candidate.url });
	}
}

async function searchWeb(query: string) {
	if (import.meta.env.FIREFOX) {
		const api = (
			browser as unknown as {
				search: {
					search(props: { query: string; disposition: string }): Promise<void>;
				};
			}
		).search;
		await api.search({ query, disposition: "NEW_TAB" });
	} else {
		await browser.search.query({ text: query, disposition: "NEW_TAB" });
	}
}

/** Tell the UI (overlay in the given tab, and any open popup) to close. */
function closeUi(tabId?: number) {
	const msg: UiRequest = { type: "closeUi" };
	if (tabId != null) browser.tabs.sendMessage(tabId, msg).catch(() => {});
	browser.runtime.sendMessage(msg).catch(() => {});
}

async function switchToPreviousTab(currentTabId?: number) {
	closeUi(currentTabId);
	const tabs = await browser.tabs.query({});
	const [, previous] = tabs.sort(
		(a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
	);
	if (previous?.id != null) await focusTab(previous.id, previous.windowId);
}

function openPopup() {
	const action = browser.action ?? browser.browserAction;
	// Firefox requires this to be called synchronously from the user action (the command handler).
	action.openPopup().catch((err: unknown) => {
		console.warn("BrowserScope: could not open popup", err);
	});
}

function launch(tab?: Browser.tabs.Tab) {
	const now = Date.now();
	const isDoubleTap = now - lastLaunch < DOUBLE_TAP_MS;
	lastLaunch = isDoubleTap ? 0 : now;
	if (isDoubleTap) {
		switchToPreviousTab(tab?.id);
		return;
	}

	const tabId = tab?.id;
	// Firefox loses the user-action context across awaits, so only try the overlay when we know the
	// content script is listening; Chrome can open the popup asynchronously as a fallback.
	if (
		mode === "overlay" &&
		tabId != null &&
		(overlayTabs.has(tabId) || !import.meta.env.FIREFOX)
	) {
		const msg: UiRequest = { type: "toggleOverlay" };
		browser.tabs.sendMessage(tabId, msg).catch(() => {
			overlayTabs.delete(tabId);
			openPopup();
		});
	} else {
		openPopup();
	}
}

export default defineBackground(() => {
	displayMode.getValue().then((value) => {
		mode = value;
	});
	displayMode.watch((value) => {
		mode = value;
	});

	browser.commands.onCommand.addListener((command, tab) => {
		if (command === LAUNCH_COMMAND) launch(tab);
	});

	browser.runtime.onMessage.addListener(
		(message: BackgroundRequest, sender) => {
			switch (message.type) {
				case "getCandidates":
					return getCandidates();
				case "activate":
					return activate(message.candidate);
				case "searchWeb":
					return searchWeb(message.query);
				case "overlayReady":
					if (sender.tab?.id != null) overlayTabs.add(sender.tab.id);
					return;
			}
		},
	);

	browser.tabs.onRemoved.addListener((tabId) => overlayTabs.delete(tabId));
	browser.tabs.onUpdated.addListener((tabId, info) => {
		// Navigation tears down the content script; it re-announces itself when loaded.
		if (info.status === "loading") overlayTabs.delete(tabId);
	});

	browser.bookmarks.onCreated.addListener(invalidateCache);
	browser.bookmarks.onRemoved.addListener(invalidateCache);
	browser.bookmarks.onChanged.addListener(invalidateCache);
	browser.history.onVisited.addListener(recordVisit);
	browser.history.onVisitRemoved.addListener(invalidateCache);
});
