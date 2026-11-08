import { browser } from "wxt/browser";
import { activateTarget, searchWeb } from "../lib/actions";
import { CONFIG } from "../lib/config";
import { createLauncher } from "../lib/launcher";
import { dispatch, isRequest } from "../lib/messages";
import { createMruStore } from "../lib/mru";
import { loadCandidates } from "../lib/sources";
import { loadTheme } from "../lib/theme";

export default defineBackground(() => {
	const mru = createMruStore();
	const launcher = createLauncher(mru);
	browser.tabs.onActivated.addListener(({ tabId }) => {
		void mru.touch(tabId);
	});
	browser.tabs.onRemoved.addListener((id) => {
		void mru.remove(id);
	});
	browser.windows.onFocusChanged.addListener((windowId) => {
		if (windowId < 0 || launcher.isFallback(windowId)) return;
		void browser.tabs
			.query({ active: true, windowId })
			.then(([tab]) => {
				if (tab?.id != null) return mru.touch(tab.id);
			})
			.catch(console.error);
	});
	browser.windows.onRemoved.addListener(launcher.windowRemoved);
	browser.commands.onCommand.addListener((command) => {
		if (command === CONFIG.command) launcher.launch(true);
	});
	(browser.action ?? browser.browserAction).onClicked.addListener(() =>
		launcher.launch(false),
	);
	browser.runtime.onMessage.addListener((message: unknown, sender) => {
		if (sender.id !== browser.runtime.id) return;
		if (!isRequest(message)) return;
		const windowId = sender.tab?.windowId;
		const preferredWindow =
			windowId === undefined || launcher.isFallback(windowId)
				? launcher.originWindow()
				: windowId;
		return dispatch(message, {
			async snapshot() {
				const [sources, theme] = await Promise.all([
					loadCandidates(await mru.read()),
					loadTheme(windowId),
				]);
				return { ...sources, theme };
			},
			async activate({ target }) {
				await activateTarget(target, preferredWindow);
			},
			async search({ query }) {
				await searchWeb(query, preferredWindow);
			},
		});
	});
});
