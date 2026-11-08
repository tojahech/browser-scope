import { defineConfig } from "wxt";
import { CONFIG } from "./lib/config";
export default defineConfig({
	modules: ["@wxt-dev/module-solid"],
	manifest: ({ browser }) => ({
		name: CONFIG.name,
		description:
			"A keyboard-driven fuzzy finder for tabs, bookmarks, and history.",
		permissions: [
			"bookmarks",
			"history",
			"tabs",
			"storage",
			"search",
			...(browser === "firefox" ? ["theme"] : []),
		],
		action: { default_title: "Open BrowserScope" },
		commands: {
			[CONFIG.command]: {
				suggested_key: { default: CONFIG.defaultShortcut },
				description: "Open BrowserScope (double-tap to switch to previous tab)",
			},
		},
	}),
});
