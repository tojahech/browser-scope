import { type Browser, browser } from "wxt/browser";
import { CONFIG } from "../lib/config";
import { firefox } from "../lib/firefox";
import type { Request, Snapshot } from "../lib/messages";
import type { Candidate } from "../lib/search";

export default defineBackground(() => {
	let mru: number[] = [];
	let lastLaunch = 0;
	let launchTab: number | undefined;
	let originWindow: number | undefined;
	let launches = Promise.resolve();
	let fallbackWindow: number | undefined;
	let mutations = Promise.resolve();
	const ready = browser.storage.local.get("mru").then(async (stored) => {
		const tabs = await browser.tabs.query({});
		const alive = new Set(tabs.map((tab) => tab.id));
		mru = (Array.isArray(stored.mru) ? stored.mru : []).filter((id: number) =>
			alive.has(id),
		);
		for (const tab of tabs.sort(
			(a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0),
		)) {
			if (tab.id != null && !mru.includes(tab.id)) mru.push(tab.id);
		}
	});
	function touch(id: number) {
		mutations = mutations
			.then(async () => {
				await ready;
				mru = [id, ...mru.filter((entry) => entry !== id)].slice(
					0,
					CONFIG.mruLimit,
				);
				await browser.storage.local.set({ mru });
			})
			.catch(console.error);
	}
	browser.tabs.onActivated.addListener(({ tabId }) => touch(tabId));
	browser.tabs.onRemoved.addListener((id) => {
		mutations = mutations
			.then(async () => {
				await ready;
				mru = mru.filter((entry) => entry !== id);
				await browser.storage.local.set({ mru });
			})
			.catch(console.error);
	});
	browser.windows.onFocusChanged.addListener(async (windowId) => {
		if (windowId < 0 || windowId === fallbackWindow) return;
		const [tab] = await browser.tabs.query({ active: true, windowId });
		if (tab?.id != null) touch(tab.id);
	});
	browser.windows.onRemoved.addListener((id) => {
		if (id === fallbackWindow) fallbackWindow = undefined;
	});
	async function focusTab(id: number) {
		const tab = await browser.tabs.update(id, { active: true });
		if (!tab) throw new Error("This tab is no longer available.");
		await browser.windows.update(tab.windowId, { focused: true });
	}
	async function launch(quickSwitch: boolean, now: number) {
		await ready;
		await mutations;
		const [active] = await browser.tabs.query({
			active: true,
			lastFocusedWindow: true,
		});
		if (
			quickSwitch &&
			lastLaunch > 0 &&
			now - lastLaunch <= CONFIG.doubleTapMs
		) {
			lastLaunch = 0;
			if (active?.id != null)
				await browser.tabs
					.sendMessage(active.id, { type: "close-finder" })
					.catch(() => {});
			if (fallbackWindow != null)
				await browser.windows.remove(fallbackWindow).catch(() => {});
			const tabs = await browser.tabs.query({});
			const previous = mru.find(
				(id) =>
					id !== launchTab &&
					tabs.some(
						(tab) =>
							tab.id === id &&
							!tab.url?.startsWith(browser.runtime.getURL("/")),
					),
			);
			if (previous != null) await focusTab(previous);
			return;
		}
		lastLaunch = quickSwitch ? now : 0;
		if (active?.windowId !== fallbackWindow) {
			launchTab = active?.id;
			originWindow = active?.windowId;
		}
		if (active?.id != null) {
			try {
				await browser.tabs.sendMessage(active.id, { type: "open-finder" });
				return;
			} catch {
				/* Browser-owned pages cannot host content scripts. */
			}
		}
		if (fallbackWindow != null) {
			await browser.windows.update(fallbackWindow, { focused: true });
			return;
		}
		const parent = await browser.windows.getLastFocused();
		const width = CONFIG.width;
		const height = Math.min(CONFIG.height, parent.height ?? CONFIG.height);
		const popup = await browser.windows.create({
			url: browser.runtime.getURL("/finder.html"),
			type: "popup",
			width,
			height,
			left: Math.round(
				(parent.left ?? 0) + ((parent.width ?? width) - width) / 2,
			),
			top: Math.round(
				(parent.top ?? 0) + ((parent.height ?? height) - height) / 2,
			),
		});
		fallbackWindow = popup?.id;
	}
	function queueLaunch(quickSwitch: boolean) {
		const now = Date.now();
		launches = launches
			.then(() => launch(quickSwitch, now))
			.catch(console.error);
	}
	browser.commands.onCommand.addListener((command) => {
		if (command === CONFIG.command) queueLaunch(true);
	});
	(browser.action ?? browser.browserAction).onClicked.addListener(() =>
		queueLaunch(false),
	);

	async function snapshot(windowId?: number): Promise<Snapshot> {
		await ready;
		await mutations;
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
				const position = mru.indexOf(tab.id);
				candidates.push({
					id: `tab:${tab.id}`,
					source: "tab",
					title: tab.title || tab.url,
					url: tab.url,
					tabId: tab.id,
					windowId: tab.windowId,
					lastAccessed: position < 0 ? 0 : CONFIG.mruLimit - position,
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
						lastAccessed: node.dateAdded ?? 0,
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
						lastAccessed: item.lastVisitTime ?? 0,
					});
			}
		else warnings.push("History is unavailable.");
		const theme: Record<string, string> = {};
		if (import.meta.env.FIREFOX) {
			try {
				const current = await firefox.theme.getCurrent(windowId);
				const colors = current.colors;
				const mapping = {
					"--surface": colors?.popup,
					"--text": colors?.popup_text,
					"--border": colors?.popup_border,
					"--selected": colors?.popup_highlight,
					"--selected-text": colors?.popup_highlight_text,
				};
				for (const [key, value] of Object.entries(mapping))
					if (typeof value === "string") theme[key] = value;
					else if (Array.isArray(value)) theme[key] = `rgb(${value.join(" ")})`;
			} catch {
				/* Default themes do not always expose popup colors. */
			}
		}
		return { candidates, theme, warnings };
	}
	async function targetWindow(
		sender: Browser.runtime.MessageSender,
	): Promise<number | undefined> {
		const desired =
			sender.tab?.windowId === fallbackWindow || !sender.tab
				? originWindow
				: sender.tab.windowId;
		const windows = await browser.windows.getAll({ windowTypes: ["normal"] });
		return (
			windows.find((window) => window.id === desired)?.id ?? windows[0]?.id
		);
	}
	async function handle(
		message: Request,
		sender: Browser.runtime.MessageSender,
	) {
		switch (message.type) {
			case "snapshot":
				return snapshot(sender.tab?.windowId);
			case "activate": {
				const result = message.result;
				if (result.source === "tab" && Number.isInteger(result.tabId))
					await focusTab(result.tabId as number);
				else {
					const url = new URL(result.url);
					if (!["http:", "https:", "ftp:", "file:"].includes(url.protocol))
						throw new Error("This address cannot be opened by BrowserScope.");
					const tab = await browser.tabs.create({
						url: url.href,
						windowId: await targetWindow(sender),
					});
					if (tab.id != null) await focusTab(tab.id);
				}
				return;
			}
			case "search": {
				if (!message.query.trim()) return;
				const tab = await browser.tabs.create({
					windowId: await targetWindow(sender),
				});
				if (tab.id == null) throw new Error("Could not open a search tab.");
				if (import.meta.env.FIREFOX)
					await firefox.search.search({ query: message.query, tabId: tab.id });
				else await browser.search.query({ text: message.query, tabId: tab.id });
				await focusTab(tab.id);
				return;
			}
		}
	}
	browser.runtime.onMessage.addListener((message: Request, sender) => {
		if (
			sender.id !== browser.runtime.id ||
			!["snapshot", "activate", "search"].includes(message?.type)
		)
			return;
		return handle(message, sender).then(
			(value) => ({ ok: true, value }),
			(error: unknown) => ({
				ok: false,
				error:
					error instanceof Error
						? error.message
						: "The browser could not complete this action.",
			}),
		);
	});
});
