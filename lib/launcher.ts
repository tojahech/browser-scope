import { browser } from "wxt/browser";
import { focusTab } from "./actions";
import { CONFIG } from "./config";
import type { MruStore } from "./mru";

export function createLauncher(mru: MruStore) {
	let lastLaunch = 0;
	let launchTab: number | undefined;
	let originWindow: number | undefined;
	let fallbackWindow: number | undefined;
	let launches = Promise.resolve();
	async function launch(quickSwitch: boolean, now: number) {
		const recent = await mru.read();
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
			const previous = recent.find(
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

	return {
		launch: queueLaunch,
		isFallback: (id: number) => id === fallbackWindow,
		originWindow: () => originWindow,
		windowRemoved(id: number) {
			if (id === fallbackWindow) fallbackWindow = undefined;
		},
	};
}
