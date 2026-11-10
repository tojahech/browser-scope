/** What happens when the user picks a result or searches the web. */

import { browser } from "wxt/browser";
import { firefox } from "../browser-compat";
import { OPENABLE_PROTOCOLS } from "../config";
import type { ActivationTarget } from "../types";

/** Make a tab active and bring its window to the front. */
export async function focusTab(tabId: number): Promise<void> {
	const tab = await browser.tabs.update(tabId, { active: true });
	if (!tab) throw new Error("This tab is no longer available.");
	await browser.windows.update(tab.windowId, { focused: true });
}

/**
 * Open a result. URLs come from the UI, so only ordinary web and file schemes are allowed; a page
 * could otherwise ask us to open `javascript:` or privileged URLs.
 */
export async function activateTarget(
	target: ActivationTarget,
	windowId?: number,
): Promise<void> {
	if (target.kind === "tab") return focusTab(target.tabId);

	let url: URL;
	try {
		url = new URL(target.url);
	} catch {
		throw new Error("This address cannot be opened by BrowserScope.");
	}
	if (!OPENABLE_PROTOCOLS.includes(url.protocol)) {
		throw new Error("This address cannot be opened by BrowserScope.");
	}
	await browser.tabs.create({ url: url.href, windowId, active: true });
}

/** Search the raw query with the browser's default search engine in a new tab. */
export async function searchWeb(query: string): Promise<void> {
	const text = query.trim();
	if (!text) return;
	if (import.meta.env.FIREFOX) {
		await firefox.search.search({ query: text, disposition: "NEW_TAB" });
	} else {
		await browser.search.query({ text, disposition: "NEW_TAB" });
	}
}
