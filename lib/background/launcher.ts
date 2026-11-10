/**
 * Handles the launch shortcut: opens the finder in the page or the toolbar popup, and turns a
 * double tap into a switch to the previously used tab.
 *
 * Firefox only allows `openPopup()` while handling the user's key press, and loses that permission
 * across an `await`. So `launch` decides synchronously, using a registry of tabs whose content
 * script has announced it can show the overlay, and opens the popup directly when it can't.
 */

import { type Browser, browser } from "wxt/browser";
import { type DisplayMode, DOUBLE_TAP_MS } from "../config";
import type { UiMessage } from "../messages";
import { focusTab } from "./actions";
import type { MruStore } from "./mru";

interface LauncherOptions {
	mru: MruStore;
	displayMode: () => DisplayMode;
	now?: () => number;
}

export type Launcher = ReturnType<typeof createLauncher>;

export function createLauncher({
	mru,
	displayMode,
	now = () => Date.now(),
}: LauncherOptions) {
	/** Tabs whose content script is listening and can show the overlay. */
	const overlayTabs = new Set<number>();
	let lastLaunch = 0;

	function openPopup() {
		const action = browser.action ?? browser.browserAction;
		action.openPopup().catch((error: unknown) => {
			console.warn("BrowserScope: could not open the popup", error);
		});
	}

	/** Close the finder wherever it is: the overlay in this tab, or an open popup. */
	function closeUi(tabId?: number) {
		const message: UiMessage = { type: "closeUi" };
		if (tabId != null) browser.tabs.sendMessage(tabId, message).catch(() => {});
		browser.runtime.sendMessage(message).catch(() => {});
	}

	async function switchToPrevious(currentTabId?: number) {
		const recent = await mru.read();
		const current = currentTabId ?? recent[0];
		for (const id of recent) {
			if (id === current) continue;
			try {
				return await focusTab(id);
			} catch {
				// Closed since we last heard about it; try the next one.
				void mru.remove(id);
			}
		}
	}

	function showOverlay(tabId: number) {
		const message: UiMessage = { type: "toggleOverlay" };
		browser.tabs.sendMessage(tabId, message).catch(() => {
			overlayTabs.delete(tabId);
			openPopup();
		});
	}

	return {
		/** Must be called synchronously from the command listener; see the note at the top. */
		launch(tab?: Browser.tabs.Tab) {
			const time = now();
			const isDoubleTap = time - lastLaunch < DOUBLE_TAP_MS;
			lastLaunch = isDoubleTap ? 0 : time;

			if (isDoubleTap) {
				closeUi(tab?.id);
				switchToPrevious(tab?.id).catch(console.error);
				return;
			}

			const tabId = tab?.id;
			// Chrome can open the popup after an await, so it may try any tab and fall back on failure.
			const canTryOverlay =
				tabId != null && (overlayTabs.has(tabId) || !import.meta.env.FIREFOX);
			if (displayMode() === "overlay" && canTryOverlay) showOverlay(tabId);
			else openPopup();
		},

		overlayReady(tabId: number) {
			overlayTabs.add(tabId);
		},

		/** The tab closed or navigated, taking its content script with it. */
		forgetTab(tabId: number) {
			overlayTabs.delete(tabId);
		},
	};
}
