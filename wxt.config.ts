import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ["@wxt-dev/module-solid"],
	manifest: {
		commands: {
			_execute_browser_action: {
				suggested_key: {
					default: "Ctrl+Space",
				},
			},
		},
	},
});
