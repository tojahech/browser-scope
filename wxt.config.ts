import { defineConfig } from "wxt";
import {
	DEFAULT_LAUNCH_SHORTCUT,
	DEFAULT_LAUNCH_SHORTCUT_MAC,
	LAUNCH_COMMAND,
} from "./lib/config";

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ["@wxt-dev/module-solid"],
	manifest: ({ browser }) => ({
		name: "BrowserScope",
		description:
			"A keyboard-driven fuzzy finder for tabs, bookmarks and history.",
		permissions: [
			"bookmarks",
			"history",
			"tabs",
			"storage",
			"search",
			// Lets the UI match the Firefox theme.
			...(browser === "firefox" ? ["theme"] : []),
		],
		// Firefox swaps toolbar icons to match the theme ("light" is the icon
		// shown on dark themes). Chrome has no equivalent.
		...(browser === "firefox" && {
			browser_action: {
				theme_icons: [16, 32].map((size) => ({
					light: `icon-dark/${size}.png`,
					dark: `icon/${size}.png`,
					size,
				})),
			},
		}),
		commands: {
			[LAUNCH_COMMAND]: {
				suggested_key: {
					default: DEFAULT_LAUNCH_SHORTCUT,
					mac: DEFAULT_LAUNCH_SHORTCUT_MAC,
				},
				description: "Open BrowserScope (press twice for previous tab)",
			},
		},
	}),
});
