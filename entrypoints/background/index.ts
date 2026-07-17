import { CONFIG } from "../../shared/config";
import { COMMANDS } from "../../shared/keybindings";

let lastLaunchAt = 0;
let popupIsOpen = false;
let recentTabIds: number[] = [];

function rememberTab(tabId: number) {
	recentTabIds = [tabId, ...recentTabIds.filter((id) => id !== tabId)];
}

async function initialiseRecentTabs() {
	const tabs = await browser.tabs.query({});
	recentTabIds = tabs
		.filter((tab): tab is typeof tab & { id: number } => tab.id !== undefined)
		.sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))
		.map((tab) => tab.id);
}

async function activatePreviousTab() {
	const [activeTab] = await browser.tabs.query({
		active: true,
		lastFocusedWindow: true,
	});
	if (!activeTab?.id) return;
	rememberTab(activeTab.id);
	const previousTabId = recentTabIds.find((tabId) => tabId !== activeTab.id);
	if (previousTabId === undefined) return;

	try {
		const previousTab = await browser.tabs.get(previousTabId);
		await browser.tabs.update(previousTabId, { active: true });
		await browser.windows.update(previousTab.windowId, { focused: true });
	} catch {
		recentTabIds = recentTabIds.filter((tabId) => tabId !== previousTabId);
	}
}

async function openPopup() {
	const extension = browser as unknown as {
		action?: { openPopup: () => Promise<void> };
		browserAction?: { openPopup: () => Promise<void> };
	};
	const action = extension.action ?? extension.browserAction;
	if (!action) throw new Error("Toolbar action API is unavailable");
	await action.openPopup();
}

export default defineBackground(() => {
	void initialiseRecentTabs();

	browser.tabs.onActivated.addListener(({ tabId }) => rememberTab(tabId));
	browser.tabs.onRemoved.addListener((tabId) => {
		recentTabIds = recentTabIds.filter((id) => id !== tabId);
	});

	browser.runtime.onMessage.addListener((message: { type?: string }) => {
		if (message.type === "get-tab-mru") return Promise.resolve(recentTabIds);
		if (message.type === "popup-opened") popupIsOpen = true;
		if (message.type === "popup-closed") popupIsOpen = false;
	});

	browser.commands.onCommand.addListener(async (command) => {
		if (command !== COMMANDS.LAUNCH) return;
		const now = Date.now();
		const isDoubleTap =
			popupIsOpen && now - lastLaunchAt <= CONFIG.DOUBLE_TAP_THRESHOLD_MS;
		lastLaunchAt = now;

		if (isDoubleTap) {
			popupIsOpen = false;
			void browser.runtime
				.sendMessage({ type: "close-popup" })
				.catch(() => undefined);
			await activatePreviousTab();
			return;
		}

		popupIsOpen = true;
		try {
			await openPopup();
		} catch {
			popupIsOpen = false;
			// The browser can decline to show a toolbar popup (for example, when the
			// command is changed to an unsupported shortcut). The command remains
			// configurable in the browser's built-in extension-shortcuts UI.
		}
	});
});
