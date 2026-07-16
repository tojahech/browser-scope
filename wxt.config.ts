import { defineConfig } from "wxt";
import {
	LAUNCH_SHORTCUT_DEFAULT,
	LAUNCH_SHORTCUT_DEFAULT_MAC,
} from "./lib/keybindings";

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ["@wxt-dev/module-solid"],
	manifest: ({ browser, manifestVersion }) => ({
		name: "BrowserScope",
		description:
			"Keyboard-driven fuzzy finder for tabs, bookmarks, and history.",
		permissions: ["tabs", "bookmarks", "history", "search"],
		commands: {
			// The command that opens the toolbar popup; its name differs by manifest version.
			[manifestVersion === 2 ? "_execute_browser_action" : "_execute_action"]: {
				suggested_key: {
					default: LAUNCH_SHORTCUT_DEFAULT,
					mac: LAUNCH_SHORTCUT_DEFAULT_MAC,
				},
			},
		},
		...(browser === "firefox" && {
			browser_specific_settings: {
				gecko: {
					id: "browserscope@cubiko.com.au",
					strict_min_version: "120.0",
				},
			},
		}),
	}),
});
