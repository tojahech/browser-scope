import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";

export default defineConfig({
	// Firefox is the primary target, so `import.meta.env.FIREFOX` is true in tests.
	plugins: [WxtVitest({ browser: "firefox" })],
});
