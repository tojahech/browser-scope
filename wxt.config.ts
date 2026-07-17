import { defineConfig } from "wxt";
import { COMMANDS, LAUNCH_SHORTCUT } from "./shared/keybindings";

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ["@wxt-dev/module-solid"],
	manifest: {
		name: "BrowserScope",
		description:
			"A keyboard-driven fuzzy finder for tabs, bookmarks, and history.",
		permissions: ["bookmarks", "history", "search", "tabs"],
		action: {
			default_title: "BrowserScope",
		},
		commands: {
			[COMMANDS.LAUNCH]: {
				description: "Open BrowserScope",
				suggested_key: LAUNCH_SHORTCUT,
			},
		},
	},
});
