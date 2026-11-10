import { browser } from "wxt/browser";
import { activateTarget, searchWeb } from "@/lib/background/actions";
import { createLauncher } from "@/lib/background/launcher";
import { createMruStore } from "@/lib/background/mru";
import { createSources } from "@/lib/background/sources";
import { loadTheme } from "@/lib/background/theme";
import { firefox } from "@/lib/browser-compat";
import {
	DEFAULT_DISPLAY_MODE,
	type DisplayMode,
	LAUNCH_COMMAND,
} from "@/lib/config";
import { dispatch, isRequest } from "@/lib/messages";
import { displayMode } from "@/lib/settings";

/** Wiring only: create the stores, connect browser events to them, and answer UI requests. */
export default defineBackground(() => {
	const mru = createMruStore();
	const sources = createSources();

	let mode: DisplayMode = DEFAULT_DISPLAY_MODE;
	displayMode.getValue().then((value) => {
		mode = value;
	});
	displayMode.watch((value) => {
		mode = value;
	});

	const launcher = createLauncher({ mru, displayMode: () => mode });

	browser.commands.onCommand.addListener((command, tab) => {
		if (command === LAUNCH_COMMAND) launcher.launch(tab);
	});

	browser.tabs.onActivated.addListener(({ tabId }) => {
		void mru.touch(tabId);
	});
	browser.tabs.onRemoved.addListener((tabId) => {
		void mru.remove(tabId);
		launcher.forgetTab(tabId);
	});
	browser.tabs.onUpdated.addListener((tabId, info) => {
		// Navigation tears down the content script; it re-announces itself when loaded.
		if (info.status === "loading") launcher.forgetTab(tabId);
	});
	// Switching windows doesn't fire onActivated, but does change which tab the user is looking at.
	browser.windows.onFocusChanged.addListener((windowId) => {
		if (windowId === browser.windows.WINDOW_ID_NONE) return;
		browser.tabs
			.query({ active: true, windowId })
			.then(([tab]) => {
				if (tab?.id != null) return mru.touch(tab.id);
			})
			.catch(console.error);
	});

	browser.bookmarks.onCreated.addListener(sources.bookmarksChanged);
	browser.bookmarks.onRemoved.addListener(sources.bookmarksChanged);
	browser.bookmarks.onChanged.addListener(sources.bookmarksChanged);
	browser.history.onVisited.addListener(sources.visited);
	browser.history.onVisitRemoved.addListener(sources.visitsRemoved);
	firefox.history.onTitleChanged?.addListener(({ url, title }) =>
		sources.titleChanged(url, title),
	);

	browser.runtime.onMessage.addListener((message: unknown, sender, reply) => {
		// Only our own pages and content scripts may drive the background.
		if (sender.id !== browser.runtime.id || !isRequest(message)) return;
		dispatch(message, sender, {
			async snapshot(_, { tab }) {
				const [loaded, theme] = await Promise.all([
					sources.load(await mru.read()),
					loadTheme(tab?.windowId),
				]);
				return { ...loaded, theme };
			},
			async activate({ target }, { tab }) {
				await activateTarget(target, tab?.windowId);
			},
			async searchWeb({ query }) {
				await searchWeb(query);
			},
			async overlayReady(_, { tab }) {
				if (tab?.id != null) launcher.overlayReady(tab.id);
			},
		}).then(reply);
		// Reply through the callback: older Chrome versions ignore a returned promise.
		return true;
	});
});
