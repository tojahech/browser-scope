import { browser } from "wxt/browser";
import { firefox } from "./firefox";
import type { ActivationTarget } from "./types";
export async function focusTab(id: number) {
	const tab = await browser.tabs.update(id, { active: true });
	if (!tab) throw new Error("This tab is no longer available.");
	await browser.windows.update(tab.windowId, { focused: true });
}
async function normalWindow(preferred?: number) {
	const windows = await browser.windows.getAll({ windowTypes: ["normal"] });
	return (
		windows.find((window) => window.id === preferred)?.id ?? windows[0]?.id
	);
}
export async function activateTarget(
	target: ActivationTarget,
	preferredWindow?: number,
): Promise<void> {
	if (target.kind === "tab") return focusTab(target.tabId);
	const url = new URL(target.url);
	if (!["http:", "https:", "ftp:", "file:"].includes(url.protocol))
		throw new Error("This address cannot be opened by BrowserScope.");
	const tab = await browser.tabs.create({
		url: url.href,
		windowId: await normalWindow(preferredWindow),
	});
	if (tab.id != null) await focusTab(tab.id);
}
export async function searchWeb(
	query: string,
	preferredWindow?: number,
): Promise<void> {
	if (!query.trim()) return;
	const tab = await browser.tabs.create({
		windowId: await normalWindow(preferredWindow),
	});
	if (tab.id == null) throw new Error("Could not open a search tab.");
	if (import.meta.env.FIREFOX)
		await firefox.search.search({ query, tabId: tab.id });
	else await browser.search.query({ text: query, tabId: tab.id });
	await focusTab(tab.id);
}
