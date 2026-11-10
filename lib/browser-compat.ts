/**
 * WXT types `browser` with Chromium's API. Firefox-only methods are declared here, in one place;
 * callers guard them with `import.meta.env.FIREFOX` or a feature check.
 */

import { browser } from "wxt/browser";

export type ThemeColor = string | number[] | null | undefined;

interface FirefoxExtras {
	theme: {
		getCurrent(
			windowId?: number,
		): Promise<{ colors?: Record<string, ThemeColor> | null }>;
	};
	commands: {
		update?(details: { name: string; shortcut: string }): Promise<void>;
		reset?(name: string): Promise<void>;
	};
	search: {
		search(details: {
			query: string;
			disposition?: "CURRENT_TAB" | "NEW_TAB" | "NEW_WINDOW";
		}): Promise<void>;
	};
	history: {
		onTitleChanged?: {
			addListener(
				listener: (change: { url: string; title: string }) => void,
			): void;
		};
	};
}

export const firefox = browser as typeof browser & FirefoxExtras;

/** Firefox can rebind commands from the extension; Chrome only via chrome://extensions/shortcuts. */
export const canUpdateCommands = () =>
	typeof firefox.commands.update === "function";
