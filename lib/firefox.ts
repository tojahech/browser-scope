import { browser } from "wxt/browser";

// WXT exposes Chromium's API types. Keep Firefox-only extensions to that API
// in one adapter; callers guard these methods with import.meta.env.FIREFOX.
interface FirefoxExtras {
	theme: {
		getCurrent(
			windowId?: number,
		): Promise<{ colors?: Record<string, string | number[] | null> }>;
	};
	commands: {
		update(details: { name: string; shortcut: string }): Promise<void>;
		reset(name: string): Promise<void>;
	};
	search: { search(details: { query: string; tabId: number }): Promise<void> };
}
export const firefox = browser as typeof browser & FirefoxExtras;
